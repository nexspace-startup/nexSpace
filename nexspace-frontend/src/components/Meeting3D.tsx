import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTracks, isTrackReference } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useMeetingStore } from '../stores/meetingStore';
import { useShallow } from 'zustand/react/shallow';
import { createDeskModule, type DeskPrefab } from './3DRoom/desks';
import { DeskGridManager, type SeatTransform } from './3DRoom/DeskGridManager';
import { buildEnvironment } from './3DRoom/environment';
import { assignParticipantsToDesks } from './3DRoom/Participants';
import { buildZones, type BuiltZonesInfo } from './3DRoom/zone';

type Props = { bottomSafeAreaPx?: number; topSafeAreaPx?: number; };

const DEG2RAD = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const norm = (v: any) => String(v ?? '');

// Bigger canvas; main room will be managed by zones
const ROOM_W = 48;
const ROOM_D = 34;

// ——— Name sprite (smaller) ———
function makeNameSpriteSmall(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const w = 512, h = 96; canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  ctx.font = 'bold 44px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText((text || 'User').slice(0, 24), w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set((0.7 * w) / h, 0.7, 1);
  return sprite;
}

// ——— Fallback initials texture ———
function makeCardTexture(name: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  const w = 512, h = 320; canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#2A2A2F'); grad.addColorStop(1, '#3A3A41');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  const initials = (name || 'User').trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'U';
  ctx.fillStyle = '#FE741F'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.font = 'bold 100px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(initials, w / 2, h / 2 + 6);
  const tx = new THREE.CanvasTexture(canvas); tx.minFilter = THREE.LinearFilter;
  return tx;
}

// ——— Circular mask for head-badge video ———
function makeCircularAlpha(size = 512): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = size / 2; g.clearRect(0, 0, size, size);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(r, r, r * 0.98, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}
const CIRCLE_ALPHA = makeCircularAlpha(512);

function makeVideoBadge(tex: THREE.VideoTexture): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(0.34, 0.34);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaMap: CIRCLE_ALPHA, transparent: true, toneMapped: false });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 2;
  m.name = 'VID_BADGE';
  return m;
}

// ——— A* helpers ———
type NavNode = { id: string; x: number; z: number };
type NavEdge = [string, string];
function dist2(a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz;
}
function aStar(nodes: NavNode[], edges: NavEdge[], startId: string, goalId: string) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const nbrs = new Map<string, string[]>();
  for (const [a, b] of edges) {
    if (!nbrs.has(a)) nbrs.set(a, []);
    if (!nbrs.has(b)) nbrs.set(b, []);
    nbrs.get(a)!.push(b);
    nbrs.get(b)!.push(a);
  }
  const g = new Map<string, number>(); g.set(startId, 0);
  const h = (id: string) => Math.sqrt(dist2(byId.get(id)!, byId.get(goalId)!));
  const f = new Map<string, number>(); f.set(startId, h(startId));
  const came = new Map<string, string>();
  const open = new Set<string>([startId]);
  while (open.size) {
    let current: string | null = null; let bestF = Infinity;
    for (const id of open) { const fi = f.get(id) ?? Infinity; if (fi < bestF) { bestF = fi; current = id; } }
    if (!current) break;
    if (current === goalId) {
      const path: string[] = [current];
      while (came.has(path[0])) path.unshift(came.get(path[0])!);
      return path;
    }
    open.delete(current);
    for (const nb of (nbrs.get(current) || [])) {
      const tentative = (g.get(current) ?? Infinity) + Math.sqrt(dist2(byId.get(current)!, byId.get(nb)!));
      if (tentative < (g.get(nb) ?? Infinity)) {
        came.set(nb, current);
        g.set(nb, tentative);
        f.set(nb, tentative + h(nb));
        open.add(nb);
      }
    }
  }
  return null;
}

