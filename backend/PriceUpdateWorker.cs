namespace LivePrices.Api;

/// <summary>
/// The only thing in the application that changes prices: one loop, once per second, for the whole server.
/// It starts and stops with the app and does not care whether anyone is subscribed.
/// </summary>
public sealed class PriceUpdateWorker(ItemStore store) : BackgroundService
{
    private const decimal MinPrice = 0.01m; // a price never falls below one cent
    private const decimal MinMove = 0.01m;  // smallest move: one cent, so a small price never rounds an up/down move away to nothing

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        // When the app shuts down, WaitForNextTickAsync throws OperationCanceledException and the host stops cleanly.
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            store.UpdatePrices(price => NextPrice(price, Random.Shared));
        }
    }

    /// <summary>
    /// Random walk: each price has a 25% chance to go up, 25% to go down and 50% to stay the same, so a typical
    /// tick shows all three outcomes while only about half of the rows change. A move is 0.1% to 2% of the price
    /// (at least <see cref="MinMove"/>), and the result never drops below <see cref="MinPrice"/>.
    /// </summary>
    public static decimal NextPrice(decimal price, Random random)
    {
        var roll = random.Next(4); // 0 = up, 1 = down, 2 and 3 = same
        if (roll >= 2)
        {
            return price;
        }

        var percent = random.Next(1, 21) / 1000m; // 0.1% .. 2.0%
        var move = Math.Max(MinMove, Math.Round(price * percent, 2));
        var next = roll == 0 ? price + move : price - move;

        return Math.Max(MinPrice, next);
    }
}
