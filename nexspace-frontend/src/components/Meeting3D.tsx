import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTracks, isTrackReference } from '@livekit/components-react';
import { RoomEvent, Track } from 'livekit-client';
import { useMeetingStore } from '../stores/meetingStore';
import { useShallow } from 'zustand/react/shallow';
import { DeskGridManager, type SeatTransform } from './3DRoom/DeskGridManager';
import { assignParticipantsToDesks } from './3DRoom/Participants';
import { type DeskPrefab, createDeskModule } from './3DRoom/Desks';
import { buildEnvironment } from './3DRoom/Environment';
import { type BuiltZonesInfo, buildZones } from './3DRoom/Zone';

type Props = { bottomSafeAreaPx?: number; topSafeAreaPx?: number; };

const DEG2RAD = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const norm = (v: any) => String(v ?? '');

// Bigger canvas; main room will be managed by zones
const ROOM_W = 48;
const ROOM_D = 34;

// --- Global 3D cache to speed up re-mounts (switching back to 3D) ---
type SceneCache = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  zonesInfo: BuiltZonesInfo | null;
  obstacles: THREE.Box3[];
  stageScreen: THREE.Mesh | null;
  deskMgr: DeskGridManager | null;
  avatarsGroup: THREE.Group | null;
  avatarBySid: Map<string, THREE.Group>;
  seatTransforms: SeatTransform[];
  participantSeatMap: Map<string, number>;
  monitorPlanes: Map<number, THREE.Mesh>;
  roomLabels: THREE.Sprite[];
  diceMesh: THREE.Mesh | null;
  // camera/view state
  yaw: number;
  pitch: number;
  camTarget: THREE.Vector3;
  cameraDist: number;
  targetDist: number;
  viewMode: 'first-person' | 'third-person';
};

let GLOBAL_SCENE_CACHE: SceneCache | null = null;

// --- Movement tuning ---
const BASE_WALK_SPEED = 10.2;     // was ~2.5
const SPRINT_MULT = 1.75;         // hold Shift
const AUTO_PATH_SPEED = 6.8;      // for queued click-to-move
const TURN_SPEED = 2.4;     // Q/E yaw (rad/s), was ~1.8

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
type NavGraph = {
  nodeById: Map<string, NavNode>;
  neighbors: Map<string, Array<{ id: string; cost: number }>>;
};
function dist2(a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz;
}
function buildNavGraph(nodes: NavNode[], edges: NavEdge[]): NavGraph {
  const nodeById = new Map<string, NavNode>();
  const neighbors = new Map<string, Array<{ id: string; cost: number }>>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
    neighbors.set(n.id, []);
  }
  for (const [a, b] of edges) {
    const na = nodeById.get(a);
    const nb = nodeById.get(b);
    if (!na || !nb) continue;
    const cost = Math.sqrt(dist2(na, nb));
    neighbors.get(a)!.push({ id: b, cost });
    neighbors.get(b)!.push({ id: a, cost });
  }
  return { nodeById, neighbors };
}
type HeapNode = { id: string; g: number; f: number };
class MinHeap<T> {
  private data: T[];
  private compare: (a: T, b: T) => number;
  constructor(compare: (a: T, b: T) => number) {
    this.data = [];
    this.compare = compare;
  }
  push(item: T) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }
  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }
  get size() {
    return this.data.length;
  }
  private bubbleUp(index: number) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.data[index], this.data[parent]) >= 0) return;
      [this.data[index], this.data[parent]] = [this.data[parent], this.data[index]];
      index = parent;
    }
  }
  private bubbleDown(index: number) {
    const n = this.data.length;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < n && this.compare(this.data[left], this.data[smallest]) < 0) smallest = left;
      if (right < n && this.compare(this.data[right], this.data[smallest]) < 0) smallest = right;
      if (smallest === index) return;
      [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
      index = smallest;
    }
  }
}
function findPath(graph: NavGraph | null, startId: string, goalId: string): string[] | null {
  if (!graph) return null;
  if (startId === goalId) return [startId];
  const { nodeById, neighbors } = graph;
  const startNode = nodeById.get(startId);
  const goalNode = nodeById.get(goalId);
  if (!startNode || !goalNode) return null;
  const open = new MinHeap<HeapNode>((a, b) => a.f - b.f);
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, string>();
  gScore.set(startId, 0);
  open.push({ id: startId, g: 0, f: Math.sqrt(dist2(startNode, goalNode)) });
  while (open.size) {
    const current = open.pop()!;
    const currentBest = gScore.get(current.id);
    if (currentBest === undefined || current.g > currentBest + 1e-6) continue;
    if (current.id === goalId) {
      const path = [current.id];
      while (cameFrom.has(path[0])) {
        path.unshift(cameFrom.get(path[0])!);
      }
      return path;
    }
    for (const nb of neighbors.get(current.id) || []) {
      const tentativeG = current.g + nb.cost;
      if (tentativeG >= (gScore.get(nb.id) ?? Infinity) - 1e-6) continue;
      cameFrom.set(nb.id, current.id);
      gScore.set(nb.id, tentativeG);
      const target = nodeById.get(nb.id)!;
      const heuristic = Math.sqrt(dist2(target, goalNode));
      open.push({ id: nb.id, g: tentativeG, f: tentativeG + heuristic });
    }
  }
  return null;
}
// ——— Path visualization ———
function createPathLine(points: THREE.Vector3[]): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0x4a90e2,
    transparent: true,
    opacity: 0.8,
    linewidth: 3
  });
  return new THREE.Line(geometry, material);
}

