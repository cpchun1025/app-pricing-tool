using LivePrices.Api;

var builder = WebApplication.CreateBuilder(args);

// A browser only lets the React page call this API if the API says so. Allow exactly one origin:
// the Vite dev server. Its address must match "server.port" in frontend/vite.config.ts.
var frontendOrigin = builder.Configuration["FrontendOrigin"]
    ?? throw new InvalidOperationException("Set FrontendOrigin in appsettings.json.");
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(frontendOrigin)));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ItemStore>();            // one store for the whole app
builder.Services.AddHostedService<PriceUpdateWorker>(); // one price-update loop for the whole app

var app = builder.Build();

app.UseCors();

// The table before anyone subscribes: all 10 items as they are right now.
app.MapGet("/api/items", (ItemStore store) => store.GetSnapshot());

// Live updates (Server-Sent Events). TypedResults.ServerSentEvents sets the text/event-stream headers, turns off
// response buffering and writes each yielded SseItem as "event: ..." / "data: ..." lines.
app.MapGet("/api/items/stream", (ItemStore store, IHostApplicationLifetime lifetime, CancellationToken clientGone) =>
    TypedResults.ServerSentEvents(ItemStream.Read(store, lifetime.ApplicationStopping, clientGone)));

app.Run();
