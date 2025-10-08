# 3D Mode Feature Scaffold

This folder contains the initial scaffolding for the immersive 3D workspace mode. The goal of
this first increment is to provide the structural building blocks that subsequent milestones can
extend with realtime rendering, spatial audio, and rich interactions.

## Structure

- `components/` – UI overlays that sit on top of the 3D canvas such as the minimap, quality
  controls, and join-nudge prompts.
- `config/` – Room & zone definitions with audio envelopes and signage copy. These are data-driven
  so that we can add, remove, or tweak rooms without touching render logic.
- `hooks/` – React hooks that sync LiveKit meeting data into the 3D store. The initial
  `useThreeDAvatarSync` keeps avatar presence in lockstep with the meeting store.
- `store/` – A Zustand slice that tracks avatar state, room occupancy, quality settings, and the
  join-nudge queue.

## Usage

The `ThreeDExperience` component is wired into `MeetingPanel` when the view mode is set to `3d`.
It currently renders a styled placeholder card while exposing functional UI chrome:

- Minimap with per-room occupancy counts.
- Join-nudge surface that deduplicates entries with a cooldown.
- Quality selector with Low/Medium/High presets.

These pieces are intentionally lightweight so they can stay mounted when we integrate the Three.js
scene without causing layout thrash.

## Persistence & Settings

- View mode persistence now lives in the meeting store (`viewMode` reads & writes localStorage).
- Theme tokens (`src/constants/themeTokens.ts`) centralize dark/light colors for overlays.
- Quality level lives in the 3D store and is intended to map to renderer fidelity once the scene is
  online.

## Next Steps

1. Embed the actual Three.js scene and connect room boundaries to spatial audio attenuation.
2. Replace the fallback room assignment in `useThreeDAvatarSync` with metadata-driven placement.
3. Wire the join-nudge actions (wave, invite, DM) into the communication stack.
4. Extend tests to cover proximity calculations once movement updates land.

## Development Notes

- Tests are colocated under `store/__tests__` and run with `npm run test` inside `nexspace-frontend`.
- Room configuration is exported to support future administrative panels.
- The store intentionally exposes `markWaypoint` and `quality` even though the rendering layer is
  not yet consuming them; they will become critical as navigation & perf controls come online.
