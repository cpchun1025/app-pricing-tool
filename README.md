# Live Item Prices

A small React + TypeScript page that lists 10 items and, after you click **Subscribe**, shows their prices changing live. A .NET 10 Minimal API owns the data, changes the prices once per second and pushes updates to the browser with Server-Sent Events (SSE).

This folder is a second, independent solution to the same exercise. The original application in `backend/` and `frontend/` at the repository root is untouched and is not needed here. The two use different ports (original: 5050 and 5173; this one: 5100 and 5200), so they do not collide.

**The frontend and the backend are two separate projects.** Neither builds, installs or starts the other, and ASP.NET Core does not serve the React app.

| | Folder | Needs | Address |
| --- | --- | --- | --- |
| Backend API | `revamp/backend/` | .NET 10 SDK only (no Node.js) | http://localhost:5100 |
| Frontend UI | `revamp/frontend/` | Node.js and npm only (no .NET) | http://localhost:5200 |

Quick start: two terminals, both starting in the repository root.

```bash
# Terminal 1: the API
cd backend
dotnet run
```

```bash
# Terminal 2: the UI
cd frontend
npm ci
npm run dev
```

Open http://localhost:5200 and click **Subscribe**.