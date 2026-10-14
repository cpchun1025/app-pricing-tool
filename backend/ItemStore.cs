namespace LivePrices.Api;

/// <summary>
/// One row of the table. Immutable: a price change creates a new Item, it never edits an existing one,
/// so an Item that has been handed out can be serialized safely at any time.
/// </summary>
public sealed record Item(int Id, string Name, decimal Price, DateTime UpdatedAt);

/// <summary>
/// The in-memory data: exactly 10 items in a fixed order. The array is only touched inside one short lock,
/// and callers only ever receive a copy of it.
/// </summary>
public sealed class ItemStore
{
    private static readonly (string Name, decimal Price)[] Seed =
    [
        ("Notebook A5", 4.50m),
        ("Ballpoint Pen Set", 12.90m),
        ("USB-C Cable", 9.99m),
        ("Desk Lamp", 34.00m),
        ("Wireless Mouse", 24.99m),
        ("Mechanical Keyboard", 89.50m),
        ("Webcam", 59.00m),
        ("Headphones", 129.00m),
        ("27-inch Monitor", 249.00m),
        ("Standing Desk", 399.00m),
    ];

    private readonly Lock _lock = new();
    private readonly Item[] _items;
    private readonly TimeProvider _clock;

    public ItemStore(TimeProvider clock)
    {
        _clock = clock;

        var now = UtcNow();
        _items = Seed.Select((seed, index) => new Item(index + 1, seed.Name, seed.Price, now)).ToArray();
    }

    /// <summary>A copy of all items in their fixed order. It does not change while the caller is using it.</summary>
    public Item[] GetSnapshot()
    {
        lock (_lock)
        {
            return _items.ToArray();
        }
    }

    /// <summary>
    /// Asks <paramref name="nextPrice"/> for a new price for every item. An item is replaced (new price and
    /// new UpdatedAt) only when its price really changed, so UpdatedAt never moves for an unchanged price.
    /// </summary>
    public void UpdatePrices(Func<decimal, decimal> nextPrice)
    {
        lock (_lock)
        {
            var now = UtcNow();

            for (var i = 0; i < _items.Length; i++)
            {
                var item = _items[i];
                var price = nextPrice(item.Price);

                if (price != item.Price)
                {
                    _items[i] = item with { Price = price, UpdatedAt = now };
                }
            }
        }
    }

    // A JavaScript Date only holds milliseconds, so drop the extra digits. It also keeps the JSON shorter.
    private DateTime UtcNow()
    {
        var now = _clock.GetUtcNow().UtcDateTime;
        return new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerMillisecond, DateTimeKind.Utc);
    }
}
