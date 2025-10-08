# Meeting3D Experience

This document describes the new Meeting3D implementation that powers the immersive co-working space. The experience is split into modular packages so we can iterate quickly without touching LiveKit plumbing or shared UI primitives.

## Folder layout

```
src/
  features/
    meeting3d/
      index.tsx             # Lazy-loaded entry point that wires Suspense + fallback
      SceneRoot.tsx         # Primary 3D orchestrator (scene, movement, presence)
      config.ts             # Central feature flags for incremental rollout
      lib3d/                # Three.js helpers, materials, geometry builders
      ui/                   # React overlays (minimap, shell, drawers, etc.)
      hooks/                # Meeting3D-specific hooks
      avatar/               # Avatar prefab + animation utilities
      interaction/          # Seat claiming, teleport, navmesh helpers
      rooms/
        definitions.ts      # Canonical room descriptors, nav volumes, portals
        navigation.ts       # Runtime helpers (resolve rooms, nav volumes)
        types.ts            # Shared room + portal types
```

Only `SceneRoot` currently renders the full scene while we finish migrating logic into the smaller packages. New code should prefer dropping files into `ui/`, `interaction/`, or `rooms/` instead of growing `SceneRoot`.

## Adding a new room

1. Append a new descriptor to `rooms/definitions.ts` with `bounds`, `defaultSpawn`, and portal metadata.
   - Update `ROOM_NAV_VOLUMES` with any additional connector strips needed for pathfinding.
   - Add matching entries to `ROOM_PORTALS` so the minimap + door highlights stay in sync.
2. Reference the new room inside `lib3d/Zone.ts` to lay out meshes, signage, and colliders.
   - Use the shared helpers (`roomTitle`, `resolveBounds`) so physical geometry aligns with the descriptor bounds.
   - Push any bespoke doorways (e.g. cafe prep, backstage) to the returned `doorways` array.
3. If the space needs special props, add them under `lib3d/` and register with the existing palette hooks for theme swaps.
4. Update docs or UX overlays (e.g. `MinimapOverlay`) if the room introduces custom actions or status indicators.

## Feature flags & navigation

- Flip toggles in `config.ts` to roll out pieces of the revamp (`showMinimapOverlay`, `enforceNavVolumes`, etc.).
- Toggle `showPerformanceOverlay` when you want to hide the in-scene diagnostics HUD for client demos.
- Navigation helpers live in `rooms/navigation.ts` and expose sorted nav volumes, adjacency lookups, and portal metadata.
- `SceneRoot` enforces the nav volumes when the flag is on and uses the room definitions to calculate quick jumps + presence counts.

## Adding a prop or prefab

1. Place instanced geometry + materials in `lib3d/` (follow the desk, sofa, chair modules).
2. Expose a small factory returning `{ group, colliders }` so other rooms can instantiate the asset efficiently.
3. When adding to the scene make sure to push colliders into the shared arrays so movement + path finding pick them up.

## UX shell

The overlay shell lives in `ui/` and composes:

- Top bar with current area name, LiveKit status, and theme toggle
- Right drawer showing participants with seat occupancy and presence state
- Bottom bar for meeting controls (mute, share, emotes)
- Minimap overlay with teleport + room jump affordances

Each overlay uses stores from `stores/meetingStore` with memoised selectors to avoid flooding React renders.

## Theme pipeline

Meeting3D ships with day and night palettes that update materials and environment lighting via `applyEnvironmentTheme` and `applyZoneTheme`. Transitions are animated to hide lighting pops. When adding new materials set `userData.furnitureKey` so palette swaps know how to recolor them.

## Lazy loading & code splitting

`index.tsx` is imported via `React.lazy` from `MeetingPanel`. The heavy three.js tree (≈500 KB gz) now sits in its own chunk and only loads when the user switches to the 3D view. Ancillary overlays (mini-map, whiteboard) will follow the same pattern as they are migrated to dedicated components.

## Performance diagnostics HUD

- The performance overlay (top-left) samples FPS, frame time, draw calls, triangles, geometry/texture counts, and JavaScript heap usage every second.
- Budgets are inlined next to each metric (55 FPS, ≤150 draw calls, ≤500 MB heap) so QA can spot regressions at a glance.
- Collapse the panel via the `Hide` button or disable it entirely with the `showPerformanceOverlay` feature flag.
- Metrics pause automatically when the tab is hidden so background tabs do not skew the sampling window.

## Future work

- Finalise extraction of avatar rendering + seat claiming into `avatar/` & `interaction/`
- Add automated performance captures (Lighthouse/Trace) to CI
- Publish nav-volume authoring guide for external map designers

