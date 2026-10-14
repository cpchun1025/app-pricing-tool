using System.Net.ServerSentEvents;
using System.Runtime.CompilerServices;

namespace LivePrices.Api;

/// <summary>What a tick says about one item. The name never changes, so it is not repeated.</summary>
public sealed record PriceChange(int Id, decimal Price, DateTime UpdatedAt);

/// <summary>The data of a "tick" event. Changes is empty when nothing changed since the previous tick.</summary>
public sealed record TickMessage(PriceChange[] Changes);

public static class ItemStream
{
    /// <summary>
    /// The events for ONE connected browser: first a "snapshot" with all items, then a "tick" about once a second
    /// that lists only what changed since the previous message. Each connection has its own timer and its own
    /// "what did I already send" copy. It only reads the store; it never changes a price.
    /// </summary>
    /// <param name="serverStopping">Cancelled when the API shuts down.</param>
    /// <param name="clientGone">Cancelled when the browser closes the connection (Unsubscribe, closed tab, network loss).</param>
    public static async IAsyncEnumerable<SseItem<object>> Read(
        ItemStore store,
        CancellationToken serverStopping,
        [EnumeratorCancellation] CancellationToken clientGone)
    {
        using var stop = CancellationTokenSource.CreateLinkedTokenSource(serverStopping, clientGone);

        var sent = store.GetSnapshot();
        yield return new SseItem<object>(sent, "snapshot");

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (true)
        {
            try
            {
                await timer.WaitForNextTickAsync(stop.Token);
            }
            catch (OperationCanceledException)
            {
                // The browser left or the server is stopping. That is a normal way for a stream to end,
                // so finish quietly instead of letting an exception reach Kestrel's error log.
                yield break;
            }

            var current = store.GetSnapshot();
            var changes = FindChanges(sent, current);
            sent = current;

            yield return new SseItem<object>(new TickMessage(changes), "tick");
        }
    }

    /// <summary>
    /// The items in <paramref name="current"/> that differ from what was already sent. Both arrays come from the
    /// store, which always has the same 10 items in the same order, so index i is the same item in both.
    /// Records compare every field, so a new UpdatedAt counts as a change even when the price is back to its
    /// earlier value.
    /// </summary>
    public static PriceChange[] FindChanges(Item[] sent, Item[] current) =>
        current
            .Where((item, i) => item != sent[i])
            .Select(item => new PriceChange(item.Id, item.Price, item.UpdatedAt))
            .ToArray();
}