const Meeting3D: React.FC<Props> = ({ bottomSafeAreaPx = 120, topSafeAreaPx = 96 }) => {
  const { participants, room } = useMeetingStore(useShallow((s) => ({ participants: s.participants, room: s.room })));
  const chatOpen = useMeetingStore((s) => s.chatOpen);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  // FIXED: More robust local participant detection
  const localSid = useMemo(() => {
    try {
      const rp: any = (room as any)?.localParticipant;
      return norm(rp?.sid ?? rp?.identity ?? '');
    } catch { return ''; }
  }, [room]);

  // LiveKit
  const cameraRefs = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], { onlySubscribed: false });
  const screenRefs = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });

  // Scene
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rafRef = useRef<number | null>(null);

  // View mode state
  const viewModeRef = useRef<'first-person' | 'third-person'>('third-person');
  const [currentViewMode, setCurrentViewMode] = useState<'first-person' | 'third-person'>('third-person');

  // Controls
  const avatarRef = useRef<THREE.Group | null>(null);
  const yawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0.25);
  const keyState = useRef<Record<string, boolean>>({});
  const cameraDistRef = useRef<number>(7.0);
  const targetDistRef = useRef<number>(7.0);
  const scrollMoveRef = useRef<number>(0);

  // Tuning refs: speed multiplier + always-sprint
  const speedMultRef = useRef<number>(1.0);
  const [speedMultUI, setSpeedMultUI] = useState(1.0);
  const alwaysSprintRef = useRef<boolean>(false);
  const [alwaysSprintUI, setAlwaysSprintUI] = useState(false);

  // NEW: independent camera target & pan/follow lock
  const camTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.2, 0));
  const isPanningRef = useRef<boolean>(false);
  const followLockRef = useRef<boolean>(false); // locks view after a pan until movement/rotate or explicit reset

  // Camera transition state (smooth switch between modes)
  const camTransitionRef = useRef<
    | null
    | {
      toMode: 'first-person' | 'third-person';
      t0: number;
      dur: number;
      startPos: THREE.Vector3;
      startQuat: THREE.Quaternion;
      endPos: THREE.Vector3;
      endQuat: THREE.Quaternion;
    }
  >(null);

  // Auto-path with visualization
  const pathQueueRef = useRef<THREE.Vector3[]>([]);
  const autoGhostRef = useRef<boolean>(false);
  const pathLineRef = useRef<THREE.Line | null>(null);

  // Static env
  const stageScreenRef = useRef<THREE.Mesh | null>(null);
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
  const navGraphRef = useRef<NavGraph | null>(null);
  const minimapHitsRef = useRef<Array<{ x: number; y: number; w: number; h: number; target?: THREE.Vector3; allowGhost?: boolean; roomName?: string }>>([]);
  const roomLabelsRef = useRef<THREE.Sprite[]>([]);

  // Remote movement sync
  const remoteTargetsRef = useRef<Map<string, { pos: THREE.Vector3; yaw: number }>>(new Map());
  const speakingRef = useRef<Set<string>>(new Set());

  // Dice UI
  const diceMeshRef = useRef<THREE.Mesh | null>(null);
  const diceSpinRef = useRef<{ t: number; dur: number; targetEuler: THREE.Euler } | null>(null);
  const [insideGameRoom, setInsideGameRoom] = useState(false);

  // —— LiveKit data send guard (NEW) ——
  const canSendDataRef = useRef<boolean>(false);
  const lastDataSentAtRef = useRef<number>(0);

  // Toggle view mode function
  const startCamTransition = (toMode: 'first-person' | 'third-person') => {
    const sceneCam = cameraRef.current;
    const you = avatarRef.current;
    if (!sceneCam || !you) {
      // Fallback: just set mode if camera/avatar not ready
      viewModeRef.current = toMode;
      setCurrentViewMode(toMode);
      return;
    }
    const newMode = toMode;

    // Compute target transforms for both modes using current yaw/pitch/dist/target
    const dist = cameraDistRef.current;
    const pitch = pitchRef.current;
    const yaw2 = yawRef.current;
    const tgt = camTargetRef.current.clone();

    // Third-person desired camera transform
    const thirdPos = (() => {
      const off = new THREE.Vector3(
        Math.sin(yaw2) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw2) * Math.cos(pitch)
      ).multiplyScalar(dist);
      return new THREE.Vector3(tgt.x + off.x, 1.2 + off.y, tgt.z + off.z);
    })();
    const thirdQuat = (() => {
      const q = new THREE.Quaternion();
      const look = new THREE.Vector3(tgt.x, 1.2, tgt.z);
      const m = new THREE.Matrix4();
      m.lookAt(thirdPos, look, new THREE.Vector3(0, 1, 0));
      // camera looks down -Z, but Matrix4.lookAt builds view matrix; extract rotation by inverting
      const rot = new THREE.Matrix4().copy(m).invert();
      q.setFromRotationMatrix(rot);
      return q;
    })();

    // First-person desired camera transform
    const firstPos = new THREE.Vector3(you.position.x, 1.55, you.position.z);
    const firstQuat = (() => {
      const q = new THREE.Quaternion();
      // build direction from yaw/pitch
      const dir = new THREE.Vector3(
        -Math.sin(yaw2) * Math.cos(pitch),
        -Math.sin(pitch),
        -Math.cos(yaw2) * Math.cos(pitch)
      ).normalize();
      const look = new THREE.Vector3().addVectors(firstPos, dir);
      const m = new THREE.Matrix4();
      m.lookAt(firstPos, look, new THREE.Vector3(0, 1, 0));
      const rot = new THREE.Matrix4().copy(m).invert();
      q.setFromRotationMatrix(rot);
      return q;
    })();

    // Setup transition from current camera transform to target (1s)
    const startPos = sceneCam.position.clone();
    const startQuat = sceneCam.quaternion.clone();
    const endPos = newMode === 'first-person' ? firstPos : thirdPos;
    const endQuat = newMode === 'first-person' ? firstQuat : thirdQuat;

    camTransitionRef.current = {
      toMode: newMode,
      t0: performance.now(),
      dur: 1000,
      startPos,
      startQuat,
      endPos,
      endQuat,
    };

    viewModeRef.current = newMode;
    setCurrentViewMode(newMode);
  };

  const toggleViewMode = () => {
    const newMode = viewModeRef.current === 'first-person' ? 'third-person' : 'first-person';
    startCamTransition(newMode);
  };

  // —— Scene build (ONLY ONCE) —— 
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Prevent duplicate initialization in StrictMode
    if (sceneRef.current && rendererRef.current && cameraRef.current) {
      return;
    }

    let scene = sceneRef.current;
    let renderer = rendererRef.current;
    let camera = cameraRef.current;

    // If a cached scene exists, rehydrate from it for instant switch
    if (GLOBAL_SCENE_CACHE) {
      scene = GLOBAL_SCENE_CACHE.scene;
      renderer = GLOBAL_SCENE_CACHE.renderer;
      camera = GLOBAL_SCENE_CACHE.camera;
      zonesInfoRef.current = GLOBAL_SCENE_CACHE.zonesInfo;
      obstaclesRef.current = GLOBAL_SCENE_CACHE.obstacles;
      stageScreenRef.current = GLOBAL_SCENE_CACHE.stageScreen;
      deskMgrRef.current = GLOBAL_SCENE_CACHE.deskMgr;
      avatarsGroupRef.current = GLOBAL_SCENE_CACHE.avatarsGroup;
      avatarBySidRef.current = GLOBAL_SCENE_CACHE.avatarBySid;
      seatTransformsRef.current = GLOBAL_SCENE_CACHE.seatTransforms;
      participantSeatMapRef.current = GLOBAL_SCENE_CACHE.participantSeatMap;
      monitorPlanesRef.current = GLOBAL_SCENE_CACHE.monitorPlanes;
      roomLabelsRef.current = GLOBAL_SCENE_CACHE.roomLabels;
      diceMeshRef.current = GLOBAL_SCENE_CACHE.diceMesh;
      yawRef.current = GLOBAL_SCENE_CACHE.yaw;
      pitchRef.current = GLOBAL_SCENE_CACHE.pitch;
      camTargetRef.current.copy(GLOBAL_SCENE_CACHE.camTarget);
      cameraDistRef.current = GLOBAL_SCENE_CACHE.cameraDist;
      targetDistRef.current = GLOBAL_SCENE_CACHE.targetDist;
      viewModeRef.current = GLOBAL_SCENE_CACHE.viewMode;
      setCurrentViewMode(GLOBAL_SCENE_CACHE.viewMode);

      // Restore local avatar ref promptly so controls work immediately
      const maybeLocal = avatarBySidRef.current.get('__LOCAL__') || avatarBySidRef.current.get(norm(localSid));
      if (maybeLocal) {
        avatarRef.current = maybeLocal;
      }

      // Ensure no stale transition blocks input after remount
      camTransitionRef.current = null;

      // Attach renderer DOM to current container and resize
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
      renderer.setSize(container.clientWidth, container.clientHeight);
      if (renderer.domElement.parentElement !== container) {
        try { renderer.domElement.parentElement?.removeChild(renderer.domElement); } catch { }
        container.appendChild(renderer.domElement);
      }

      sceneRef.current = scene;
      rendererRef.current = renderer;
      cameraRef.current = camera;
    }

    if (!scene && !GLOBAL_SCENE_CACHE) {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x111419);
      sceneRef.current = scene;
    }

    if (!renderer) {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
        renderer.setSize(container.clientWidth, container.clientHeight);
        rendererRef.current = renderer;
        container.appendChild(renderer.domElement);
      } catch (webglError) {
        console.warn('WebGL initialization failed:', webglError);
        // Show fallback message
        const fallback = document.createElement('div');
        fallback.style.cssText = `
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #111419;
          color: white;
          font-family: system-ui;
          text-align: center;
          padding: 20px;
        `;
        fallback.innerHTML = `
          <div>
            <h3>3D View Unavailable</h3>
            <p>WebGL is not supported or has been disabled in your browser.</p>
            <p>Try refreshing the page or enabling hardware acceleration.</p>
          </div>
        `;
        container.appendChild(fallback);
        return;
      }
    }

    if (!camera) {
      camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 800);
      camera.position.set(0, 2.2, 7.0);
      cameraRef.current = camera;
    }

    container.setAttribute('tabindex', '0');

    // Build static environment if not cached
    if (!GLOBAL_SCENE_CACHE) {
      const env = buildEnvironment(scene!, { ROOM_W, ROOM_D });
      obstaclesRef.current = env.obstacles;
      stageScreenRef.current = env.stageScreen;
    }

    if (!GLOBAL_SCENE_CACHE) {
      const zones = buildZones(scene!, { ROOM_W, ROOM_D });
      zonesInfoRef.current = zones;
      obstaclesRef.current.push(...zones.zoneColliders);
      if (zones.stageScreen) stageScreenRef.current = zones.stageScreen;
      if (zones.roomLabels) roomLabelsRef.current = zones.roomLabels;
      diceMeshRef.current = scene!.getObjectByName?.('GAME_ROOM_DICE') as THREE.Mesh | null;
    }

    if (!GLOBAL_SCENE_CACHE) {
      const prefab = createDeskModule();
      deskPrefabRef.current = prefab;

      const zones = zonesInfoRef.current!;
      const mgr = new DeskGridManager(scene!, prefab, {
        bayCols: 5, bayRows: 2,
        deskGapX: 1.5, deskGapZ: 1.7,
        bayAisleX: 2.2, bayAisleZ: 2.4,
        startX: zones.openOfficeArea.minX - 2.0,
        startZ: zones.openOfficeArea.minZ - 5.0,
        maxWidth: (zones.openOfficeArea.maxX - zones.openOfficeArea.minX) - 2.0,
        maxDepth: (zones.openOfficeArea.maxZ - zones.openOfficeArea.minZ) - 1.8,
        faceYaw: Math.PI,
      });
      deskMgrRef.current = mgr;
      obstaclesRef.current.push(...mgr.colliders);
    }

    if (!GLOBAL_SCENE_CACHE) {
      const avatars = new THREE.Group();
      avatarsGroupRef.current = avatars;
      scene!.add(avatars);
    }

    if (zonesInfoRef.current) {
      navNodesRef.current = zonesInfoRef.current.navNodes.map(n => ({ id: n.id, x: n.x, z: n.z }));
      const edges = zonesInfoRef.current.navEdges as NavEdge[];
      navGraphRef.current = buildNavGraph(navNodesRef.current, edges);
    }

    // Enhanced pathfinding function with visualization
    const queuePathTo = (tx: number, tz: number, allowGhost = false, roomName?: string) => {
      const you = avatarRef.current;
      if (!you) return;

      // Clear existing path line
      if (pathLineRef.current) {
        scene!.remove(pathLineRef.current);
        pathLineRef.current.geometry.dispose();
        (pathLineRef.current.material as THREE.Material).dispose();
        pathLineRef.current = null;
      }

      autoGhostRef.current = allowGhost;

      const nodes = navNodesRef.current;
      if (!nodes.length) {
        pathQueueRef.current = [new THREE.Vector3(tx, 0, tz)];
        return;
      }

      // Find best start and goal nodes
      let startId = nodes[0].id, goalId = nodes[0].id;
      let bestS = Infinity, bestG = Infinity;

      // If a room name is provided, prefer goal nodes inside that room's rect
      const zinfo = zonesInfoRef.current;
      let targetRect: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;
      if (roomName && zinfo) {
        const rr = zinfo.roomRects.find(r => r.name === roomName);
        if (rr) targetRect = rr.rect;
      }

      const isPointClear = (x: number, z: number) => {
        const box = new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(x, 0.85, z),
          new THREE.Vector3(0.42, 1.6, 0.42)
        );
        for (const ob of obstaclesRef.current) {
          if (ob.intersectsBox(box)) return false;
        }
        return true;
      };

      let bestInsideSafeId: string | null = null; let bestInsideSafeD = Infinity;
      let bestInsideAnyId: string | null = null; let bestInsideAnyD = Infinity;
      let bestOverallSafeId: string | null = null; let bestOverallSafeD = Infinity;
      let bestOverallAnyId: string | null = null; let bestOverallAnyD = Infinity;
      let lockedGoalId: string | null = null;

      for (const n of nodes) {
        const ds = dist2({ x: you.position.x, z: you.position.z }, n);
        if (ds < bestS) { bestS = ds; startId = n.id; }
        const dg = dist2({ x: tx, z: tz }, n);
        // Track best overall for fallback
        if (isPointClear(n.x, n.z) && dg < bestOverallSafeD) { bestOverallSafeD = dg; bestOverallSafeId = n.id; }
        if (dg < bestOverallAnyD) { bestOverallAnyD = dg; bestOverallAnyId = n.id; }

        if (targetRect) {
          const inside = (n.x >= targetRect.minX && n.x <= targetRect.maxX && n.z >= targetRect.minZ && n.z <= targetRect.maxZ);
          if (inside) {
            if (dg < bestInsideAnyD) { bestInsideAnyD = dg; bestInsideAnyId = n.id; }
            if (isPointClear(n.x, n.z) && dg < bestInsideSafeD) { bestInsideSafeD = dg; bestInsideSafeId = n.id; }
          }
        } else {
          if (dg < bestG) { bestG = dg; goalId = n.id; }
        }
      }
      // Prefer safe inside-room node; else any inside-room node; else use doorway-nearest; else safest overall
      if (targetRect) {
        if (bestInsideSafeId) {
          goalId = bestInsideSafeId;
          lockedGoalId = goalId;
        } else if (bestInsideAnyId) {
          goalId = bestInsideAnyId;
          lockedGoalId = goalId;
        } else {
          // Try doorways that belong to this room (touching its edges)
          const doors = (zinfo?.doorways || []).filter(d => {
            const eps = 0.8;
            const onXEdge = (Math.abs(d.x - targetRect.minX) <= eps || Math.abs(d.x - targetRect.maxX) <= eps) && (d.z >= targetRect.minZ - eps && d.z <= targetRect.maxZ + eps);
            const onZEdge = (Math.abs(d.z - targetRect.minZ) <= eps || Math.abs(d.z - targetRect.maxZ) <= eps) && (d.x >= targetRect.minX - eps && d.x <= targetRect.maxX + eps);
            const inside = d.x >= targetRect.minX - eps && d.x <= targetRect.maxX + eps && d.z >= targetRect.minZ - eps && d.z <= targetRect.maxZ + eps;
            return onXEdge || onZEdge || inside;
          });
          if (doors.length) {
            let bestDoorNode: { id: string; d: number } | null = null;
            for (const n of nodes) {
              if (!isPointClear(n.x, n.z)) continue;
              let md = Infinity;
              for (const d of doors) {
                const dd = Math.hypot(n.x - d.x, n.z - d.z);
                if (dd < md) md = dd;
              }
              if (md < (bestDoorNode?.d ?? Infinity)) bestDoorNode = { id: n.id, d: md };
            }
            if (bestDoorNode) {
              goalId = bestDoorNode.id;
              lockedGoalId = goalId;
            } else if (bestOverallSafeId) {
              goalId = bestOverallSafeId;
              lockedGoalId = goalId;
            } else if (bestOverallAnyId) {
              goalId = bestOverallAnyId;
              lockedGoalId = goalId;
            }
          } else if (bestOverallSafeId) {
            goalId = bestOverallSafeId;
            lockedGoalId = goalId;
          } else if (bestOverallAnyId) {
            goalId = bestOverallAnyId;
            lockedGoalId = goalId;
          }
        }
      }
      // Final safety: always bias to the node nearest to the requested target
      // This restores previous behavior and prevents drifting to other rooms
      if (lockedGoalId) {
        goalId = lockedGoalId;
      } else {
        let nearestId = goalId;
        let nearestD = Infinity;
        for (const n of nodes) {
          const d2 = dist2({ x: tx, z: tz }, n);
          if (d2 < nearestD) { nearestD = d2; nearestId = n.id; }
        }
        goalId = nearestId;
      }
      // Calculate path using cached nav graph
      const pathIds = findPath(navGraphRef.current, startId!, goalId!);
      const idToNode = new Map(nodes.map(n => [n.id, n]));
      const queue: THREE.Vector3[] = [];
      const visualPath: THREE.Vector3[] = [];

      // Add current position as start of visual path
      visualPath.push(you.position.clone());
      visualPath[0].y = 0.1; // Slightly above ground

      if (pathIds && pathIds.length) {
        pathIds.forEach((id, idx) => {
          const node = idToNode.get(id);
          if (!node) return;
          const nodePos = new THREE.Vector3(node.x, 0, node.z);
          const vizPos = new THREE.Vector3(node.x, 0.1, node.z);
          if (idx === 0) {
            const distToStart = Math.hypot(nodePos.x - you.position.x, nodePos.z - you.position.z);
            if (distToStart > 0.4) {
              queue.push(nodePos.clone());
            }
            visualPath.push(vizPos);
          } else {
            queue.push(nodePos.clone());
            visualPath.push(vizPos);
          }
        });
      }
      // Ensure the final queued node is clear; if not, step backwards to a clear one
      if (queue.length) {
        for (let i = queue.length - 1; i >= 0; i--) {
          const q = queue[i];
          if (isPointClear(q.x, q.z)) { queue.splice(i + 1); break; }
          if (i === 0) { /* none clear; keep as-is */ }
        }
      }

      // Decide whether to include a final hop to the exact target
      const finalPos = new THREE.Vector3(tx, 0, tz);
      const targetViz = new THREE.Vector3(tx, 0.1, tz);
      visualPath.push(targetViz);

      const hasClearPath = (a: THREE.Vector3, b: THREE.Vector3) => {
        // sample along segment and check avatar box vs obstacles
        const steps = 20;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const x = a.x + (b.x - a.x) * t;
          const z = a.z + (b.z - a.z) * t;
          const box = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, 0.85, z),
            new THREE.Vector3(0.35, 1.6, 0.35)
          );
          for (const ob of obstaclesRef.current) {
            if (ob.intersectsBox(box)) return false;
          }
        }
        return true;
      };

      // If we have a path: consider adding final exact point (only when not risky)
      if (queue.length) {
        const last = queue[queue.length - 1];
        if (!allowGhost && hasClearPath(last, finalPos)) {
          queue.push(finalPos.clone());
        }
        // when allowGhost, we intentionally stop at last nav node to avoid spawning inside furniture
      } else {
        // No path from A* (disconnected or same node)
        if (allowGhost) {
          // Route to nearest nav node to the target instead of the exact center to avoid furniture
          let best: NavNode | null = null; let bd = Infinity;
          for (const n of nodes) {
            const d2 = dist2({ x: tx, z: tz }, n);
            if (d2 < bd && isPointClear(n.x, n.z)) { bd = d2; best = n; }
          }
          if (best) {
            queue.push(new THREE.Vector3(best.x, 0, best.z));
            visualPath.push(new THREE.Vector3(best.x, 0.1, best.z));
          } else {
            queue.push(finalPos.clone());
          }
        } else {
          // normal case: try direct
          queue.push(finalPos.clone());
        }
      }

      pathQueueRef.current = queue;

      // Create visual path line
      if (visualPath.length > 1) {
        pathLineRef.current = createPathLine(visualPath);
        scene!.add(pathLineRef.current);

        // Remove path line after a delay or when reaching destination
        setTimeout(() => {
          const sc = sceneRef.current;
          if (pathLineRef.current && sc) {
            sc.remove(pathLineRef.current);
            pathLineRef.current.geometry.dispose();
            (pathLineRef.current.material as THREE.Material).dispose();
            pathLineRef.current = null;
          }
        }, 15000); // Remove after 15 seconds
      }

      if (roomName) {
        console.log(`Navigating to ${roomName}...`);
      }
    };

    // INPUT
    const onResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const onKey = (e: KeyboardEvent) => {
      const code = e.code;
      const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'KeyV', 'BracketLeft', 'BracketRight'];
      if (keys.includes(code)) {
        keyState.current[code] = e.type === 'keydown';
        e.preventDefault();
      }

      // Toggle view mode with 'V' key
      if (e.type === 'keydown' && code === 'KeyV') {
        toggleViewMode();
      }

      // Adjust walk speed with [ and ]
      if (e.type === 'keydown' && code === 'BracketLeft') {
        const next = Math.max(0.5, Math.round((speedMultRef.current - 0.1) * 10) / 10);
        speedMultRef.current = next;
        setSpeedMultUI(next);
      }
      if (e.type === 'keydown' && code === 'BracketRight') {
        const next = Math.min(3.0, Math.round((speedMultRef.current + 0.1) * 10) / 10);
        speedMultRef.current = next;
        setSpeedMultUI(next);
      }

      if (e.type === 'keydown') container.focus();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    window.addEventListener('keyup', onKey, { capture: true });

    // Mouse orbit / rotate / pan
    let dragging = false, lastX = 0, lastY = 0, dragButton = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (camTransitionRef.current) return; // ignore new drags during transition
      dragging = true;
      dragButton = e.button;      // 0=LMB, 1=MMB, 2=RMB
      isPanningRef.current = (dragButton === 1 || dragButton === 2);
      if (isPanningRef.current) followLockRef.current = true; // lock view after we start panning
      lastX = e.clientX; lastY = e.clientY;
      container.focus();
    };

    const onMouseUp = () => {
      dragging = false;
      isPanningRef.current = false; // keep follow locked until movement/rotate
    };

    const onMouseMove = (e: MouseEvent) => {
      if (camTransitionRef.current) return; // ignore orbit/pan during transition
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;

      if (dragButton === 0) {
        // LMB = orbit
        yawRef.current -= dx * 0.2 * DEG2RAD;
        pitchRef.current = clamp(pitchRef.current - dy * 0.15 * DEG2RAD, -0.05, 0.8);
      } else if (dragButton === 1 || dragButton === 2) {
        // MMB or RMB = PAN (Miro/Figma style) - only in third-person mode
        if (viewModeRef.current === 'third-person') {
          const cam = cameraRef.current;
          if (!cam) return;

          // Pan amount scales with distance so it feels natural
          const dist = cameraDistRef.current;
          const k = 0.0018 * dist;

          // Camera's forward & right projected to ground plane (XZ)
          const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
          const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
          const fwdXZ = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right).normalize();

          // Move the camera TARGET (not the avatar)
          camTargetRef.current.addScaledVector(right, -dx * k);
          camTargetRef.current.addScaledVector(fwdXZ, dy * k);

          // Clamp target to room bounds
          const b = roomBoundsRef.current;
          camTargetRef.current.x = clamp(camTargetRef.current.x, b.minX, b.maxX);
          camTargetRef.current.z = clamp(camTargetRef.current.z, b.minZ, b.maxZ);
        }
      }
    };

    const containerEl = container;
    containerEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    containerEl.addEventListener('contextmenu', (e) => e.preventDefault());

    // Wheel zoom - only in third-person mode
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      container.focus();
      if (camTransitionRef.current) return; // ignore input during transition

      if (viewModeRef.current === 'third-person') {
        const dir = Math.sign(e.deltaY);
        const step = 1.0;
        const next = targetDistRef.current + dir * step;
        targetDistRef.current = clamp(next, 1.6, 32.0);
      } else if (viewModeRef.current === 'first-person') {
        const modeFactor = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1;
        const delta = e.deltaY * modeFactor;
        const move = THREE.MathUtils.clamp(-delta * 0.004, -3, 3);
        if (move !== 0) {
          scrollMoveRef.current += move;
          pathQueueRef.current = [];
          autoGhostRef.current = false;
          const sc = sceneRef.current;
          if (pathLineRef.current && sc) {
            sc.remove(pathLineRef.current);
            pathLineRef.current.geometry.dispose();
            (pathLineRef.current.material as THREE.Material).dispose();
            pathLineRef.current = null;
          }
        }
      }
    };
    containerEl.addEventListener('wheel', onWheel, { passive: false });

    // Single click for room navigation, double-click the big presentation screen => reset & recenter
    const onClick = (e: MouseEvent) => {
      // Don't navigate if we're dragging
      if (dragging) return;

      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      );

      const ray = new THREE.Raycaster();
      const cam = cameraRef.current!;
      ray.setFromCamera(ndc, cam);

      // Check for room label clicks
      const roomLabels = roomLabelsRef.current;
      if (roomLabels.length > 0) {
        const labelHits = ray.intersectObjects(roomLabels);
        if (labelHits.length > 0) {
          const hitLabel = labelHits[0].object as THREE.Sprite;
          const roomData = (hitLabel as any).userData;
          if (roomData && roomData.roomName && roomData.centerX !== undefined && roomData.centerZ !== undefined) {
            queuePathTo(roomData.centerX, roomData.centerZ, false, roomData.roomName);
            e.preventDefault();
            return;
          }
        }
      }
    };

    // Mouse move for hover cursor
    const onMouseMoveHover = (e: MouseEvent) => {
      if (dragging) return;

      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      );

      const ray = new THREE.Raycaster();
      const cam = cameraRef.current!;
      ray.setFromCamera(ndc, cam);

      // Check if hovering over room labels
      const roomLabels = roomLabelsRef.current;
      let isHoveringLabel = false;

      if (roomLabels.length > 0) {
        const labelHits = ray.intersectObjects(roomLabels);
        if (labelHits.length > 0) {
          isHoveringLabel = true;
        }
      }

      // Update cursor
      container.style.cursor = isHoveringLabel ? 'pointer' : 'default';
    };

    const onDblClick = (e: MouseEvent) => {
      if (camTransitionRef.current) return; // ignore recenter during transition
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
      const ray = new THREE.Raycaster();
      const cam = cameraRef.current!;
      ray.setFromCamera(ndc, cam);
      const screen = stageScreenRef.current;
      if (!screen) return;
      const hits = ray.intersectObject(screen, true);
      if (hits && hits.length) {
        e.preventDefault();
        if (viewModeRef.current === 'third-person') {
          targetDistRef.current = cameraDistRef.current = 7.0;
          pitchRef.current = 0.25;
          // keep yaw as-is

          // Re-center camera target on your avatar for convenience
          if (avatarRef.current) {
            camTargetRef.current.copy(avatarRef.current.position);
            camTargetRef.current.y = 1.2;
          }

          // Release follow lock when explicitly recentering
          followLockRef.current = false;
        }
      }
    };

    containerEl.addEventListener('click', onClick);
    containerEl.addEventListener('mousemove', onMouseMoveHover);
    containerEl.addEventListener('dblclick', onDblClick);

    // Minimap click (names => ghost through walls, rooms => smart pathfinding)
    const onMinimapClick = (e: MouseEvent) => {
      const canvas = minimapRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      for (const h of minimapHitsRef.current) {
        if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
          if (h.target) {
            queuePathTo(h.target.x, h.target.z, !!h.allowGhost, h.roomName);
            return;
          }
        }
      }
    };
    const onMinimapMove = (e: MouseEvent) => {
      const canvas = minimapRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let hoveringRoom = false;
      for (const h of minimapHitsRef.current) {
        if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
          if (h.roomName) { hoveringRoom = true; break; }
        }
      }
      canvas.style.cursor = hoveringRoom ? 'pointer' : 'default';
    };
    minimapRef.current?.addEventListener('click', onMinimapClick);
    minimapRef.current?.addEventListener('mousemove', onMinimapMove);

    // Animation loop
    let lastT = performance.now();
    const animate = () => {
      // Don't run animation if WebGL failed
      if (!renderer || !scene || !camera) {
        return;
      }

      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const you = avatarRef.current;
      const cam = cameraRef.current!;

      // Ensure avatar ref exists after rehydrate
      if (!you) {
        const found = avatarBySidRef.current.get('__LOCAL__') || avatarBySidRef.current.get(norm(localSid));
        if (found) avatarRef.current = found;
      }

      if (avatarRef.current) {
        const you = avatarRef.current;
        const isSprinting = alwaysSprintRef.current || keyState.current['ShiftLeft'] || keyState.current['ShiftRight'];
        const yaw = yawRef.current;

        let vx = 0, vz = 0;
        const fwd = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw));
        const rgt = new THREE.Vector2(-fwd.y, fwd.x);
        const viewMode = viewModeRef.current;
        const manualKeyMove = (
          keyState.current['KeyW'] || keyState.current['ArrowUp'] ||
          keyState.current['KeyS'] || keyState.current['ArrowDown'] ||
          keyState.current['KeyA'] || keyState.current['ArrowLeft'] ||
          keyState.current['KeyD'] || keyState.current['ArrowRight']
        );
        const hasScroll = viewMode === 'first-person' && Math.abs(scrollMoveRef.current) > 0.0001;
        const manualMove = manualKeyMove || hasScroll;
        const rotating = keyState.current['KeyQ'] || keyState.current['KeyE'];
        const autoPathing = pathQueueRef.current.length > 0;
        const speed =
          (autoPathing ? AUTO_PATH_SPEED : BASE_WALK_SPEED) *
          (isSprinting ? SPRINT_MULT : 1) *
          speedMultRef.current;

        if (manualMove) {
          pathQueueRef.current = [];
          autoGhostRef.current = false;
          // Clear path line when manually moving
          if (pathLineRef.current) {
            scene.remove(pathLineRef.current);
            pathLineRef.current.geometry.dispose();
            (pathLineRef.current.material as THREE.Material).dispose();
            pathLineRef.current = null;
          }
        }

        if (keyState.current['KeyW'] || keyState.current['ArrowUp']) { vx += fwd.x; vz += fwd.y; }
        if (keyState.current['KeyS'] || keyState.current['ArrowDown']) { vx -= fwd.x; vz -= fwd.y; }
        if (keyState.current['KeyA'] || keyState.current['ArrowLeft']) { vx -= rgt.x; vz -= rgt.y; }
        if (keyState.current['KeyD'] || keyState.current['ArrowRight']) { vx += rgt.x; vz += rgt.y; }
        if (keyState.current['KeyQ']) { yawRef.current += TURN_SPEED * dt; }
        if (keyState.current['KeyE']) { yawRef.current -= TURN_SPEED * dt; }

        // Only allow zoom in third-person mode (and not during camera transition)
        if (viewMode === 'third-person' && !camTransitionRef.current) {
          if (keyState.current['Equal'] || keyState.current['NumpadAdd']) { targetDistRef.current = clamp(targetDistRef.current - 2.5 * dt, 1.6, 18.0); }
          if (keyState.current['Minus'] || keyState.current['NumpadSubtract']) { targetDistRef.current = clamp(targetDistRef.current + 2.5 * dt, 1.6, 32.0); }
        }

        // Follow queued path if not manually moving
        if (!manualMove && pathQueueRef.current.length) {
          const t = pathQueueRef.current[0];
          const dx = t.x - you.position.x;
          const dz = t.z - you.position.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.25) {
            pathQueueRef.current.shift();
            if (!pathQueueRef.current.length) {
              // If we were ghosting, ensure we end up at a safe, non-colliding spot
              if (autoGhostRef.current) {
                const isCollidingAt = (p: THREE.Vector3) => {
                  const box = new THREE.Box3().setFromCenterAndSize(
                    new THREE.Vector3(p.x, 0.85, p.z),
                    new THREE.Vector3(0.35, 1.6, 0.35)
                  );
                  for (const ob of obstaclesRef.current) if (ob.intersectsBox(box)) return true;
                  return false;
                };
                if (isCollidingAt(you.position)) {
                  // Try nearest nav node to current position first
                  let best: NavNode | null = null; let bd = Infinity;
                  for (const n of navNodesRef.current) {
                    const d2 = dist2({ x: you.position.x, z: you.position.z }, n);
                    if (d2 < bd) { bd = d2; best = n; }
                  }
                  if (best) {
                    const cand = new THREE.Vector3(best.x, you.position.y, best.z);
                    if (!isCollidingAt(cand)) you.position.copy(cand);
                  }
                  // If still colliding, sample a small radial neighborhood
                  if (isCollidingAt(you.position)) {
                    const radii = [0.2, 0.35, 0.5, 0.8, 1.0];
                    let fixed = false;
                    for (const r of radii) {
                      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                        const cand = new THREE.Vector3(
                          you.position.x + Math.cos(a) * r,
                          you.position.y,
                          you.position.z + Math.sin(a) * r
                        );
                        const b = roomBoundsRef.current;
                        cand.x = clamp(cand.x, b.minX, b.maxX);
                        cand.z = clamp(cand.z, b.minZ, b.maxZ);
                        if (!isCollidingAt(cand)) { you.position.copy(cand); fixed = true; break; }
                      }
                      if (fixed) break;
                    }
                  }
                }
              }

              autoGhostRef.current = false;
              // Clear path line when destination reached
              if (pathLineRef.current) {
                scene.remove(pathLineRef.current);
                pathLineRef.current.geometry.dispose();
                (pathLineRef.current.material as THREE.Material).dispose();
                pathLineRef.current = null;
              }
            }
          } else {
            vx = dx / d;
            vz = dz / d;
          }
        }

        // Apply movement
        const stepLen = ((vx || vz) ? speed : 0) * dt;
        if (vx !== 0 || vz !== 0) {
          const len = Math.hypot(vx, vz);
          vx /= len;
          vz /= len;
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
              let blocked = false;
              for (const b of obstaclesRef.current) {
                if (b.intersectsBox(youBox)) {
                  blocked = true;
                  break;
                }
              }
              if (!blocked) {
                you.position.set(target.x, you.position.y, target.z);
              } else {
                const tryX = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(target.x, 0.85, you.position.z), new THREE.Vector3(0.35, 1.6, 0.35));
                const tryZ = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(you.position.x, 0.85, target.z), new THREE.Vector3(0.35, 1.6, 0.35));
                let okX = true;
                for (const b of obstaclesRef.current) {
                  if (b.intersectsBox(tryX)) {
                    okX = false;
                    break;
                  }
                }
                let okZ = true;
                for (const b of obstaclesRef.current) {
                  if (b.intersectsBox(tryZ)) {
                    okZ = false;
                    break;
                  }
                }
                if (okX) you.position.set(target.x, you.position.y, you.position.z);
                if (okZ) you.position.set(you.position.x, you.position.y, target.z);
              }
            }
          }
        }

        if (viewMode === 'first-person') {
          const pending = scrollMoveRef.current;
          if (Math.abs(pending) > 0.0001) {
            const maxStep = speed * dt;
            const step = THREE.MathUtils.clamp(pending, -maxStep, maxStep);
            scrollMoveRef.current -= step;
            const bounds = roomBoundsRef.current;
            const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
            forward.normalize();
            const target = new THREE.Vector3(
              you.position.x + forward.x * step,
              you.position.y,
              you.position.z + forward.z * step
            );
            const youBox = new THREE.Box3().setFromCenterAndSize(
              new THREE.Vector3(target.x, 0.85, target.z),
              new THREE.Vector3(0.35, 1.6, 0.35)
            );
            let blocked = false;
            for (const b of obstaclesRef.current) {
              if (b.intersectsBox(youBox)) {
                blocked = true;
                break;
              }
            }
            if (!blocked) {
              you.position.set(
                Math.min(bounds.maxX, Math.max(bounds.minX, target.x)),
                you.position.y,
                Math.min(bounds.maxZ, Math.max(bounds.minZ, target.z))
              );
            } else {
              scrollMoveRef.current = 0;
            }
          }
        } else if (scrollMoveRef.current !== 0) {
          scrollMoveRef.current = 0;
        }

        // Camera behavior - Modified for view modes
        const zoomSpeed = 6.0;
        cameraDistRef.current += (targetDistRef.current - cameraDistRef.current) * Math.min(1, zoomSpeed * dt);
        const dist = cameraDistRef.current;
        const pitch = pitchRef.current;
        const yaw2 = yawRef.current;

        // If user starts moving/rotating/auto-pathing while follow is locked (after pan),
        // immediately snap target back to avatar and unlock follow.
        if (followLockRef.current && (manualMove || rotating || autoPathing)) {
          camTargetRef.current.set(you.position.x, 1.2, you.position.z);
          followLockRef.current = false;
        }

        // Smoothly follow avatar when NOT actively panning and NOT locked
        if (you && !isPanningRef.current && !followLockRef.current) {
          const follow = new THREE.Vector3(you.position.x, 1.2, you.position.z);
          camTargetRef.current.lerp(follow, 0.14);
        }

        const tgt = camTargetRef.current;
        const targetY = 1.2;

        const trans = camTransitionRef.current;
        if (trans) {
          const now = performance.now();
          const k = Math.min(1, (now - trans.t0) / trans.dur);
          // easeInOutCubic
          const s = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

          // Interpolate position and rotation
          cam.position.lerpVectors(trans.startPos, trans.endPos, s);
          cam.quaternion.slerpQuaternions(trans.startQuat, trans.endQuat, s);

          // Manage local avatar visibility during transition
          if (trans.toMode === 'first-person') {
            // Keep avatar visible for most of the move-in, hide near the end
            you.visible = s < 0.85;
          } else {
            // Ensure avatar is visible when pulling back
            you.visible = true;
          }

          if (k >= 1) {
            // Finish transition
            camTransitionRef.current = null;
            // Ensure final visibility matches mode
            you.visible = viewModeRef.current === 'third-person';
          }
        } else if (viewMode === 'first-person') {
          // First-person mode: Camera at avatar's head position
          const headHeight = 1.55; // Same as the head mesh position
          cam.position.set(you.position.x, headHeight, you.position.z);

          // Look direction based on yaw and pitch
          const lookDir = new THREE.Vector3(
            -Math.sin(yaw2) * Math.cos(pitch),
            -Math.sin(pitch),
            -Math.cos(yaw2) * Math.cos(pitch)
          );

          const lookTarget = new THREE.Vector3().addVectors(cam.position, lookDir);
          cam.lookAt(lookTarget);

          // Hide the local avatar in first-person mode
          you.visible = false;
        } else {
          // Third-person mode: Original camera behavior
          const off = new THREE.Vector3(
            Math.sin(yaw2) * Math.cos(pitch),
            Math.sin(pitch),
            Math.cos(yaw2) * Math.cos(pitch)
          ).multiplyScalar(dist);

          cam.position.set(tgt.x + off.x, targetY + off.y, tgt.z + off.z);
          cam.lookAt(tgt.x, targetY, tgt.z);

          // Show the local avatar in third-person mode
          you.visible = true;
        }

        // Inside Game Room?
        const zinfo = zonesInfoRef.current;
        if (zinfo) {
          const gr = zinfo.meta.gameRect;
          const inside = you.position.x > gr.minX + 0.05 && you.position.x < gr.maxX - 0.05 && you.position.z > gr.minZ + 0.05 && you.position.z < gr.maxZ - 0.05;
          if (inside !== insideGameRoom) setInsideGameRoom(inside);
        }
      } else {
        // No local avatar yet; still advance any pending camera transition
        const cam = cameraRef.current!;
        const trans = camTransitionRef.current;
        if (trans) {
          const now = performance.now();
          const k = Math.min(1, (now - trans.t0) / trans.dur);
          const s = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          cam.position.lerpVectors(trans.startPos, trans.endPos, s);
          cam.quaternion.slerpQuaternions(trans.startQuat, trans.endQuat, s);
          if (k >= 1) {
            camTransitionRef.current = null;
          }
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
        const s = diceSpinRef.current;
        const dt2 = dt;
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

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey, { capture: true } as any);
      window.removeEventListener('keyup', onKey, { capture: true } as any);
      containerEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      containerEl.removeEventListener('mousemove', onMouseMoveHover);
      containerEl.removeEventListener('wheel', onWheel);
      containerEl.removeEventListener('click', onClick);
      containerEl.removeEventListener('dblclick', onDblClick);
      minimapRef.current?.removeEventListener('click', onMinimapClick);
      minimapRef.current?.removeEventListener('mousemove', onMinimapMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      // Preserve scene/renderer in a global cache for fast remount
      if (sceneRef.current && rendererRef.current && cameraRef.current) {
        GLOBAL_SCENE_CACHE = {
          scene: sceneRef.current,
          renderer: rendererRef.current,
          camera: cameraRef.current as THREE.PerspectiveCamera,
          zonesInfo: zonesInfoRef.current,
          obstacles: obstaclesRef.current,
          stageScreen: stageScreenRef.current,
          deskMgr: deskMgrRef.current,
          avatarsGroup: avatarsGroupRef.current,
          avatarBySid: avatarBySidRef.current,
          seatTransforms: seatTransformsRef.current,
          participantSeatMap: participantSeatMapRef.current,
          monitorPlanes: monitorPlanesRef.current,
          roomLabels: roomLabelsRef.current,
          diceMesh: diceMeshRef.current,
          yaw: yawRef.current,
          pitch: pitchRef.current,
          camTarget: camTargetRef.current.clone(),
          cameraDist: cameraDistRef.current,
          targetDist: targetDistRef.current,
          viewMode: viewModeRef.current,
        };
        // Detach canvas but do not dispose
        try {
          if (rendererRef.current.domElement?.parentElement === containerEl) {
            containerEl.removeChild(rendererRef.current.domElement);
          }
        } catch { }
      }

      // Reset transient refs only
      rafRef.current = null;
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      avatarRef.current = null;
      navNodesRef.current = [];
      navGraphRef.current = null;
      canSendDataRef.current = false;
    };
  }, []); // NO DEPENDENCIES - scene built only once

  // —— LiveKit event handling (separate effect) ——
  useEffect(() => {
    if (!room) return;

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

    // —— Connection state -> allow/deny data sends ——
    const onConn = (state: any) => {
      canSendDataRef.current = String(state) === 'connected';
      if (!canSendDataRef.current) {
        // ensure we don't immediately try to send again
        lastDataSentAtRef.current = performance.now();
      }
    };

    // initialize once
    canSendDataRef.current = String((room as any)?.state) === 'connected';

    (room as any)?.on?.(RoomEvent.DataReceived, onData);
    (room as any)?.on?.(RoomEvent.ActiveSpeakersChanged, onSpeakers);
    (room as any)?.on?.(RoomEvent.ConnectionStateChanged, onConn);

    return () => {
      (room as any)?.off?.(RoomEvent.DataReceived, onData);
      (room as any)?.off?.(RoomEvent.ActiveSpeakersChanged, onSpeakers);
      (room as any)?.off?.(RoomEvent.ConnectionStateChanged, onConn);
    };
  }, [room, localSid]);

  // —— Movement broadcasting (separate effect) ——
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const broadcastMovement = () => {
      const you = avatarRef.current;
      if (!you || !canSendDataRef.current) return;

      try {
        const lkRoom: any = room as any;
        if (lkRoom?.localParticipant?.publishData) {
          const payload = JSON.stringify({
            t: 'pos',
            id: norm(localSid),
            x: you.position.x,
            y: you.position.y,
            z: you.position.z,
            yaw: yawRef.current
          });

          // IMPORTANT: handle async rejection to avoid "Uncaught (in promise)"
          void lkRoom.localParticipant
            .publishData(new TextEncoder().encode(payload), { reliable: false })
            .catch(() => { /* swallow when disconnected/reconnecting */ });
        }
      } catch { /* no-op */ }
    };

    // Broadcast at ~6fps instead of in animation loop
    intervalId = setInterval(broadcastMovement, 160);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [room, localSid]);

  // —— FIXED: Robust de-dupe so you don't get "You" + duplicate participants —— 
  function getUniqueParticipants() {
    const arr = (participants || []) as any[];

    // Get local participant info more reliably
    const localParticipant = (room as any)?.localParticipant;
    const localSidNorm = norm(localSid);
    const localIdentityNorm = norm(localParticipant?.identity);
    const localNameNorm = norm(localParticipant?.name).toLowerCase();

    type Row = {
      id: string;
      name?: string;
      sid?: string;
      identity?: string;
      isLocal: boolean;
      score: number;
    };

    const rows: Row[] = [];
    const seenKeys = new Set<string>();

    // Process each participant
    for (const p of arr) {
      const sid = norm(p?.sid ?? p?.id);
      const identity = norm(p?.identity);
      const name = norm(p?.name);
      const nameLower = name.toLowerCase();

      // Determine if this is the local participant
      const isLocal = Boolean(
        (sid && sid === localSidNorm) ||
        (identity && identity === localIdentityNorm) ||
        (name && (nameLower === localNameNorm || nameLower === 'you'))
      );

      // Create unique key - prioritize identity over sid for stability
      const key = isLocal
        ? '__LOCAL__'
        : (identity || sid || name || `unknown_${Math.random()}`);

      // Skip if we've already processed this participant
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      // Calculate score for deduplication priority
      const score =
        (isLocal ? 1000 : 0) +
        (identity ? 100 : 0) +
        (sid ? 50 : 0) +
        (name && nameLower !== 'you' ? 10 : 0);

      rows.push({
        id: key,
        name: isLocal ? 'You' : (name || 'User'),
        sid,
        identity,
        isLocal,
        score
      });
    }

    // Ensure we always have a local participant
    const hasLocal = rows.some(r => r.isLocal);
    if (!hasLocal) {
      rows.unshift({
        id: '__LOCAL__',
        name: 'You',
        sid: localSidNorm,
        identity: localIdentityNorm,
        isLocal: true,
        score: 9999
      });
    }

    // Sort: local first, then by score (highest first)
    rows.sort((a, b) => {
      if (a.isLocal && !b.isLocal) return -1;
      if (!a.isLocal && b.isLocal) return 1;
      return b.score - a.score;
    });

    return rows.map(r => ({ id: r.id, name: r.name }));
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
    const scene = sceneRef.current;
    const avatars = avatarsGroupRef.current;
    const mgr = deskMgrRef.current;
    const prefab = deskPrefabRef.current;
    if (!scene || !avatars || !mgr || !prefab) return;

    const uniq = getUniqueParticipants();

    const targetDeskCount = Math.max(10, uniq.length + 8);
    seatTransformsRef.current = mgr.ensureDeskCount(targetDeskCount);

    // Update seat assignments
    participantSeatMapRef.current = assignParticipantsToDesks(
      uniq,
      participantSeatMapRef.current,
      seatTransformsRef.current.length
    );

    // Track existing avatars to avoid recreating them
    const existingAvatars = new Set(avatarBySidRef.current.keys());
    const currentParticipants = new Set(uniq.map(p => p.id));

    // Remove avatars for participants who left
    for (const sid of existingAvatars) {
      if (!currentParticipants.has(sid)) {
        const avatar = avatarBySidRef.current.get(sid);
        if (avatar) {
          avatar.traverse((o: any) => {
            o.geometry?.dispose?.();
            if (o.material) {
              const m = o.material;
              Array.isArray(m) ? m.forEach((mm: any) => mm.dispose?.()) : m.dispose?.();
            }
          });
          avatars.remove(avatar);
          avatarBySidRef.current.delete(sid);
        }
      }
    }

    let localAvatarSet = false;

    // Only create/update avatars for new or changed participants
    for (const p of uniq) {
      const sid = p.id;
      const seatIdx = participantSeatMapRef.current.get(sid);
      if (seatIdx == null) continue;

      const seat = seatTransformsRef.current[seatIdx];
      const existingAvatar = avatarBySidRef.current.get(sid);

      const isLocal = sid === '__LOCAL__';

      // If avatar exists, handle updates
      if (existingAvatar) {
        // FOR LOCAL AVATAR: Never reset position - user has moved it manually
        if (isLocal && !localAvatarSet) {
          avatarRef.current = existingAvatar;
          localAvatarSet = true;
          // Keep current position, don't reset to seat
          continue;
        }

        // For remote avatars, only update position if seat changed significantly
        if (!isLocal) {
          const currentPos = existingAvatar.position;
          const targetPos = seat.position;
          if (currentPos.distanceTo(targetPos) > 0.1) {
            existingAvatar.position.copy(targetPos);
            existingAvatar.rotation.y = seat.yaw;
          }
        }

        continue;
      }

      // Create new avatar only if it doesn't exist
      const g = new THREE.Group();
      g.position.copy(seat.position);
      g.rotation.y = seat.yaw;

      const bodyColor = isLocal ? 0x3D93F8 : 0x8a8af0;
      const skinColor = isLocal ? 0xe6edf7 : 0xf2f2f2;

      const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.18, 0.6, 6, 12),
        new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.15, roughness: 0.6, emissive: 0x0b111f, emissiveIntensity: 0.15 })
      );
      torso.name = 'TORSO';
      torso.position.set(0, 1.0, 0);
      torso.castShadow = true;
      g.add(torso);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 18, 12),
        new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.35 })
      );
      head.position.set(0, 1.55, 0);
      head.castShadow = true;
      head.name = 'HEAD';
      g.add(head);

      const armMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.12, roughness: 0.55 });
      const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
      const armL = new THREE.Mesh(armGeo, armMat);
      armL.position.set(-0.26, 1.1, 0);
      armL.rotation.z = 0.15;
      g.add(armL);
      const armR = new THREE.Mesh(armGeo, armMat);
      armR.position.set(0.26, 1.1, 0);
      armR.rotation.z = -0.15;
      g.add(armR);

      const legMat = new THREE.MeshStandardMaterial({ color: 0x35353c, metalness: 0.08, roughness: 0.7 });
      const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8);
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.11, 0.55, 0.04);
      g.add(legL);
      const legR = new THREE.Mesh(legGeo, legMat);
      legR.position.set(0.11, 0.55, 0.04);
      g.add(legR);

      const label = makeNameSpriteSmall(p.name || 'User');
      label.position.set(0, 1.92, 0);
      g.add(label);

      // per-seat monitor plane
      let mon = monitorPlanesRef.current.get(seatIdx);
      if (!mon) {
        mon = new THREE.Mesh(
          new THREE.PlaneGeometry(prefab.monitorW, prefab.monitorH),
          new THREE.MeshBasicMaterial({ color: 0x111111, toneMapped: false })
        );
        monitorPlanesRef.current.set(seatIdx, mon);
      }
      mon.position.set(0, 0.85, -0.36);
      g.add(mon);

      avatars.add(g);
      avatarBySidRef.current.set(sid, g);

      if (isLocal && !localAvatarSet) {
        avatarRef.current = g;
        // Only set camera target on initial avatar creation, not on updates
        if (camTargetRef.current.equals(new THREE.Vector3(0, 1.2, 0))) {
          camTargetRef.current.copy(g.position);
          camTargetRef.current.y = 1.2;
        }
        localAvatarSet = true;
      }
    }
  }, [participants, localSid, room]);

  // Video textures: stage + local desk + seat monitors + head badges
  useEffect(() => {
    const screenMesh = stageScreenRef.current;
    if (screenMesh) {
      (screenMesh.material as any) = new THREE.MeshBasicMaterial({ color: 0x111111 });
      for (const ref of screenRefs) {
        if (!isTrackReference(ref)) continue;
        const track: any = ref?.publication?.track;
        if (!track) continue;
        const el = document.createElement('video');
        el.muted = true;
        el.playsInline = true;
        el.autoplay = true;
        try {
          track.attach(el);
          el.play?.().catch(() => { });
        } catch { }
        const tex = new THREE.VideoTexture(el);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        (tex as any).colorSpace = (THREE as any).SRGBColorSpace ?? undefined;
        (screenMesh.material as any) = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        break;
      }
    }

    const camTexBySid = new Map<string, THREE.VideoTexture>();
    for (const ref of cameraRefs) {
      if (!isTrackReference(ref)) continue;
      const track: any = ref?.publication?.track;
      if (!track) continue;

      const sid = norm((ref as any)?.participant?.sid);
      const identity = norm((ref as any)?.participant?.identity);

      const el = document.createElement('video');
      el.muted = true;
      el.playsInline = true;
      el.autoplay = true;
      try {
        track.attach(el);
        el.play?.().catch(() => { });
      } catch { }
      const tex = new THREE.VideoTexture(el);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      (tex as any).colorSpace = (THREE as any).SRGBColorSpace ?? undefined;

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
          if (mat.map) {
            mat.map.dispose?.();
            mat.map = undefined as any;
          }
          const t = camTexBySid.get(sid === '__LOCAL__' ? norm(localSid) : sid);
          if (t) {
            mat.map = t;
            mat.toneMapped = false;
            mat.needsUpdate = true;
          } else {
            mat.map = makeCardTexture(p0.name || 'User');
            mat.toneMapped = false;
            mat.needsUpdate = true;
          }
        }
      }
      const g = avatarBySidRef.current.get(sid);
      if (!g) continue;
      const prev = g.getObjectByName('VID_BADGE');
      if (prev) g.remove(prev);
      const t2 = camTexBySid.get(sid === '__LOCAL__' ? norm(localSid) : sid);
      if (t2) {
        const badge = makeVideoBadge(t2);
        const head = g.getObjectByName('HEAD') as THREE.Mesh | undefined;
        if (head) badge.position.copy(head.position).add(new THREE.Vector3(0, 0.02, 0.02));
        else badge.position.set(0, 1.55, 0.02);
        g.add(badge);
      }
    }

    return () => {
      for (const tex of camTexBySid.values()) {
        try {
          tex.dispose();
        } catch { }
      }
    };
  }, [cameraRefs, screenRefs, participants, localSid]);

  // Dice button action
  const rollDice = () => {
    const dice = diceMeshRef.current;
    if (!dice) return;
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
    const container = containerRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }, [chatOpen, bottomSafeAreaPx, topSafeAreaPx]);

  return (
    <div className="relative h-full w-full" >
      <div
        ref={containerRef}
        className="relative mx-auto h-full w-full"
        style={{
          paddingTop: topSafeAreaPx,
          paddingBottom: bottomSafeAreaPx,
          paddingRight: chatOpen ? 408 : undefined
        }}
      />
      <canvas
        ref={minimapRef}
        width={300}
        height={300}
        className="absolute right-4 bottom-4 rounded-lg border border-[#26272B] bg-[#18181B]/80"
        style={{ zIndex: 5 }}
      />

      {/* Controls Panel */}
      <div
        className="absolute left-4 top-4 text-xs rounded-lg px-3 py-2 space-y-2"
        style={{ background: '#1f2330', color: '#ffffff', border: '1px solid #3b3f4b', width: 260 }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-semibold text-[13px]">3D Controls</div>
          <div className="relative group" style={{ zIndex: 60 }}>
            <span
              className="cursor-help inline-flex items-center justify-center w-5 h-5 rounded-full border text-[11px]"
              style={{ borderColor: '#3b3f4b', background: '#2b2f3b', color: '#cfd3dc' }}
            >?
            </span>
            <div
              className="pointer-events-none absolute left-full ml-2 top-5 transform -translate-y-1/2 w-72 rounded-md border p-3 text-[11px] leading-5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: '#0f1117', borderColor: '#3b3f4b', color: '#e5e7eb', boxShadow: '0 6px 18px rgba(0,0,0,0.45)' }}
            >
              LMB: orbit • MMB / RMB: pan • Wheel: zoom (3rd) / walk (1st) • WASD move • Q / E rotate • +/− zoom • V: toggle view • Click room names: navigate • Dbl-click screen: recenter
            </div>
          </div>
        </div>

        {/* View mode */}
        <div className="flex items-center justify-between">
          <span className="opacity-80">View</span>
          <div className="space-x-2">
            <button
              onClick={() => startCamTransition('first-person')}
              className="px-2 py-1 rounded border"
              style={{
                background: currentViewMode === 'first-person' ? '#2b2f3b' : 'transparent',
                borderColor: '#3b3f4b', color: '#fff'
              }}
            >FP</button>
            <button
              onClick={() => startCamTransition('third-person')}
              className="px-2 py-1 rounded border"
              style={{
                background: currentViewMode === 'third-person' ? '#2b2f3b' : 'transparent',
                borderColor: '#3b3f4b', color: '#fff'
              }}
            >TP</button>
          </div>
        </div>

        {/* Speed */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="opacity-80">Speed</span>
            <span className="opacity-80">{speedMultUI.toFixed(1)}x</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => { const next = Math.max(0.5, Math.round((speedMultRef.current - 0.1) * 10) / 10); speedMultRef.current = next; setSpeedMultUI(next); }}
              className="px-2 py-1 rounded border"
              style={{ borderColor: '#3b3f4b' }}
            >−</button>
            <input
              type="range" min={0.5} max={3} step={0.1}
              value={speedMultUI}
              onChange={(e) => { const v = parseFloat(e.target.value); setSpeedMultUI(v); speedMultRef.current = v; }}
              className="flex-1"
            />
            <button
              onClick={() => { const next = Math.min(3.0, Math.round((speedMultRef.current + 0.1) * 10) / 10); speedMultRef.current = next; setSpeedMultUI(next); }}
              className="px-2 py-1 rounded border"
              style={{ borderColor: '#3b3f4b' }}
            >+</button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alwaysSprintUI}
                onChange={(e) => { setAlwaysSprintUI(e.target.checked); alwaysSprintRef.current = e.target.checked; }}
              />
              <span className="opacity-80">Always sprint</span>
            </label>
            <button
              onClick={() => { speedMultRef.current = 1.0; setSpeedMultUI(1.0); }}
              className="px-2 py-1 rounded border"
              style={{ borderColor: '#3b3f4b' }}
            >Reset</button>
          </div>
        </div>

        {/* Camera */}
        <div className="flex items-center justify-between mt-1">
          <span className="opacity-80">Camera</span>
          <div className="space-x-2">
            <button
              onClick={() => {
                // Recenter camera target to avatar and restore default pitch/zoom
                if (avatarRef.current) {
                  camTargetRef.current.copy(avatarRef.current.position);
                  camTargetRef.current.y = 1.2;
                }
                targetDistRef.current = cameraDistRef.current = 7.0;
                pitchRef.current = 0.25;
                followLockRef.current = false;
              }}
              className="px-2 py-1 rounded border"
              style={{ borderColor: '#3b3f4b', color: '#fff' }}
            >Recenter</button>
          </div>
        </div>
      </div>

      {/* <div className="absolute left-4 bottom-[94px] text-white/70 text-xs bg-[#00000066] px-2 py-1 rounded">
        LMB: orbit • MMB / RMB: pan • Wheel: zoom (3rd) / walk (1st) • WASD move • Q / E rotate • +/− zoom • V: toggle view • Click room names: navigate • Dbl-click screen: recenter
      </div> */}

      {insideGameRoom && (
        <button
          onClick={rollDice}
          className="absolute left-4 bottom-4 text-sm rounded-lg px-3 py-2"
          style={{
            background: '#2b2f3b',
            color: '#d9f99d',
            border: '1px solid #3b3f4b'
          }}
        >
          🎲 Roll Dice
        </button>
      )}
    </div>
  );
};

