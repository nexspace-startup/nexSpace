# Meeting3D Experience

This document describes the new Meeting3D implementation that powers the immersive co-working space. The experience is split into modular packages so we can iterate quickly without touching LiveKit plumbing or shared UI primitives.

## Folder layout

```
src/
  features/
    meeting3d/
      index.tsx             # Lazy-loaded entry point that wires Suspense + fallback
      SceneRoot.tsx         # Primary 3D orchestrator (scene, movement, presence)
      lib3d/                # Three.js helpers, materials, geometry builders
      ui/                   # React overlays (minimap, shell, drawers, etc.)
      hooks/                # Meeting3D-specific hooks
      avatar/               # Avatar prefab + animation utilities
      interaction/          # Seat claiming, teleport, navmesh helpers
      rooms/                # Layout definitions for lobby, lounge, booths …
```

Only `SceneRoot` currently renders the full scene while we finish migrating logic into the smaller packages. New code should prefer dropping files into `ui/`, `interaction/`, or `rooms/` instead of growing `SceneRoot`.

## Adding a new room

1. Define a new room rectangle and props inside `rooms/<room-name>.ts`. Rooms expose
   - `bounds` — world-space coordinates
   - `label` — minimap + UI name
   - `build` — factory that receives the shared `THREE.Scene` and current palette
2. Register the room inside `lib3d/Zone.ts` by importing your builder and appending it to the room table.
3. Update any teleport anchors or minimap metadata inside `SceneRoot` so avatars can jump into the new space.

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

## Future work

- Finalise extraction of avatar rendering + seat claiming into `avatar/` & `interaction/`
- Add automated performance captures (Lighthouse/Trace) to CI
- Publish nav-mesh authoring guide for external map designers

