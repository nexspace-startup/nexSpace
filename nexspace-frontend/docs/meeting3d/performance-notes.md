# Meeting3D Performance Notes

We target 55–60 FPS on mid-range laptops with 150 draw calls or fewer per view. The following checks were taken after migrating to the new modular architecture.

## Scene metrics

| Area              | Draw Calls | GPU Time (ms) | Notes |
| ----------------- | ---------- | ------------- | ----- |
| Lobby / Reception | 118        | 8.5           | Instanced planters + desks, baked ambient light |
| Open Desk Area    | 132        | 10.1          | Highest density of avatars and monitors |
| Conference Room   | 96         | 7.2           | Glass walls + screen share plane |
| Focus Booths      | 84         | 6.4           | Door occlusion reduces off-screen furniture |
| Cafe / Lounge     | 110        | 8.9           | Dynamic emissive lamps + game table dice |

Measurements captured on an M2 Air @ 1440×900 using Chrome 130.

## Runtime strategies

- Renderer pixel ratio capped at 1.5× except when heavy screen share lowers it to 1×.
- `frameloop="demand"` analogue: render loop throttles when no movement occurs and pauses on hidden tabs.
- Minimap redraw throttled to 15 FPS via `minimapNextAtRef` to avoid layout thrash.
- Instancing for desks, chairs, keyboards, mice, mugs, and plants.
- Draco + Meshopt compressed GLBs for furniture modules.
- Room-based occlusion toggles remove hidden instanced meshes when doors close.

## Debug commands

- Press `Shift + P` to print render stats in dev mode.
- Append `?perf=low` to the URL to force battery saver quality mode.
- Use `localStorage.setItem("meeting3d.theme", "light")` or `"dark"` to persist the chosen lighting environment.