const Meeting3D: React.FC<Props> = ({ bottomSafeAreaPx = 120, topSafeAreaPx = 96 }) => {
  const { participants, room } = useMeetingStore(useShallow((s) => ({ participants: s.participants, room: s.room })));
  const chatOpen = useMeetingStore((s) => s.chatOpen);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  const localSid = useMemo(() => {
    try {
      const rp: any = (room as any)?.localParticipant;
      return norm(rp?.sid ?? rp?.identity);
    } catch { return undefined; }
  }, [room]);

  // LiveKit
  const cameraRefs = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], { onlySubscribed: false });
  const screenRefs = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });

  // Scene
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef = useRef<number | null>(null);

  // Controls
  const avatarRef = useRef<THREE.Group | null>(null);
  const yawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0.25);
  const keyState = useRef<Record<string, boolean>>({});
  const cameraDistRef = useRef<number>(7.0);
  const targetDistRef = useRef<number>(7.0);

  // Auto-path
  const pathQueueRef = useRef<THREE.Vector3[]>([]);
  const autoGhostRef = useRef<boolean>(false);

  // Static env
  const stageScreenRef = useRef<THREE.Mesh | null>(null);
  const localDeskMonitorRef = useRef<THREE.Mesh | null>(null);
  const obstaclesRef = useRef<THREE.Box3[]>([]);
  const roomBoundsRef = useRef<{ minX: number; maxX: number; minZ: number; maxZ: number }>({ minX: -ROOM_W / 2 + 0.3, maxX: ROOM_W / 2 - 0.3, minZ: -ROOM_D / 2 + 0.3, maxZ: ROOM_D / 2 - 0.3 });

  // Desks / seating
  const deskPrefabRef = useRef<DeskPrefab | null>(null);
  const deskMgrRef = useRef<DeskGridManager | null>(null);
  const seatTransformsRef = useRef<SeatTransform[]>([]);
  const participantSeatMapRef = useRef<Map<string, number>>(new Map());
  const monitorPlanesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const avatarsGroupRef = useRef<THREE.Group | null>(null);
  const avatarBySidRef = useRef<Map<string, THREE.Group>>(new Map());

  // Zones/rooms
  const zonesInfoRef = useRef<BuiltZonesInfo | null>(null);
  const navNodesRef = useRef<NavNode[]>([]);
  const navEdgesRef = useRef<Array<[string, string]>>([]);
  const minimapHitsRef = useRef<Array<{ x: number; y: number; w: number; h: number; target?: THREE.Vector3; allowGhost?: boolean }>>([]);

  // Remote movement sync
  const remoteTargetsRef = useRef<Map<string, { pos: THREE.Vector3; yaw: number }>>(new Map());
  const speakingRef = useRef<Set<string>>(new Set());

  // Dice UI
  const diceMeshRef = useRef<THREE.Mesh | null>(null);
  const diceSpinRef = useRef<{ t: number; dur: number; targetEuler: THREE.Euler } | null>(null);
  const [insideGameRoom, setInsideGameRoom] = useState(false);

  // —— Scene build ——
  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    let scene = sceneRef.current; let renderer = rendererRef.current; let camera = cameraRef.current;
    if (!scene) { scene = new THREE.Scene(); scene.background = new THREE.Color(0x111419); sceneRef.current = scene; }
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
      renderer.setSize(container.clientWidth, container.clientHeight);
      rendererRef.current = renderer; container.appendChild(renderer.domElement);
    }
    if (!camera) {
      camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 800);
      camera.position.set(0, 2.2, 7.0);
      cameraRef.current = camera;
    }

    container.setAttribute('tabindex', '0');

    const { obstacles, stageScreen, localMonitor, disposeEnv } = buildEnvironment(scene, { ROOM_W, ROOM_D, carpet: makeCarpetTexture });
    obstaclesRef.current = obstacles;
    stageScreenRef.current = stageScreen;
    localDeskMonitorRef.current = localMonitor;

    const zones = buildZones(scene, { ROOM_W, ROOM_D });
    zonesInfoRef.current = zones;
    obstaclesRef.current.push(...zones.zoneColliders);
    if (zones.stageScreen) stageScreenRef.current = zones.stageScreen;
    diceMeshRef.current = scene.getObjectByName?.('GAME_ROOM_DICE') as THREE.Mesh | null;

    const prefab = createDeskModule();
    deskPrefabRef.current = prefab;

    const mgr = new DeskGridManager(scene, prefab, {
      bayCols: 5, bayRows: 2,
      deskGapX: 0.5, deskGapZ: 0.7,
      bayAisleX: 2.2, bayAisleZ: 2.4,
      startX: zones.openOfficeArea.minX + 2.0,
      startZ: zones.openOfficeArea.minZ + 1.8,
      maxWidth: (zones.openOfficeArea.maxX - zones.openOfficeArea.minX) - 2.0,
      maxDepth: (zones.openOfficeArea.maxZ - zones.openOfficeArea.minZ) - 1.8,
      faceYaw: Math.PI,
    });
    deskMgrRef.current = mgr;
    obstaclesRef.current.push(...mgr.colliders);

    const avatars = new THREE.Group(); avatarsGroupRef.current = avatars; scene.add(avatars);

    navNodesRef.current = zones.navNodes.map(n => ({ id: n.id, x: n.x, z: n.z }));
    navEdgesRef.current = zones.navEdges.map(e => [e[0], e[1]]);

    // INPUT
    const onResize = () => { if (!container || !renderer || !camera) return; const w = container.clientWidth; const h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    window.addEventListener('resize', onResize);

    const onKey = (e: KeyboardEvent) => {
      const code = e.code;
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract'];
      if (keys.includes(code)) { keyState.current[code] = e.type === 'keydown'; e.preventDefault(); }
      if (e.type === 'keydown') container.focus();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    window.addEventListener('keyup', onKey, { capture: true });

    // Mouse orbit/rotate
    let dragging = false, lastX = 0, lastY = 0, dragButton = 0;
    const onMouseDown = (e: MouseEvent) => { dragging = true; dragButton = e.button; lastX = e.clientX; lastY = e.clientY; container.focus(); };
    const onMouseUp = () => { dragging = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY;
      if (dragButton === 0) {
        yawRef.current -= dx * 0.2 * DEG2RAD;
        pitchRef.current = clamp(pitchRef.current - dy * 0.15 * DEG2RAD, -0.05, 0.8);
      } else if (dragButton === 2) {
        yawRef.current -= dx * 0.25 * DEG2RAD;
      }
    };
    const containerEl = container;
    containerEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    containerEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // Wheel zoom
    const onWheel = (e: WheelEvent) => { e.preventDefault(); container.focus(); const dir = Math.sign(e.deltaY); const step = 1.0; const next = targetDistRef.current + dir * step; targetDistRef.current = clamp(next, 1.6, 18.0); };
    containerEl.addEventListener('wheel', onWheel, { passive: false });

    // Double-click the big presentation screen => reset to “normal” view (no zoom tricks)
    const onDblClick = (e: MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
      const ray = new THREE.Raycaster(); const cam = cameraRef.current!; ray.setFromCamera(ndc, cam);
      const screen = stageScreenRef.current;
      if (!screen) return;
      const hits = ray.intersectObject(screen, true);
      if (hits && hits.length) {
        e.preventDefault();
        targetDistRef.current = cameraDistRef.current = 7.0;
        pitchRef.current = 0.25;
        // keep yaw as-is; user’s orientation shouldn’t jump
      }
    };
    containerEl.addEventListener('dblclick', onDblClick);

    // Minimap click (names => ghost through walls)
    const onMinimapClick = (e: MouseEvent) => {
      const canvas = minimapRef.current; if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      for (const h of minimapHitsRef.current) {
        if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
          if (h.target) { queuePathTo(h.target.x, h.target.z, !!h.allowGhost); return; }
        }
      }
    };
    minimapRef.current?.addEventListener('click', onMinimapClick);

    const queuePathTo = (tx: number, tz: number, allowGhost = false) => {
      const you = avatarRef.current; if (!you) return;
      autoGhostRef.current = allowGhost;

      const nodes = navNodesRef.current;
      if (!nodes.length) { pathQueueRef.current = [new THREE.Vector3(tx, 0, tz)]; return; }

      let startId = nodes[0].id, goalId = nodes[0].id;
      let bestS = Infinity, bestG = Infinity;
      for (const n of nodes) {
        const ds = dist2({ x: you.position.x, z: you.position.z }, n);
        if (ds < bestS) { bestS = ds; startId = n.id; }
        const dg = dist2({ x: tx, z: tz }, n);
        if (dg < bestG) { bestG = dg; goalId = n.id; }
      }
      const pathIds = aStar(nodes, navEdgesRef.current as any, startId!, goalId!);
      const idToNode = new Map(nodes.map(n => [n.id, n]));
      const queue: THREE.Vector3[] = [];
      if (pathIds) { for (const id of pathIds) { const n = idToNode.get(id)!; queue.push(new THREE.Vector3(n.x, 0, n.z)); } queue.push(new THREE.Vector3(tx, 0, tz)); }
      else { queue.push(new THREE.Vector3(tx, 0, tz)); }
      pathQueueRef.current = queue;
    };

    // Animation loop
    let lastT = performance.now();
    const animate = () => {
      const now = performance.now(); const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      const you = avatarRef.current; const cam = cameraRef.current!;
      if (you) {
        const speed = (keyState.current['ShiftLeft'] || keyState.current['ShiftRight']) ? 3.8 : 2.5;
        const yaw = yawRef.current;

        let vx = 0, vz = 0;
        const fwd = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw));
        const rgt = new THREE.Vector2(-fwd.y, fwd.x);
        const manualMove = (keyState.current['KeyW'] || keyState.current['ArrowUp'] || keyState.current['KeyS'] || keyState.current['ArrowDown'] || keyState.current['KeyA'] || keyState.current['ArrowLeft'] || keyState.current['KeyD'] || keyState.current['ArrowRight']);

        if (manualMove) { pathQueueRef.current = []; autoGhostRef.current = false; }
        if (keyState.current['KeyW'] || keyState.current['ArrowUp']) { vx += fwd.x; vz += fwd.y; }
        if (keyState.current['KeyS'] || keyState.current['ArrowDown']) { vx -= fwd.x; vz -= fwd.y; }
        if (keyState.current['KeyA'] || keyState.current['ArrowLeft']) { vx -= rgt.x; vz -= rgt.y; }
        if (keyState.current['KeyD'] || keyState.current['ArrowRight']) { vx += rgt.x; vz += rgt.y; }
        if (keyState.current['KeyQ']) { yawRef.current += 1.8 * dt; }
        if (keyState.current['KeyE']) { yawRef.current -= 1.8 * dt; }
        if (keyState.current['Equal'] || keyState.current['NumpadAdd']) { targetDistRef.current = clamp(targetDistRef.current - 2.5 * dt, 1.6, 18.0); }
        if (keyState.current['Minus'] || keyState.current['NumpadSubtract']) { targetDistRef.current = clamp(targetDistRef.current + 2.5 * dt, 1.6, 18.0); }

        // Follow queued path if not manually moving
        if (!manualMove && pathQueueRef.current.length) {
          const t = pathQueueRef.current[0];
          const dx = t.x - you.position.x;
          const dz = t.z - you.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.15) { pathQueueRef.current.shift(); if (!pathQueueRef.current.length) autoGhostRef.current = false; }
          else { vx = dx / d; vz = dz / d; }
        }

        // Apply movement
        const stepLen = ((vx || vz) ? speed : 0) * dt;
        if (vx !== 0 || vz !== 0) {
          const len = Math.hypot(vx, vz); vx /= len; vz /= len;
          const bounds = roomBoundsRef.current;

          if (autoGhostRef.current) {
            const nx = you.position.x + vx * stepLen;
            const nz = you.position.z + vz * stepLen;
            you.position.set(
              Math.min(bounds.maxX, Math.max(bounds.minX, nx)),
              you.position.y,
              Math.min(bounds.maxZ, Math.max(bounds.minZ, nz))
            );
          } else {
            const sub = Math.ceil(stepLen / 0.06);
            for (let i = 0; i < sub; i++) {
              const nx = you.position.x + vx * (stepLen / sub);
              const nz = you.position.z + vz * (stepLen / sub);
              const target = new THREE.Vector3(
                Math.min(bounds.maxX, Math.max(bounds.minX, nx)),
                you.position.y,
                Math.min(bounds.maxZ, Math.max(bounds.minZ, nz))
              );
              const youBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(target.x, 0.85, target.z), new THREE.Vector3(0.35, 1.6, 0.35));
              let blocked = false; for (const b of obstaclesRef.current) { if (b.intersectsBox(youBox)) { blocked = true; break; } }
              if (!blocked) { you.position.set(target.x, you.position.y, target.z); }
              else {
                const tryX = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(target.x, 0.85, you.position.z), new THREE.Vector3(0.35, 1.6, 0.35));
                const tryZ = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(you.position.x, 0.85, target.z), new THREE.Vector3(0.35, 1.6, 0.35));
                let okX = true; for (const b of obstaclesRef.current) { if (b.intersectsBox(tryX)) { okX = false; break; } }
                let okZ = true; for (const b of obstaclesRef.current) { if (b.intersectsBox(tryZ)) { okZ = false; break; } }
                if (okX) you.position.set(target.x, you.position.y, you.position.z);
                if (okZ) you.position.set(you.position.x, you.position.y, target.z);
              }
            }
          }
        }

        // Camera follow
        const zoomSpeed = 6.0; cameraDistRef.current += (targetDistRef.current - cameraDistRef.current) * Math.min(1, zoomSpeed * dt);
        const dist = cameraDistRef.current;
        const pitch = pitchRef.current; const yaw2 = yawRef.current;
        const off = new THREE.Vector3(Math.sin(yaw2) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw2) * Math.cos(pitch)).multiplyScalar(dist);
        cam.position.set(you.position.x + off.x, 1.2 + off.y, you.position.z + off.z);
        cam.lookAt(you.position.x, 1.2, you.position.z);

        // Broadcast movement
        try {
          if ((room as any)?.localParticipant?.publishData && (now % 200) < 16) {
            const payload = JSON.stringify({ t: 'pos', id: norm(localSid), x: you.position.x, y: you.position.y, z: you.position.z, yaw: yawRef.current });
            (room as any).localParticipant.publishData(new TextEncoder().encode(payload), { reliable: false });
          }
        } catch { }

        // Inside Game Room?
        const zinfo = zonesInfoRef.current;
        if (zinfo) {
          const gr = zinfo.meta.gameRect;
          const inside = you.position.x > gr.minX + 0.05 && you.position.x < gr.maxX - 0.05 && you.position.z > gr.minZ + 0.05 && you.position.z < gr.maxZ - 0.05;
          if (inside !== insideGameRoom) setInsideGameRoom(inside);
        }
      }

      // Ease remotes
      avatarBySidRef.current.forEach((g, sid) => {
        if (sid === norm(localSid)) return;
        const t = remoteTargetsRef.current.get(sid);
        if (!t) return;
        g.position.lerp(t.pos, 0.2);
        g.rotation.y += (t.yaw - g.rotation.y) * 0.15;
      });

      // Speaking glow
      avatarBySidRef.current.forEach((g, sid) => {
        const target = speakingRef.current.has(sid) ? 0.9 : 0.15;
        const torso = g.getObjectByName('TORSO') as THREE.Mesh | null;
        if (torso) {
          const m = torso.material as THREE.MeshStandardMaterial;
          m.emissiveIntensity += (target - m.emissiveIntensity) * 0.15;
        }
      });

      // Dice spin anim
      if (diceSpinRef.current && diceMeshRef.current) {
        const s = diceSpinRef.current; const dt2 = dt;
        s.t += dt2;
        const k = Math.min(1, s.t / s.dur);
        diceMeshRef.current.rotation.x += 10 * dt2 * (1 - k);
        diceMeshRef.current.rotation.y += 12 * dt2 * (1 - k);
        diceMeshRef.current.rotation.z += 8 * dt2 * (1 - k);
        if (k >= 1) {
          diceMeshRef.current.rotation.copy(s.targetEuler);
          diceSpinRef.current = null;
        }
      }

      // Render + minimap
      renderer!.render(scene!, cameraRef.current!);
      minimapHitsRef.current = [];
      drawMinimap(
        minimapRef.current,
        avatarRef.current?.position ?? new THREE.Vector3(),
        getSeatDotsForMinimap(),
        deskMgrRef.current,
        zonesInfoRef.current,
        minimapHitsRef.current
      );

      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    // LiveKit events
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.t === 'pos' && msg?.id) {
          const sid = norm(msg.id);
          if (sid === norm(localSid)) return;
          remoteTargetsRef.current.set(sid, { pos: new THREE.Vector3(msg.x, msg.y, msg.z), yaw: msg.yaw ?? 0 });
        }
      } catch { }
    };
    const onSpeakers = (speakers: any[]) => {
      const s = new Set<string>();
      speakers.forEach((sp) => { if (sp?.sid) s.add(norm(sp.sid)); });
      speakingRef.current = s;
    };
    (room as any)?.on?.(RoomEvent.DataReceived, onData);
    (room as any)?.on?.(RoomEvent.ActiveSpeakersChanged, onSpeakers);

    return () => {
      (room as any)?.off?.(RoomEvent.DataReceived, onData);
      (room as any)?.off?.(RoomEvent.ActiveSpeakersChanged, onSpeakers);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey, { capture: true } as any);
      window.removeEventListener('keyup', onKey, { capture: true } as any);
      containerEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      containerEl.removeEventListener('wheel', onWheel);
      containerEl.removeEventListener('dblclick', onDblClick);
      minimapRef.current?.removeEventListener('click', onMinimapClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      try { deskMgrRef.current?.dispose(); } catch { }
      try { zones.disposeZones?.(); } catch { }
      try { disposeEnv?.(); } catch { }

      try { renderer?.dispose(); if (renderer?.domElement?.parentElement === containerEl) containerEl.removeChild(renderer.domElement); } catch { }
      sceneRef.current = null; rendererRef.current = null; cameraRef.current = null; avatarsGroupRef.current = null; stageScreenRef.current = null; obstaclesRef.current = [];
      avatarRef.current = null; avatarBySidRef.current.clear();
      navNodesRef.current = []; navEdgesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // —— Robust de-dupe so you don’t get “You” + You ——
  // —— Robust de-dupe so we never get “You” + your name + another you —— //
  function getUniqueParticipants() {
    const arr = (participants || []) as any[];

    const localSidNorm = norm(localSid);
    const localIdentity = norm((room as any)?.localParticipant?.identity);
    const localKey = localSidNorm || localIdentity || '__local__';

    type Row = { id: string; name?: string; sid?: string; identity?: string; isLocal: boolean; score: number; };

    const rows: Row[] = arr.map((p) => {
      const sid = norm(p?.sid ?? p?.id);
      const identity = norm(p?.identity);
      const name = (p?.name || '').trim();
      const isLocal =
        sid === localSidNorm ||
        identity === localIdentity ||
        name.toLowerCase() === 'you';

      const key = isLocal ? localKey : (identity || sid || name || Math.random().toString(36).slice(2));
      const score = (isLocal ? 1000 : 0) + (identity ? 20 : 0) + (sid ? 10 : 0) + (name && name.toLowerCase() !== 'you' ? 1 : 0);

      return { id: key, name: isLocal ? (name || 'You') : name, sid, identity, isLocal, score };
    });

    // If LiveKit hasn't populated the participant list yet, fake the local row.
    if (!rows.length) rows.push({ id: localKey, name: 'You', sid: localSidNorm, identity: localIdentity, isLocal: true, score: 9999 });

    // Collapse duplicates by id, keep the best score.
    const byId = new Map<string, Row>();
    for (const r of rows) { const prev = byId.get(r.id); if (!prev || r.score > prev.score) byId.set(r.id, r); }

    // Make sure there is exactly one local row under localKey.
    const localRow = Array.from(byId.values()).find(r => r.isLocal) || { id: localKey, name: 'You', sid: localSidNorm, identity: localIdentity, isLocal: true, score: 9999 };
    // Re-key anything that still smells local to localKey
    for (const [k, r] of Array.from(byId.entries())) if (r.isLocal && k !== localKey) byId.delete(k);
    byId.set(localKey, localRow);

    // Final array (local first)
    const out: { id: string; name?: string }[] = [{ id: localKey, name: localRow.name || 'You' }];
    for (const r of byId.values()) if (!r.isLocal) out.push({ id: r.id, name: r.name });
    return out;
  }



  function getSeatDotsForMinimap() {
    const uniq = getUniqueParticipants();
    return uniq.map((p) => {
      const idx = participantSeatMapRef.current.get(p.id);
      if (idx == null) return null;
      const s = seatTransformsRef.current[idx];
      return { x: s.position.x, z: s.position.z, name: p.name, sid: p.id };
    }).filter(Boolean) as Array<{ x: number; z: number; name?: string; sid: string }>;
  }

  // Participants → desks/avatars/video (includes LOCAL only once)
  useEffect(() => {
    const scene = sceneRef.current; const avatars = avatarsGroupRef.current;
    const mgr = deskMgrRef.current; const prefab = deskPrefabRef.current;
    if (!scene || !avatars || !mgr || !prefab) return;

    const uniq = getUniqueParticipants();

    const targetDeskCount = Math.max(12, uniq.length + 8);
    seatTransformsRef.current = mgr.ensureDeskCount(targetDeskCount);

    participantSeatMapRef.current = assignParticipantsToDesks(
      uniq,
      participantSeatMapRef.current,
      seatTransformsRef.current.length
    );

    // Clear previous avatars
    avatarBySidRef.current.forEach(g => {
      g.traverse((o: any) => {
        o.geometry?.dispose?.();
        if (o.material) { const m = o.material; Array.isArray(m) ? m.forEach((mm: any) => mm.dispose?.()) : m.dispose?.(); }
      });
      avatars.remove(g);
    });
    avatarBySidRef.current.clear();

    let localAvatarSet = false;

    for (const p of uniq) {
      const sid = p.id;
      const seatIdx = participantSeatMapRef.current.get(sid);
      if (seatIdx == null) continue;
      const seat = seatTransformsRef.current[seatIdx];

      const g = new THREE.Group();
      g.position.copy(seat.position);
      g.rotation.y = seat.yaw;

      // was: const isLocal = sid === norm(localSid);
      const isLocal =
        sid === norm(localSid) ||
        sid === norm((room as any)?.localParticipant?.identity) ||
        (p.name || '').trim().toLowerCase() === 'you';
      const bodyColor = isLocal ? 0x3D93F8 : 0x8a8af0;
      const skinColor = isLocal ? 0xe6edf7 : 0xf2f2f2;

      const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.18, 0.6, 6, 12),
        new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.15, roughness: 0.6, emissive: 0x0b111f, emissiveIntensity: 0.15 })
      );
      torso.name = 'TORSO';
      torso.position.set(0, 1.0, 0); torso.castShadow = true; g.add(torso);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 18, 12),
        new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.35 })
      );
      head.position.set(0, 1.55, 0); head.castShadow = true; head.name = 'HEAD'; g.add(head);

      const armMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.12, roughness: 0.55 });
      const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
      const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-0.26, 1.1, 0); armL.rotation.z = 0.15; g.add(armL);
      const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(0.26, 1.1, 0); armR.rotation.z = -0.15; g.add(armR);

      const legMat = new THREE.MeshStandardMaterial({ color: 0x35353c, metalness: 0.08, roughness: 0.7 });
      const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8);
      const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.11, 0.55, 0.04); g.add(legL);
      const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(0.11, 0.55, 0.04); g.add(legR);

      const label = makeNameSpriteSmall(p.name || 'User'); label.position.set(0, 1.92, 0); g.add(label);

      // per-seat monitor plane
      let mon = monitorPlanesRef.current.get(seatIdx);
      if (!mon) {
        mon = new THREE.Mesh(new THREE.PlaneGeometry(prefab.monitorW, prefab.monitorH), new THREE.MeshBasicMaterial({ color: 0x111111, toneMapped: false }));
        monitorPlanesRef.current.set(seatIdx, mon);
      }
      mon.position.set(0, 0.85, -0.36);
      g.add(mon);

      avatars.add(g);
      avatarBySidRef.current.set(sid, g);

      if (isLocal && !localAvatarSet) {
        avatarRef.current = g;
        localAvatarSet = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, localSid]);

  // Video textures: stage + local desk + seat monitors + head badges
  useEffect(() => {
    const screenMesh = stageScreenRef.current;
    if (screenMesh) {
      (screenMesh.material as any) = new THREE.MeshBasicMaterial({ color: 0x111111 });
      for (const ref of screenRefs) {
        if (!isTrackReference(ref)) continue; const track: any = ref?.publication?.track; if (!track) continue;
        const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.autoplay = true; try { track.attach(el); el.play?.().catch(() => { }); } catch { }
        const tex = new THREE.VideoTexture(el); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; (tex as any).colorSpace = (THREE as any).SRGBColorSpace ?? undefined;
        (screenMesh.material as any) = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        break;
      }
    }

    // Local desk monitor
    const localMon = localDeskMonitorRef.current;
    if (localMon) {
      let appliedLocal = false;
      for (const ref of cameraRefs) {
        if (!isTrackReference(ref)) continue;
        const sid: string = norm(((ref as any)?.participant?.sid ?? (ref as any)?.participant?.identity));
        if (!sid || sid !== norm(localSid)) continue;
        const track: any = ref?.publication?.track; if (!track) continue;
        const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.autoplay = true; try { track.attach(el); el.play?.().catch(() => { }); } catch { }
        const tex = new THREE.VideoTexture(el); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; (tex as any).colorSpace = (THREE as any).SRGBColorSpace ?? undefined;
        (localMon.material as any) = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); appliedLocal = true; break;
      }
      if (!appliedLocal) { (localMon.material as any) = new THREE.MeshBasicMaterial({ map: makeCardTexture('You'), toneMapped: false }); }
    }

    const camTexBySid = new Map<string, THREE.VideoTexture>();
    for (const ref of cameraRefs) {
      if (!isTrackReference(ref)) continue;
      const track: any = ref?.publication?.track; if (!track) continue;

      const sid = norm((ref as any)?.participant?.sid);
      const identity = norm((ref as any)?.participant?.identity);

      const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.autoplay = true;
      try { track.attach(el); el.play?.().catch(() => { }); } catch { }
      const tex = new THREE.VideoTexture(el);
      tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; (tex as any).colorSpace = (THREE as any).SRGBColorSpace ?? undefined;

      if (sid) camTexBySid.set(sid, tex);
      if (identity) camTexBySid.set(identity, tex); // <- lets our de-duped IDs resolve either way
    }

    // Apply to monitors + head badges
    const seatMap = participantSeatMapRef.current;
    const monitors = monitorPlanesRef.current;
    const uniq = getUniqueParticipants();
    for (const p0 of uniq) {
      const sid = p0.id;
      const idx = seatMap.get(sid);
      if (idx != null) {
        const plane = monitors.get(idx);
        if (plane) {
          const mat = plane.material as THREE.MeshBasicMaterial;
          if (mat.map) { mat.map.dispose?.(); mat.map = undefined as any; }
          const t = camTexBySid.get(sid);
          if (t) { mat.map = t; mat.toneMapped = false; mat.needsUpdate = true; }
          else { mat.map = makeCardTexture(p0.name || 'User'); mat.toneMapped = false; mat.needsUpdate = true; }
        }
      }
      const g = avatarBySidRef.current.get(sid);
      if (!g) continue;
      const prev = g.getObjectByName('VID_BADGE'); if (prev) g.remove(prev);
      const t2 = camTexBySid.get(sid);
      if (t2) {
        const badge = makeVideoBadge(t2);
        const head = g.getObjectByName('HEAD') as THREE.Mesh | undefined;
        if (head) badge.position.copy(head.position).add(new THREE.Vector3(0, 0.02, 0.02));
        else badge.position.set(0, 1.55, 0.02);
        g.add(badge);
      }
    }

    return () => { for (const tex of camTexBySid.values()) { try { tex.dispose(); } catch { } } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRefs, screenRefs, participants, localSid]);

  // Dice button action
  const rollDice = () => {
    const dice = diceMeshRef.current; if (!dice) return;
    const face = 1 + Math.floor(Math.random() * 6);
    const targets: Record<number, THREE.Euler> = {
      1: new THREE.Euler(0, 0, 0),
      2: new THREE.Euler(0, Math.PI / 2, 0),
      3: new THREE.Euler(-Math.PI / 2, 0, 0),
      4: new THREE.Euler(Math.PI / 2, 0, 0),
      5: new THREE.Euler(0, -Math.PI / 2, 0),
      6: new THREE.Euler(Math.PI, 0, 0),
    };
    diceSpinRef.current = { t: 0, dur: 0.9, targetEuler: targets[face] || new THREE.Euler() };
  };

  // Layout resize
  useEffect(() => {
    const container = containerRef.current; const renderer = rendererRef.current; const camera = cameraRef.current;
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth; const h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }, [chatOpen, bottomSafeAreaPx, topSafeAreaPx]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="relative mx-auto h-full w-full"
        style={{ paddingTop: topSafeAreaPx, paddingBottom: bottomSafeAreaPx, paddingRight: chatOpen ? 408 : undefined }}
      />
      <canvas ref={minimapRef} width={300} height={300} className="absolute right-4 bottom-4 rounded-lg border border-[#26272B] bg-[#18181B]/80" style={{ zIndex: 5 }} />
      <div className="absolute left-4 bottom-[94px] text-white/70 text-xs bg-[#00000066] px-2 py-1 rounded">
        LMB: orbit • RMB: rotate • WASD move • Q/E rotate • +/− zoom • dbl-click screen = reset view • click names on minimap (ghost)
      </div>

      {insideGameRoom && (
        <button
          onClick={rollDice}
          className="absolute left-4 bottom-4 text-sm rounded-lg px-3 py-2"
          style={{ background: '#2b2f3b', color: '#d9f99d', border: '1px solid #3b3f4b' }}
        >
          🎲 Roll Dice
        </button>
      )}
    </div>
  );
};

