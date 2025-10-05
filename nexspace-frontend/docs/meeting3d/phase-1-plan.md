# Meeting3D Revamp — Phase 1 Plan

## Current Assessment

### Visuals & Environment
- The current scene relies on improvised procedural textures, flat lighting, and a single open floor plate, so it lacks depth cues and material richness.
- No physically based materials, HDR environment, or baked lighting are used; everything is uniformly lit, which reads as "prototype" and hampers immersion.
- Props are limited to generic desks and chairs, creating repeated patterns without clear zoning or theming.

### Rooms, Layout & Navigation
- The space is a single rectangular room with ad-hoc desk grids; there is no concept of multiple rooms or teleportation between areas.
- Camera code blends many responsibilities (input handling, collision, auto-pathing) inside one component, making upgrades risky.
- Collision logic is based on hard-coded blocklists rather than a navmesh or volumetric room partitions.

### Interactions & Presence
- Seating is auto-assigned via heuristics; users cannot explicitly claim a seat or see occupancy cues.
- Presence features (status, whispers, chat) live in stores but do not surface as 3D affordances (no status pips, context menus, or room-based audio cues).
- There is no dedicated UI for room-to-room travel, and the scene lacks interactive hotspots (doors, whiteboards, etc.).

### Performance & Assets
- Geometry is generated in code; there is no asset pipeline (GLB, Draco/Meshopt, instancing) or texture compression strategy.
- Render loop is always-on; no frameloop throttling, tab visibility pausing, or per-room culling is implemented.
- Scene graph combines environment, avatars, and interaction logic in one component, preventing lazy loading or Suspense-driven code splitting.

### Code Structure & State
- `Meeting3D.tsx` is a 3,200+ line monolith that mixes rendering, state sync, environment construction, and LiveKit integration.
- There is no clear folder separation for `SceneRoot`, `Rooms`, `Avatar`, `Interaction`, or `UI` modules, making it hard to reason about responsibilities.
- Selectors are not memoized consistently, risking avoidable re-renders when we add richer overlays and controls.

## Proposed Multi-Phase Rollout
1. **Phase 1 — Scene Shell & Lazy Route (next PR)**
   - Introduce a `Meeting3DRoute` lazy-loaded entry point with Suspense fallback.
   - Extract a `SceneRoot` component that owns renderer lifecycle, feature flags, and frameloop control.
   - Stand up a responsive 3D layout shell (top bar, right drawer hook, bottom action bar placeholder) and wire it to existing stores.

2. **Phase 2 — Rooms & Navigation Skeleton**
   - Define room descriptors (Lobby, Open Desk, Conference, Focus, Cafe) with portals/doors metadata.
   - Add minimap overlay with room labels and jump-to-room actions (feature flagged).
   - Replace collider blocklist with nav volumes + door triggers scaffolding.

3. **Phase 3 — Seating, Presence & Audio Zones**
   - Implement explicit seat claiming, occupancy highlighting, and LiveKit area audio integration using existing participant metadata.
   - Add avatar context menus for whisper/DM, plus status indicators synced with store state.
   - Introduce whiteboard/notes zones using lightweight texture overlays and shared state hooks.

4. **Phase 4 — Visual & Asset Upgrade**
   - Swap procedural geometry with optimized GLB room modules (Draco/Meshopt) and shared PBR materials.
   - Integrate a single HDRI via PMREM and baked lightmaps per room (day/night variants sharing geometry).
   - Add curated props with instancing/LOD and room-based culling toggles.

5. **Phase 5 — Performance & QA Pass**
   - Instrument draw-call counts, FPS sampling, and memory budgeting; ensure frameloop pauses on hidden tab.
   - Finalize README additions (architecture, asset pipeline, perf notes) and feature flag toggles.
   - Document future enhancements and moderation/customization backlog.

## Immediate Implementation Notes
- Introduce a `lib/3d` directory to hold shared loaders, materials, and nav helpers.
- Use Zustand selectors (with `useShallow` or `useStore` + memoized selectors) to keep UI overlays performant.
- Plan to reuse existing LiveKit hooks (`useTracks`, `RoomEvent`) but move them into dedicated `Avatar` and `Presence` hooks to avoid prop drilling.
- Align Tailwind UI overlays with mobile-first layout, ensuring safe area insets map to the new 3D shell.
- Maintain compatibility with current stores by adding new derived selectors instead of mutating core actions until later phases.

## Wireframe Overview

The companion wireframe (shared in Figma for now) establishes:
- Lobby as spawn with help board and quick teleport list.
- Open Desk area containing hot desks and collaborative tables, flanked by plants for sight lines.
- Conference rooms and focus booths behind access portals; each has signage and status lights.
- Cafe/lounge off to one side with informal seating and emote hotspot.
- Minimap overlay (top-right) showing room names and quick-jump controls.
- Bottom action bar (mute, share, emotes) and right drawer (participants/chat) consistent with existing UX.
