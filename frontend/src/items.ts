// The shapes of the JSON sent by the API (see "API contract" in the README).

/** One item, as returned by GET /api/items and by the "snapshot" event. */
export type Item = {
  id: number
  name: string
  price: number
  updatedAt: string // UTC, ISO 8601, for example "2026-10-13T13:24:04.585Z"
}

/** One entry of a "tick" event: only the fields that can change. */
export type PriceChange = Pick<Item, 'id' | 'price' | 'updatedAt'>

/** The data of a "tick" event. `changes` is empty when nothing changed. */
export type TickMessage = { changes: PriceChange[] }

export type Direction = 'up' | 'down' | 'same'

/** What the table shows: the item plus how its price moved on the latest tick. */
export type ItemRow = Item & { direction: Direction }

/** Initial load or snapshot: take the server's items (already in their fixed order) with every indicator at "same". */
export function toRows(items: Item[]): ItemRow[] {
  return items.map((item): ItemRow => ({ ...item, direction: 'same' }))
}

/**
 * Apply one tick. The rows are mapped in place, never sorted, so the order cannot change.
 * A row named in `changes` gets its new price and time, and up/down/same comes from comparing the new price
 * with the price the row showed before. A row that is not named did not change, so it shows "same".
 */
export function applyTick(rows: ItemRow[], changes: PriceChange[]): ItemRow[] {
  const changeById = new Map(changes.map((change) => [change.id, change]))

  return rows.map((row): ItemRow => {
    const change = changeById.get(row.id)
    if (!change) {
      return { ...row, direction: 'same' }
    }

    return {
      ...row,
      price: change.price,
      updatedAt: change.updatedAt,
      direction: directionOf(change.price, row.price),
    }
  })
}

function directionOf(newPrice: number, oldPrice: number): Direction {
  if (newPrice > oldPrice) return 'up'
  if (newPrice < oldPrice) return 'down'
  return 'same'
}