// ——— Enhanced Minimap with Clickable Room Names ———
function drawMinimap(
  canvas: HTMLCanvasElement | null,
  youPos: THREE.Vector3,
  remotes: Array<{ x: number; z: number; name?: string; sid: string }>,
  mgr: DeskGridManager | null,
  zones: BuiltZonesInfo | null,
  hits: Array<{ x: number; y: number; w: number; h: number; target?: THREE.Vector3; allowGhost?: boolean; roomName?: string }>
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#14171e';
  ctx.fillRect(0, 0, W, H);
  const pad = 16;
  const rw = W - pad * 2, rh = H - pad * 2;
  const toMap = (x: number, z: number) => ({
    X: pad + ((x + ROOM_W / 2) / ROOM_W) * rw,
    Y: pad + ((z + ROOM_D / 2) / ROOM_D) * rh
  });

  ctx.strokeStyle = '#2f2f36';
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, rw, rh);

  if (zones) {
    ctx.lineWidth = 1;
    // Enhanced room rendering with hover-friendly styling
    for (const r of zones.roomRects) {
      const a = toMap(r.rect.minX, r.rect.minZ), b = toMap(r.rect.maxX, r.rect.maxZ);

      // Room background with subtle gradient
      const roomGrad = ctx.createLinearGradient(a.X, a.Y, b.X, b.Y);
      roomGrad.addColorStop(0, 'rgba(74, 144, 226, 0.08)');
      roomGrad.addColorStop(1, 'rgba(74, 144, 226, 0.04)');
      ctx.fillStyle = roomGrad;
      ctx.fillRect(a.X, a.Y, (b.X - a.X), (b.Y - a.Y));

      // Room border
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(a.X, a.Y, (b.X - a.X), (b.Y - a.Y));

      // Enhanced room name with better visibility
      ctx.fillStyle = '#87ceeb';
      ctx.font = 'bold 11px system-ui, -apple-system';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      // Add text shadow for better readability
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      const roomName = r.name;
      const textX = a.X + 4;
      const textY = a.Y + 4;
      ctx.fillText(roomName, textX, textY);

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Calculate room center for pathfinding target
      const centerX = (r.rect.minX + r.rect.maxX) / 2;
      const centerZ = (r.rect.minZ + r.rect.maxZ) / 2;

      // Make room name clickable with larger hit area
      const metrics = ctx.measureText(roomName);
      hits.push({
        x: textX - 2,
        y: textY - 2,
        w: metrics.width + 8,
        h: 16,
        target: new THREE.Vector3(centerX, 0, centerZ),
        allowGhost: false, // Follow nav mesh when clicking rooms on minimap
        roomName: roomName
      });
    }

    // Enhanced doorways
    ctx.fillStyle = '#00ffcc';
    for (const d of zones.doorways) {
      const p = toMap(d.x, d.z);
      ctx.beginPath();
      ctx.arc(p.X, p.Y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Add subtle glow effect
      ctx.beginPath();
      ctx.arc(p.X, p.Y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 204, 0.3)';
      ctx.fill();
      ctx.fillStyle = '#00ffcc';
    }

    // Enhanced landmarks
    ctx.fillStyle = '#7fffd4';
    ctx.font = '10px system-ui';
    for (const lm of zones.landmarks) {
      const p = toMap(lm.x, lm.z);

      // Landmark dot with glow
      ctx.beginPath();
      ctx.arc(p.X, p.Y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#7fffd4';
      ctx.fill();

      // Glow effect
      ctx.beginPath();
      ctx.arc(p.X, p.Y, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(127, 255, 212, 0.4)';
      ctx.fill();

      // Landmark label
      const label = `• ${lm.name}`;
      ctx.fillStyle = '#c8ffe6';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(label, p.X + 8, p.Y - 4);

      const met = ctx.measureText(label);
      hits.push({
        x: p.X + 8,
        y: p.Y - 12,
        w: met.width + 4,
        h: 16,
        target: new THREE.Vector3(lm.x, 0, lm.z),
        allowGhost: false,
        roomName: lm.name
      });
    }
  }

  // Desk areas
  if (mgr) {
    ctx.fillStyle = 'rgba(36, 42, 52, 0.6)';
    for (const r of mgr.bayRects) {
      const a = toMap(r.minX, r.minZ), b = toMap(r.maxX, r.maxZ);
      ctx.fillRect(a.X, a.Y, (b.X - a.X), (b.Y - a.Y));
    }
    ctx.strokeStyle = '#3a4050';
    ctx.setLineDash([4, 2]);
    ctx.lineWidth = 1;
    for (const a of mgr.aisleLines) {
      const p1 = toMap(a.x1, a.z1), p2 = toMap(a.x2, a.z2);
      ctx.beginPath();
      ctx.moveTo(p1.X, p1.Y);
      ctx.lineTo(p2.X, p2.Y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Stage area
  const st = toMap(0, -ROOM_D / 2 + 3.2);
  const stageGrad = ctx.createLinearGradient(st.X - 60, st.Y - 18, st.X + 60, st.Y + 18);
  stageGrad.addColorStop(0, '#1a1d24');
  stageGrad.addColorStop(1, '#2c2f39');
  ctx.fillStyle = stageGrad;
  ctx.fillRect(st.X - 60, st.Y - 18, 120, 36);
  ctx.strokeStyle = '#4a90e2';
  ctx.lineWidth = 1;
  ctx.strokeRect(st.X - 60, st.Y - 18, 120, 36);

  // Other participants with enhanced styling
  ctx.font = '10px system-ui';
  ctx.textBaseline = 'top';
  for (const r of remotes) {
    const p = toMap(r.x, r.z);

    // Participant dot with glow
    ctx.fillStyle = '#8a8af0';
    ctx.beginPath();
    ctx.arc(p.X, p.Y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Glow effect
    ctx.beginPath();
    ctx.arc(p.X, p.Y, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(138, 138, 240, 0.4)';
    ctx.fill();

    if (r.name) {
      const text = r.name.slice(0, 18);
      ctx.fillStyle = '#cfd6ff';
      ctx.font = 'bold 10px system-ui';

      // Add text shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(text, p.X + 7, p.Y + 6);

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      const metrics = ctx.measureText(text);
      hits.push({
        x: p.X + 7,
        y: p.Y + 6,
        w: metrics.width + 4,
        h: 12,
        target: new THREE.Vector3(r.x, 0, r.z),
        allowGhost: true // Allow ghost mode for participant names
      });
    }
  }

  // Local participant (You) with enhanced styling
  const yp = toMap(youPos.x, youPos.z);

  // Your position with pulsing glow
  const time = Date.now() * 0.003;
  const glowIntensity = 0.6 + 0.4 * Math.sin(time);

  ctx.fillStyle = '#3D93F8';
  ctx.beginPath();
  ctx.arc(yp.X, yp.Y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Pulsing glow
  ctx.beginPath();
  ctx.arc(yp.X, yp.Y, 8 + 2 * Math.sin(time), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(61, 147, 248, ${glowIntensity * 0.3})`;
  ctx.fill();

  // "You" label with better styling
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillText('You', yp.X + 8, yp.Y + 7);

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export default Meeting3D;
