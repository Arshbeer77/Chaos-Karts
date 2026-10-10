# Chaos Karts

**Little karts. Big trouble.** An original low-poly browser kart racer for phones, tablets, and computers. No Mario/Nintendo assets or external game assets are used.

## Play locally

Install Node.js 22 or newer, then run:

```sh
npm ci
npm start
```

Open **http://localhost:3000**. For devices on the same Wi-Fi, open `http://YOUR-COMPUTER-LAN-IP:3000` on each device. The computer must stay running; your firewall may require permission for Node. A localhost link is only accessible on the computer running the server.

## Host for free on Render

The repository includes `render.yaml` for a single **Free** Node web service that serves both the game and its WebSocket multiplayer server.

1. Sign in at https://dashboard.render.com and connect this GitHub repository.
2. Choose **New → Blueprint**, select `Arshbeer77/Chaos-Karts`, and use `render.yaml`. Alternatively create a **Web Service**, select Node, set build command to `npm ci`, start command to `npm start`, and explicitly select the **Free** instance.
3. Deploy and open the HTTPS `onrender.com` URL Render provides.
4. Everyone opens that same URL. One player creates a room, shares the six-character code, and starts when friends have joined.

Do not select a paid instance or add a paid database; this prototype does not need either. Render's Free service currently sleeps after 15 minutes without inbound traffic and wakes on a new request; the first visit can take about a minute. The free allowance is 750 instance hours per workspace per month, shared with its other free services. Active WebSocket messages count as activity. Limits may change: https://render.com/docs/free and https://render.com/docs/websocket.

Rooms live in memory, so restarts and redeploys end active rooms. This app uses one server instance: do not scale it horizontally without adding shared room routing/state. Static-only hosts such as GitHub Pages cannot run this WebSocket server.

### Cloudflare compatibility

Cloudflare can host this kind of game using Workers Static Assets for the client and a SQLite-backed Durable Object per room for WebSockets and race simulation. **This repository currently uses a Node server, so it is not yet deployable as a Cloudflare Worker.** It needs a room-server adapter and a Wrangler configuration; uploading only `public/` to Cloudflare Pages will not enable online multiplayer.

As checked on October 10, 2026, the Durable Objects Free plan includes 100,000 requests/day and 13,000 GB-s/day of compute duration. Incoming WebSocket messages use a 20:1 request billing ratio; outgoing messages are not charged. A continuously ticking race consumes active duration, even if little CPU is used. Idle lobbies should use WebSocket hibernation after adaptation. Free-plan limit exhaustion returns errors rather than automatically charging for overages. See https://developers.cloudflare.com/durable-objects/platform/pricing/.

## Included

- Two 3D circuits: **Sunset Bay** and **Canyon Run**, three laps each.
- One kart design, eight paint colors; online players get unique colors.
- Room creation/joining for up to eight racers, host-selected track, countdown, live standings, finish results, and rematches.
- Solo practice against three bots, playable without a multiplayer connection once assets load.
- Arcade acceleration, braking/reversing, steering, off-road slowdown, bumping, drift charge and release boost.
- Random pickups: turbo boost, protective bubble, oil slick, straight-firing rocket.
- Keyboard and multitouch controls, auto-acceleration on touch devices, minimap, optional synthesized engine sound.
- Server-authoritative 30 Hz simulation with 15 Hz snapshots and smoothed rendering. Clients send inputs, not positions or lap counts.
- Ordered checkpoint gates, input validation, payload/message limits, stale-input neutralization, heartbeat cleanup, host transfer after disconnect, and a cap on active rooms.

## Controls

| Action | Keyboard | Phone / tablet |
|---|---|---|
| Accelerate | W / ↑ | Automatic |
| Steer | A D / ← → | Hold arrow buttons |
| Brake / reverse | S / ↓ | BRAKE |
| Drift | Hold Shift while steering | Hold DRIFT while steering |
| Use item | Space | Tap item slot |
| Reset to road | R, solo only | Road edge automatically contains kart |

Charge a drift for at least 0.65 seconds, then release for a mini boost. Landscape orientation is recommended on phones. Sound is opt-in. The How to Play dialog also lets you enable or disable touch controls manually on hybrid devices.

## Verification

```sh
npm test
```

Tests cover bot completion of both circuits, lap gating, drift boost, grass slowdown, shield behavior, countdown, two-client room synchronization, host-only start, disconnect/host transfer, room cleanup, health endpoint, and unavailable rooms.

## Structure

- `server.js`: HTTP assets, WebSocket rooms, authoritative fixed-step simulation.
- `public/shared.js`: track geometry and shared race physics.
- `public/scene.js`: procedural Three.js world, kart models, camera and rendering.
- `public/main.js`: UI, controls, solo game, network client and sound.
- `public/style.css`: responsive main menu, lobby and race HUD.
- `tests/`: Node test runner checks; no additional test dependencies.

The game uses only Three.js and `ws`. Scenery uses GPU instancing, low-poly geometry, capped pixel density, no realtime shadow maps, and no downloaded textures/models. The server compresses assets with gzip. Fonts load from Google Fonts with system fallbacks. There is no bundler or build step.

## Prototype limitations

No accounts, matchmaking, persistence, reconnect-in-progress, spectators, gamepad support, or competitive-grade anti-cheat. Rooms are code-based invitations, not authenticated private spaces. Projectiles travel straight instead of homing. There is no client-side movement prediction, so high latency affects steering response. Mobile hardware performance and real internet play should be checked on your target devices before a public launch.
