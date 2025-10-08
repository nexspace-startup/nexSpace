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

- A performant Three.js scene with baked ambient lighting, themed room builds, and avatar capsules
  that gently bob to signal presence.
- Deterministic room-aware avatar layout for remote peers plus smooth WASD controls for the local
  user with collision bounds that keep everyone on campus.
- An interactive minimap with per-room occupancy counts, click-to-waypoint navigation, and
  Alt-click clearing so teammates can plot paths without breaking flow.
- A collapsible control dock that houses room status, the minimap, quality presets, and the new
  first-person/third-person view toggle.
- Join-nudge surface that deduplicates entries with a cooldown and now triggers wave, huddle, and
  DM actions via the meeting store.
- Quality selector with Low/Medium/High presets that map to renderer fidelity and shadows.
- Live spatial audio routing tied to room boundaries and proximity falloff so conversations fade as
  people move away or enter other rooms.
- Dynamic floor cues and in-scene waypoint markers that guide the local avatar toward selected
  destinations while rendering shared guidance for remote teammates.
- Distinct room decor for each zone (desks in the open area, lounge seating, conference tables,
  event stage, etc.) to reinforce sense of place without sacrificing performance.
- Camera controls that match modern 3D spaces: left-drag orbits around your avatar, Shift/right
  drag pans the camera, the mouse wheel zooms, and first-person mode reuses pointer look with
  keyboard strafing.

## Persistence & Settings

- View mode persistence now lives in the meeting store (`viewMode` reads & writes localStorage).
- Theme tokens (`src/constants/themeTokens.ts`) centralize dark/light colors for overlays.
- Quality level lives in the 3D store and is intended to map to renderer fidelity once the scene is
  online.

## Next Steps

1. Model interactive room objects (whiteboards, seating, game tables) and connect them to the store.
2. Integrate room media surfaces with screen share, spotlight mode, and embedded slides/video.
3. Layer in moderation controls (locks, invite-only huddles) and scheduling reminders tied to rooms.

## Development Notes

- Tests are colocated under `store/__tests__` and run with `npm run test` inside `nexspace-frontend`.
- Room configuration is exported to support future administrative panels.
- The store intentionally exposes `markWaypoint` and `quality` even though the rendering layer is
  not yet consuming them; they will become critical as navigation & perf controls come online.
