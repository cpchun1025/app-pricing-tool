import { useEffect, useRef, useState } from 'react'
import { applyTick, toRows, type Direction, type Item, type ItemRow, type TickMessage } from './items'
import './App.css'

// Where the .NET API runs. Override with VITE_API_BASE_URL (see README). The API's CORS setting must allow this page's origin.
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5100'

type LoadState = { status: 'loading' } | { status: 'loaded' } | { status: 'error'; message: string }

// "disconnected" = not subscribed. "reconnecting" = the browser lost the connection and is retrying by itself.
// "failed" = the browser gave up (for example the server answered with an error); Subscribe tries again.
type Connection = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'

const STATUS_TEXT: Record<'loading' | 'error' | Connection, string> = {
  loading: 'Loading items…',
  error: 'Items not loaded.',
  disconnected: 'Disconnected. Not subscribed, so prices are not updating.',
  connecting: 'Connecting…',
  connected: 'Connected. Prices update about once per second.',
  reconnecting: 'Connection lost. Reconnecting…',
  failed: 'Could not open the live stream. Click Subscribe to try again.',
}

// The direction is shown as a symbol and a word, so it never depends on colour alone.
const DIRECTION_TEXT: Record<Direction, { symbol: string; label: string }> = {
  up: { symbol: '▲', label: 'Up' },
  down: { symbol: '▼', label: 'Down' },
  same: { symbol: '–', label: 'Same' },
}

const priceFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function App() {
  const [rows, setRows] = useState<ItemRow[]>([])
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [connection, setConnection] = useState<Connection>('disconnected')

  // A ref, not state: it always holds the one open EventSource (or null), even between renders.
  const sourceRef = useRef<EventSource | null>(null)

  // Page load, and again each time the user clicks Retry: fetch the 10 items once.
  useEffect(() => {
    const controller = new AbortController()

    async function loadItems() {
      setLoad({ status: 'loading' })
      try {
        const response = await fetch(`${API_BASE_URL}/api/items`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`The API answered ${response.status} ${response.statusText}`.trim())
        }
        const items: Item[] = await response.json()
        setRows(toRows(items))
        setLoad({ status: 'loaded' })
      } catch (error) {
        if (controller.signal.aborted) return // this attempt was replaced (Retry) or the page went away
        setLoad({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    }

    void loadItems()
    return () => controller.abort()
  }, [loadAttempt])

  // Close the stream when the page goes away.
  useEffect(() => {
    return () => {
      sourceRef.current?.close()
      sourceRef.current = null
    }
  }, [])

  function subscribe() {
    if (sourceRef.current) return // already connected: never open a second connection

    const source = new EventSource(`${API_BASE_URL}/api/items/stream`)
    sourceRef.current = source
    setConnection('connecting')

    // After Unsubscribe the ref no longer points at this source, so a late event from it is ignored.
    const isCurrent = () => sourceRef.current === source

    source.addEventListener('open', () => {
      if (isCurrent()) setConnection('connected')
    })

    source.addEventListener('error', () => {
      if (!isCurrent()) return

      if (source.readyState === EventSource.CLOSED) {
        sourceRef.current = null
        setConnection('failed')
      } else {
        // The connection dropped. The browser reconnects by itself, and the server starts every new
        // connection with a fresh snapshot, so there is nothing to repair here.
        setConnection('reconnecting')
      }
    })

    source.addEventListener('snapshot', (event) => {
      if (isCurrent()) setRows(toRows(JSON.parse(event.data) as Item[]))
    })

    source.addEventListener('tick', (event) => {
      if (!isCurrent()) return
      const tick = JSON.parse(event.data) as TickMessage
      setRows((current) => applyTick(current, tick.changes))
    })
  }

  function unsubscribe() {
    sourceRef.current?.close()
    sourceRef.current = null
    setConnection('disconnected')
  }

  const statusKey = load.status === 'loaded' ? connection : load.status
  const canSubscribe = load.status === 'loaded' && (connection === 'disconnected' || connection === 'failed')
  const canUnsubscribe = connection === 'connecting' || connection === 'connected' || connection === 'reconnecting'

  return (
    <main className="page">
      <h1>Live item prices</h1>
      <p className="intro">Subscribe to watch the server's prices change about once per second; Unsubscribe freezes the table.</p>

      <div className="toolbar">
        <button type="button" onClick={subscribe} disabled={!canSubscribe}>
          Subscribe
        </button>
        <button type="button" className="secondary" onClick={unsubscribe} disabled={!canUnsubscribe}>
          Unsubscribe
        </button>
        <p className="status" data-state={statusKey} role="status">
          {STATUS_TEXT[statusKey]}
        </p>
      </div>

      {load.status === 'error' && (
        <div className="error-box" role="alert">
          <p>
            <strong>Could not load the items.</strong> Is the backend running at {API_BASE_URL}? Start it, then click
            Retry.
          </p>
          <p className="details">Details: {load.message}</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
            Retry
          </button>
        </div>
      )}

      {load.status === 'loaded' && (
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">Items with their latest price and whether it went up, down or stayed the same</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Name</th>
                <th scope="col" className="number">
                  Price
                </th>
                <th scope="col">Change</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { symbol, label } = DIRECTION_TEXT[row.direction]
                return (
                  <tr key={row.id} className={`row-${row.direction}`}>
                    <td>{row.id}</td>
                    <td>{row.name}</td>
                    <td className="number">{priceFormat.format(row.price)}</td>
                    <td className={`change change-${row.direction}`}>
                      <span aria-hidden="true">{symbol}</span> {label}
                    </td>
                    <td>
                      <time dateTime={row.updatedAt}>{timeFormat.format(new Date(row.updatedAt))}</time>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
