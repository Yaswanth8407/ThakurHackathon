# PRD: The Pirate Navigation System
**PS #02 — KJSSE CSI Gemini Hackday 2.0**

---

## 1. Overview

**Problem statement:** Build a maritime pathfinding system that calculates safe, fast sea routes across an island network, accounting for dynamically declared hazards and patrol zones.

**Core idea:** A weighted-graph shortest-path engine (islands = nodes, routes = edges) with a Leaflet map UI. Users pick a departure and destination island, view the calculated route with distance/time, and can mark hazard zones that trigger instant recalculation.

**Out of scope (for hackathon time budget):**
- User accounts / auth
- Real-world geodata or ocean-current physics
- Persisting hazard state across sessions (in-memory or simple flag is fine)
- Mobile-native app — responsive web only

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + Express | Existing skillset, fast to scaffold |
| Database | MongoDB (Mongoose) | Existing skillset; simple schema needs |
| Frontend | Static HTML + vanilla JS | No framework learning curve under time pressure |
| Map rendering | Leaflet.js | Free, lightweight, well-documented, works with lat/lng markers + polylines |
| Pathfinding | Dijkstra's algorithm (custom implementation) | Standard, well-known, sufficient for 10–20 node graphs |
| Hosting | Single Express server serving `/public` as static files | No CORS, no separate deploy |

**Explicitly not used:** EJS (no server-rendered pages needed — all interaction is client-side/API-driven), React (unfamiliar, unnecessary learning curve for a 1-day build).

---

## 3. Data Model

### Island (node)
```js
{
  _id: ObjectId,
  name: String,       // "Skull Cove"
  lat: Number,
  lng: Number
}
```

### Route (edge)
```js
{
  _id: ObjectId,
  fromIsland: ObjectId,   // ref Island
  toIsland: ObjectId,     // ref Island
  distance: Number,       // nautical miles
  speed: Number,           // knots, default e.g. 10
  isHazard: Boolean,       // default false
  isPatrolZone: Boolean    // default false
}
```

> Routes are treated as bidirectional edges unless a specific reason arises to make them directional.

---

## 4. Backend — API Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/islands` | List all islands (for map markers + dropdowns) |
| `POST` | `/api/islands` | Add a new island (seed/admin use) |
| `GET` | `/api/routes` | List all routes (for drawing edges / hazard toggling) |
| `POST` | `/api/routes` | Add a new route between two islands |
| `PATCH` | `/api/routes/:id/hazard` | Toggle `isHazard` or `isPatrolZone` on a route |
| `GET` | `/api/path?from=<islandId>&to=<islandId>` | Run Dijkstra, return ordered island path + total distance + estimated time |

### Pathfinding logic
- Graph built fresh from current `routes` collection on each `/api/path` call (no caching needed at this scale).
- Edge weight = `distance`.
- If `isHazard` or `isPatrolZone` is true: exclude the edge entirely **or** apply a heavy penalty multiplier (e.g. ×10) — decide at build time based on whether "avoid entirely" or "avoid unless no alternative" is the desired behavior.
- On hazard toggle, the frontend simply re-calls `/api/path` — no incremental recalculation needed; brute-force re-run is fast enough at this graph size.
- Response shape:
```json
{
  "path": ["islandId1", "islandId2", "islandId3"],
  "totalDistance": 42.5,
  "estimatedTimeHours": 4.25
}
```

---

## 5. Frontend — Structure & Behavior

### File structure
```
/public
  index.html    → map container, from/to dropdowns, route info panel
  app.js        → fetch calls, Leaflet init, polyline draw, hazard toggle handling
  style.css
```

### Core UI flow
1. On load: `fetch('/api/islands')` and `fetch('/api/routes')` → render markers and base route lines on the Leaflet map.
2. User selects departure + destination (dropdown or map-click selection).
3. Frontend calls `GET /api/path?from=...&to=...` → draws the returned path as a highlighted polyline, displays distance/time in a side panel.
4. User clicks a route line on the map → toggles hazard/patrol state via `PATCH /api/routes/:id/hazard` → frontend re-fetches routes and re-runs the path query automatically if the current path is affected.
5. Hazard/patrol routes are styled distinctly on the map (e.g. red dashed line) so the "why" of a recalculated route is visually obvious.

---

## 6. Build Order (hackathon day)

| Step | Task | Time estimate |
|---|---|---|
| 1 | Seed 8–12 islands + routes (realistic archipelago layout) | 30 min |
| 2 | Dijkstra endpoint, tested via Postman before touching UI | 1–1.5 hr |
| 3 | Leaflet map rendering islands + base routes | 1 hr |
| 4 | Wire up from/to selection → path fetch → polyline draw | 1 hr |
| 5 | Hazard toggle + auto-recalculation | 45 min |
| 6 | Polish: knots/time display, hazard styling, loading states, demo data | remaining time |

**Pre-hackathon prep (recommended):** spend ~20 minutes getting a bare Leaflet map with markers rendering, so day-of time isn't spent learning the library from scratch alongside the algorithm.

---

## 7. Demo Script (for judges)

1. Show the map with islands and base routes.
2. Select departure/destination → route draws, distance/time shown.
3. Click a route on the current path → mark it as a hazard.
4. Path instantly recalculates around the hazard → highlight that this is live, not pre-scripted.
5. One-line technical note: "This uses Dijkstra's algorithm over a dynamically weighted graph — hazard zones are penalized/excluded and the route recalculates in real time."

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Leaflet unfamiliarity eating build time | Practice basic setup before hackathon day |
| Graph too small/boring for demo | Seed enough islands (10+) with multiple possible paths so hazard rerouting is visually obvious |
| Dijkstra edge cases (disconnected graph, no path found) | Handle explicitly — return a clear "no safe route" response instead of crashing |
| Scope creep (real-time multi-user, persistence, auth) | Explicitly out of scope per Section 1 — resist adding mid-build |