// ——— Minimap ———
function drawMinimap(
  canvas: HTMLCanvasElement | null,
  youPos: THREE.Vector3,
  remotes: Array<{ x: number; z: number; name?: string; sid: string }>,
  mgr: DeskGridManager | null,
  zones: BuiltZonesInfo | null,
  hits: Array<{ x: number; y: number; w: number; h: number; target?: THREE.Vector3; allowGhost?: boolean }>
) {
  if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
  const W = canvas.width, H = canvas.height; ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#14171e'; ctx.fillRect(0, 0, W, H);
  const pad = 16; const rw = W - pad * 2, rh = H - pad * 2;
  const toMap = (x: number, z: number) => ({ X: pad + ((x + ROOM_W / 2) / ROOM_W) * rw, Y: pad + ((z + ROOM_D / 2) / ROOM_D) * rh });

  ctx.strokeStyle = '#2f2f36'; ctx.lineWidth = 2; ctx.strokeRect(pad, pad, rw, rh);

  if (zones) {
    ctx.lineWidth = 1;
    for (const r of zones.roomRects) {
      const a = toMap(r.rect.minX, r.rect.minZ), b = toMap(r.rect.maxX, r.rect.maxZ);
      ctx.strokeStyle = '#3a4050';
      ctx.strokeRect(a.X, a.Y, (b.X - a.X), (b.Y - a.Y));
      ctx.fillStyle = '#9fb3ff';
      ctx.font = '10px system-ui';
      ctx.fillText(r.name, a.X + 3, a.Y + 2);
    }
    ctx.fillStyle = '#86ffe7';
    for (const d of zones.doorways) { const p = toMap(d.x, d.z); ctx.beginPath(); ctx.arc(p.X, p.Y, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#7fffd4';
    ctx.font = '10px system-ui';
    for (const lm of zones.landmarks) {
      const p = toMap(lm.x, lm.z); ctx.beginPath(); ctx.arc(p.X, p.Y, 3, 0, Math.PI * 2); ctx.fill();
      const label = `• ${lm.name}`;
      ctx.fillStyle = '#c8ffe6'; ctx.fillText(label, p.X + 6, p.Y - 2);
      const met = ctx.measureText(label);
      hits.push({ x: p.X + 6, y: p.Y - 10, w: met.width + 4, h: 14, target: new THREE.Vector3(lm.x, 0, lm.z), allowGhost: false });
      ctx.fillStyle = '#7fffd4';
    }
  }

  if (mgr) {
    ctx.fillStyle = '#242a34';
    for (const r of mgr.bayRects) { const a = toMap(r.minX, r.minZ), b = toMap(r.maxX, r.maxZ); ctx.fillRect(a.X, a.Y, (b.X - a.X), (b.Y - a.Y)); }
    ctx.strokeStyle = '#3a4050'; ctx.setLineDash([6, 4]);
    for (const a of mgr.aisleLines) { const p1 = toMap(a.x1, a.z1), p2 = toMap(a.x2, a.z2); ctx.beginPath(); ctx.moveTo(p1.X, p1.Y); ctx.lineTo(p2.X, p2.Y); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  // Stage strip
  const st = toMap(0, -ROOM_D / 2 + 3.2); ctx.fillStyle = '#2c2f39'; ctx.fillRect(st.X - 60, st.Y - 18, 120, 36);

  // Others + name hitboxes (ghost mode)
  ctx.font = '10px system-ui'; ctx.textBaseline = 'top';
  for (const r of remotes) {
    const p = toMap(r.x, r.z);
    ctx.fillStyle = '#8a8af0'; ctx.beginPath(); ctx.arc(p.X, p.Y, 3, 0, Math.PI * 2); ctx.fill();
    if (r.name) {
      const text = r.name.slice(0, 18);
      ctx.fillStyle = '#cfd6ff'; ctx.fillText(text, p.X + 5, p.Y + 4);
      const metrics = ctx.measureText(text);
      hits.push({ x: p.X + 5, y: p.Y + 4, w: metrics.width + 4, h: 12, target: new THREE.Vector3(r.x, 0, r.z), allowGhost: true });
    }
  }

  // You
  const yp = toMap(youPos.x, youPos.z); ctx.fillStyle = '#3D93F8'; ctx.beginPath(); ctx.arc(yp.X, yp.Y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#cfe6ff'; ctx.fillText('You', yp.X + 6, yp.Y + 5);
}

function makeCarpetTexture(): THREE.Texture {
  const size = 256; const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#23252b'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2; const step = 64;
  for (let x = 0; x <= size; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
  for (let y = 0; y <= size; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(10, 10); tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export default Meeting3D;
