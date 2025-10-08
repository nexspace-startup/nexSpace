# 3D Mode Feature Scaffold

This folder now contains the live 3D campus experience for the immersive workspace mode. The
initial scaffolding has been extended with a Three.js scene, spatial overlays, and data-driven
layouts that future milestones can wire into realtime audio/video, huddles, and moderation flows.

## Structure

- `components/` – UI overlays that sit on top of the 3D canvas such as the minimap, quality
  controls, join-nudge prompts, and the `ThreeDScene` renderer.
- `config/` – Room & zone definitions with audio envelopes and signage copy. These are data-driven
  so that we can add, remove, or tweak rooms without touching render logic.
- `hooks/` – React hooks that sync LiveKit meeting data into the 3D store. The initial
  `useThreeDAvatarSync` keeps avatar presence in lockstep with the meeting store.
- `store/` – A Zustand slice that tracks avatar state, room occupancy, quality settings, and the
  join-nudge queue.

## Usage

The `ThreeDExperience` component is wired into `MeetingPanel` when the view mode is set to `3d`.
It now renders the live campus scene plus supporting UI chrome:

- A performant Three.js scene with baked ambient lighting, room floor meshes, labels, and avatar
  capsules that gently bob to signal presence.
- Deterministic room-aware avatar layout so occupants distribute evenly across each zone.
- A minimap with per-room occupancy counts.
- Join-nudge surface that deduplicates entries with a cooldown.
- Quality selector with Low/Medium/High presets that map to renderer fidelity and shadows.

## Persistence & Settings

- View mode persistence now lives in the meeting store (`viewMode` reads & writes localStorage).
- Theme tokens (`src/constants/themeTokens.ts`) centralize dark/light colors for overlays.
- Quality level lives in the 3D store and is intended to map to renderer fidelity once the scene is
  online.

## Next Steps

1. Connect room boundaries to spatial audio attenuation & voice isolation rules.
2. Layer in navigation controls (WASD, click-to-move) and proximity-based falloff for avatars.
3. Wire the join-nudge actions (wave, invite, DM) into the communication stack.
4. Extend tests to cover proximity calculations once movement updates land.

## Development Notes

- Tests are colocated under `store/__tests__` and run with `npm run test` inside `nexspace-frontend`.
- Room configuration is exported to support future administrative panels.
- The store intentionally exposes `markWaypoint` and `quality` even though the rendering layer is
  not yet consuming them; they will become critical as navigation & perf controls come online.
