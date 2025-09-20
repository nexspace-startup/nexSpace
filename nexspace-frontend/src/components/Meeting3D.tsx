import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useTracks, isTrackReference } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useMeetingStore } from '../stores/meetingStore';
import { useShallow } from 'zustand/react/shallow';

type Props = {
  bottomSafeAreaPx?: number;
  topSafeAreaPx?: number;
};

type Seat = { x: number; z: number; yaw: number; zone: string };

// Helpers
const DEG2RAD = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function makeNameSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const w = 512, h = 128;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const r = 24;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 64px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set((1.6 * w) / h, 1.6, 1);
  return sprite;
}

function makeCardTexture(name: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  const w = 512, h = 320;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#2A2A2F'); grad.addColorStop(1, '#3A3A41');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  const initials = (name || 'User').trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'U';
  ctx.fillStyle = '#FE741F'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.font = 'bold 100px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(initials, w / 2, h / 2 + 6);
  const tx = new THREE.CanvasTexture(canvas);
  tx.minFilter = THREE.LinearFilter; return tx;
}

function makeCarpetTexture(): THREE.Texture {
  const size = 256; const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d')!; ctx.fillStyle = '#26262C'; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2; const step = 64;
  for (let x = 0; x <= size; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
  for (let y = 0; y <= size; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 8); tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter; return tex;
}

const ROOM_W = 36; // meters
const ROOM_D = 26;

// Generate Kumospace-like seating around zones
function generateZoneSeats(): Seat[] {
  const seats: Seat[] = [];
  // Huddle tables (four round tables)
  const tables = [
    { x: -10, z: -4, r: 0.95, n: 6, name: 'Huddle A' },
    { x: 10, z: -4, r: 0.95, n: 6, name: 'Huddle B' },
    { x: -10, z: 6, r: 0.95, n: 6, name: 'Huddle C' },
    { x: 10, z: 6, r: 0.95, n: 6, name: 'Huddle D' },
  ];
  for (const t of tables) {
    for (let i = 0; i < t.n; i++) {
      const a = (i / t.n) * Math.PI * 2;
      const x = t.x + Math.cos(a) * t.r;
      const z = t.z + Math.sin(a) * t.r;
      const yaw = -a + Math.PI; // face center
      seats.push({ x, z, yaw, zone: t.name });
    }
  }
  // Lounge area (sofas around rug)
  const lounge = { x: 0, z: 8.5, r: 1.2, n: 8, name: 'Lounge' };
  for (let i = 0; i < lounge.n; i++) {
    const a = (i / lounge.n) * Math.PI * 2;
    const x = lounge.x + Math.cos(a) * lounge.r;
    const z = lounge.z + Math.sin(a) * lounge.r;
    const yaw = -a + Math.PI;
    seats.push({ x, z, yaw, zone: lounge.name });
  }
  // Booths along east wall (private seats)
  const booths: Array<{ x: number; z: number; yaw: number; name: string }> = [];
  const startZ = -7; for (let i = 0; i < 5; i++) booths.push({ x: ROOM_W / 2 - 4, z: startZ + i * 6, yaw: Math.PI, name: `Booth ${i + 1}` });
  for (const b of booths) {
    seats.push({ x: b.x, z: b.z, yaw: b.yaw, zone: b.name });
    seats.push({ x: b.x - 0.6, z: b.z, yaw: b.yaw, zone: b.name });
  }
  // Extra perimeter seats near stage
  for (let i = 0; i < 8; i++) { const x = -12 + i * 3; const z = -ROOM_D / 2 + 5.5; seats.push({ x, z, yaw: 0, zone: 'Stage Row' }); }
  return seats;
}

const Meeting3D: React.FC<Props> = ({ bottomSafeAreaPx = 120, topSafeAreaPx = 96 }) => {
  const { participants, room } = useMeetingStore(useShallow((s) => ({ participants: s.participants, room: s.room })));
  const chatOpen = useMeetingStore((s) => s.chatOpen);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  const localSid = useMemo(() => {
    try { return (room as any)?.localParticipant?.sid ?? (room as any)?.localParticipant?.identity; } catch { return undefined; }
  }, [room]);

  // Live camera and screen-share tracks
  const cameraRefs = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }], { onlySubscribed: false });
  const screenRefs = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });

  const zoneSeats = useMemo(() => generateZoneSeats(), []);

  // Scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarsGroupRef = useRef<THREE.Group | null>(null);
  const stageScreenRef = useRef<THREE.Mesh | null>(null);
  const localDeskMonitorRef = useRef<THREE.Mesh | null>(null);
  const rafRef = useRef<number | null>(null);

  // Controls
  const avatarRef = useRef<THREE.Group | null>(null);
  const yawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0.25); // slight downward tilt
  const keyState = useRef<Record<string, boolean>>({});
  const cameraDistRef = useRef<number>(3.2);
  const targetDistRef = useRef<number>(3.2);
  const remoteSeatsRef = useRef<Array<{ x: number; z: number }>>([]);

  // Colliders
  const obstaclesRef = useRef<THREE.Box3[]>([]);
  const roomBoundsRef = useRef<{ minX: number; maxX: number; minZ: number; maxZ: number }>({ minX: -ROOM_W / 2 + 0.3, maxX: ROOM_W / 2 - 0.3, minZ: -ROOM_D / 2 + 0.3, maxZ: ROOM_D / 2 - 0.3 });

  // Build static environment once
  useEffect(() => {
    const container = containerRef.current; if (!container) return;
    let scene = sceneRef.current; let renderer = rendererRef.current; let camera = cameraRef.current;

    if (!scene) {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x202024);
      // Keep distant content visible; no heavy fog
      // scene.fog = new THREE.Fog(0x202024, 120, 500);
      sceneRef.current = scene;
    }
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(container.clientWidth, container.clientHeight); rendererRef.current = renderer; container.appendChild(renderer.domElement);
    }
    if (!camera) {
      camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 500);
      camera.position.set(0, 2.2, 4);
      cameraRef.current = camera;
    }

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.6); scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9); dir.position.set(7, 10, 6); dir.castShadow = true; dir.shadow.mapSize.set(1024, 1024); dir.shadow.camera.near = 1; dir.shadow.camera.far = 90; scene.add(dir); scene.add(new THREE.AmbientLight(0xffffff, 0.18));

    // Floor and walls
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), new THREE.MeshStandardMaterial({ map: makeCarpetTexture(), color: 0x2a2a2f, roughness: 0.96 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a41, roughness: 1.0 }); const H = 3.2, T = 0.1;
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, H, T), wallMat); wallN.position.set(0, H / 2, -ROOM_D / 2); const wallS = wallN.clone(); wallS.position.set(0, H / 2, ROOM_D / 2);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(T, H, ROOM_D), wallMat); wallE.position.set(ROOM_W / 2, H / 2, 0); const wallW = wallE.clone(); wallW.position.set(-ROOM_W / 2, H / 2, 0); scene.add(wallN, wallS, wallE, wallW);

    // Window panel on north wall
    const winCanvas = document.createElement('canvas'); winCanvas.width = 1024; winCanvas.height = 512; const wctx = winCanvas.getContext('2d')!; const g = wctx.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#bcd5ff'); g.addColorStop(1, '#7fb0ff'); wctx.fillStyle = g; wctx.fillRect(0, 0, 1024, 512); const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(winCanvas), toneMapped: false })); windowMesh.position.set(0, 2.0, -ROOM_D / 2 + 0.06); scene.add(windowMesh);

    // Zone labels
    const labelMat = (text: string) => new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const cx = c.getContext('2d')!; cx.fillStyle = 'rgba(0,0,0,0.5)'; cx.fillRect(0, 0, 512, 128); cx.fillStyle = '#fff'; cx.font = 'bold 56px system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 256, 64); return new THREE.CanvasTexture(c); })(), transparent: true }));
    const lblA = labelMat('Huddle A'); lblA.scale.set(4, 1, 1); lblA.position.set(-10, 2.4, -4); scene.add(lblA);
    const lblB = labelMat('Huddle B'); lblB.scale.set(4, 1, 1); lblB.position.set(10, 2.4, -4); scene.add(lblB);
    const lblC = labelMat('Huddle C'); lblC.scale.set(4, 1, 1); lblC.position.set(-10, 2.4, 6); scene.add(lblC);
    const lblD = labelMat('Huddle D'); lblD.scale.set(4, 1, 1); lblD.position.set(10, 2.4, 6); scene.add(lblD);
    const lblL = labelMat('Lounge'); lblL.scale.set(3.5, 1, 1); lblL.position.set(0, 2.4, 8.5); scene.add(lblL);
    const lblS = labelMat('Stage'); lblS.scale.set(3, 1, 1); lblS.position.set(0, 2.4, -ROOM_D / 2 + 3.4); scene.add(lblS);

    // Stage area
    const stage = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 3), new THREE.MeshStandardMaterial({ color: 0x2d2d34, roughness: 0.8 }));
    stage.position.set(0, 0.1, -ROOM_D / 2 + 2.2); stage.receiveShadow = true; scene.add(stage);
    const stageBox = new THREE.Box3().setFromObject(stage);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 3.8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    screen.position.set(0, 2.5, -ROOM_D / 2 + 0.12); stageScreenRef.current = screen; scene.add(screen);

    // Lounge (rug + sofas + coffee table)
    const rug = new THREE.Mesh(new RoundedBoxGeometry(4.5, 0.02, 3.5, 4, 0.1), new THREE.MeshStandardMaterial({ color: 0x33333a })); rug.position.set(0, 0.01, 8.5); rug.receiveShadow = true; scene.add(rug);
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.9 });
    const sofa1 = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.6, 0.7, 3, 0.1), sofaMat); sofa1.position.set(-1.6, 0.3, 8.5);
    const sofa2 = sofa1.clone(); sofa2.position.set(1.6, 0.3, 8.5);
    const sofa3 = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.6, 1.6, 3, 0.1), sofaMat); sofa3.position.set(0, 0.3, 7.2);
    scene.add(sofa1, sofa2, sofa3);

    // Huddle tables (shared geos/materials for perf)
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x5c5c66, roughness: 0.85 });
    const tableCenters = [
      new THREE.Vector3(-10, 0.75, -4), new THREE.Vector3(10, 0.75, -4),
      new THREE.Vector3(-10, 0.75, 6), new THREE.Vector3(10, 0.75, 6),
    ];
    const tableTopGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.06, 24);
    const tablePostGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 16);
    const tablePostMat = new THREE.MeshStandardMaterial({ color: 0x2f2f36 });
    for (const c of tableCenters) {
      const top = new THREE.Mesh(tableTopGeo, tableMat); top.position.copy(c); top.castShadow = true; top.receiveShadow = true; scene.add(top);
      const post = new THREE.Mesh(tablePostGeo, tablePostMat); post.position.set(c.x, 0.35, c.z); post.castShadow = true; scene.add(post);
    }

    // Private booths along east wall
    const boothMat = new THREE.MeshStandardMaterial({ color: 0x3e3e47, roughness: 0.95 });
    for (let i = 0; i < 5; i++) {
      const bx = ROOM_W / 2 - 2.2; const bz = -7 + i * 6;
      const booth = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 2.6), boothMat);
      booth.position.set(bx, 1.11, bz); scene.add(booth);
    }

    // Obstacles for collisions (stage + sofas + tables + booths)
    const obstacles: THREE.Box3[] = [stageBox];
    [sofa1, sofa2, sofa3].forEach(o => obstacles.push(new THREE.Box3().setFromObject(o)));
    tableCenters.forEach(c => { const temp = new THREE.Mesh(tableTopGeo, tableMat); temp.position.copy(c); obstacles.push(new THREE.Box3().setFromObject(temp)); });
    for (let i = 0; i < 5; i++) { const bx = ROOM_W / 2 - 2.2; const bz = -7 + i * 6; const temp = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 2.6), boothMat); temp.position.set(bx, 1.11, bz); obstacles.push(new THREE.Box3().setFromObject(temp)); }
    obstaclesRef.current = obstacles;

    // Plants (instanced) and decor
    const plantPositions: Array<[number, number]> = [
      [-14, -8], [-14, 8], [14, -8], [14, 8], [0, -10], [0, 12]
    ];
    const potGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.28, 12);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x5b4d40, roughness: 0.9 });
    const leafGeo = new THREE.IcosahedronGeometry(0.36, 1);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.6 });
    const potInst = new THREE.InstancedMesh(potGeo, potMat, plantPositions.length);
    const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, plantPositions.length);
    const tmp = new THREE.Object3D();
    plantPositions.forEach((p, i) => { tmp.position.set(p[0], 0.14, p[1]); tmp.updateMatrix(); potInst.setMatrixAt(i, tmp.matrix); tmp.position.set(p[0], 0.52, p[1]); tmp.updateMatrix(); leafInst.setMatrixAt(i, tmp.matrix); });
    scene.add(potInst, leafInst);

    // Whiteboard near huddle C
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
    board.position.set(-10, 1.5, 8.5); scene.add(board);

    // Local personal desk near window
    const localDesk = new THREE.Group();
    const top1 = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.06, 0.8, 4, 0.05), new THREE.MeshStandardMaterial({ color: 0x6a6a73, roughness: 0.85 }));
    top1.position.set(-ROOM_W / 2 + 3.0, 0.75, ROOM_D / 2 - 4.0); top1.castShadow = true; top1.receiveShadow = true; localDesk.add(top1);
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2f2f36, roughness: 0.9 });
    const legOffsets: [number, number][] = [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]];
    for (const [lx, lz] of legOffsets) { const leg = new THREE.Mesh(legGeo, legMat); leg.position.set(top1.position.x + lx, 0.375, top1.position.z + lz); scene.add(leg); }
    // Monitor for local desk
    const monGeo = new THREE.PlaneGeometry(0.6, 0.36);
    const monMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const mon = new THREE.Mesh(monGeo, monMat); mon.position.set(top1.position.x, 0.75 + 0.3, top1.position.z - 0.15); localDesk.add(mon); localDeskMonitorRef.current = mon;
    scene.add(localDesk);

    // Avatars group and local avatar
    const avatars = new THREE.Group(); avatarsGroupRef.current = avatars; scene.add(avatars);
    const you = new THREE.Group();
    // Build a simple humanoid avatar instead of a big cylinder
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.6, 6, 12), new THREE.MeshStandardMaterial({ color: 0x3D93F8 })); torso.position.set(0, 1.0, 0); torso.castShadow = true; you.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe6edf7 })); head.position.set(0, 1.5, 0); head.castShadow = true; you.add(head);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222 }); const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat); const eyeR = eyeL.clone(); eyeL.position.set(-0.06, 1.55, 0.15); eyeR.position.set(0.06, 1.55, 0.15); you.add(eyeL, eyeR);
    // Start near personal desk
    you.position.set(-ROOM_W / 2 + 3.0, 0, ROOM_D / 2 - 3.2);
    avatarRef.current = you; scene.add(you);

    // Resize handler
    const onResize = () => { if (!container || !renderer || !camera) return; const w = container.clientWidth; const h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    window.addEventListener('resize', onResize);

    // Key and mouse
    const onKey = (e: KeyboardEvent) => { const code = e.code; const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract']; if (keys.includes(code)) keyState.current[code] = e.type === 'keydown'; };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
    let dragging = false, lastX = 0, lastY = 0, dragButton = 0; const onMouseDown = (e: MouseEvent) => { dragging = true; dragButton = e.button; lastX = e.clientX; lastY = e.clientY; }; const onMouseUp = () => { dragging = false; }; const onMouseMove = (e: MouseEvent) => { if (!dragging) return; const dx = e.clientX - lastX; const dy = e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; if (dragButton === 0) { yawRef.current -= dx * 0.2 * DEG2RAD; } else { pitchRef.current = clamp(pitchRef.current - dy * 0.15 * DEG2RAD, -0.05, 0.8); } };
    container.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp); window.addEventListener('mousemove', onMouseMove);
    // Double click to teleport on floor
    const onDblClick = (e: MouseEvent) => {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
      const ray = new THREE.Raycaster(); const cam = cameraRef.current!; ray.setFromCamera(ndc, cam);
      const t = -ray.ray.origin.y / ray.ray.direction.y; if (t <= 0) return; const hit = ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(t));
      const bounds = roomBoundsRef.current; const nx = clamp(hit.x, bounds.minX, bounds.maxX); const nz = clamp(hit.z, bounds.minZ, bounds.maxZ);
      const you = avatarRef.current!; const youBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(nx, 0.9, nz), new THREE.Vector3(0.5, 1.8, 0.5)); let blocked = false; for (const b of obstaclesRef.current) { if (b.intersectsBox(youBox)) { blocked = true; break; } } if (!blocked) { you.position.set(nx, you.position.y, nz); }
    };
    container.addEventListener('dblclick', onDblClick);
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const dir = Math.sign(e.deltaY); const step = 1.0; const next = targetDistRef.current + dir * step; targetDistRef.current = clamp(next, 1.6, 8.0); };
    container.addEventListener('wheel', onWheel, { passive: false });

    // Animation
    let lastT = performance.now();
    const animate = () => {
      const now = performance.now(); const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      const you = avatarRef.current!; const cam = cameraRef.current!;
      const speed = (keyState.current['ShiftLeft'] || keyState.current['ShiftRight']) ? 3.5 : 2.0;
      const yaw = yawRef.current; let vx = 0, vz = 0; const fwd = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw)); const rgt = new THREE.Vector2(-fwd.y, fwd.x);
      if (keyState.current['KeyW'] || keyState.current['ArrowUp']) { vx += fwd.x; vz += fwd.y; }
      if (keyState.current['KeyS'] || keyState.current['ArrowDown']) { vx -= fwd.x; vz -= fwd.y; }
      if (keyState.current['KeyA'] || keyState.current['ArrowLeft']) { vx -= rgt.x; vz -= rgt.y; }
      if (keyState.current['KeyD'] || keyState.current['ArrowRight']) { vx += rgt.x; vz += rgt.y; }
      if (keyState.current['KeyQ']) { yawRef.current += 1.5 * dt; }
      if (keyState.current['KeyE']) { yawRef.current -= 1.5 * dt; }
      if (keyState.current['Equal'] || keyState.current['NumpadAdd']) { targetDistRef.current = clamp(targetDistRef.current - 2.5 * dt, 1.6, 8.0); }
      if (keyState.current['Minus'] || keyState.current['NumpadSubtract']) { targetDistRef.current = clamp(targetDistRef.current + 2.5 * dt, 1.6, 8.0); }

      if (vx !== 0 || vz !== 0) { const len = Math.hypot(vx, vz); vx /= len; vz /= len; const nx = you.position.x + vx * speed * dt; const nz = you.position.z + vz * speed * dt; const bounds = roomBoundsRef.current; let target = new THREE.Vector3(nx, you.position.y, nz); const youBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(target.x, 0.9, target.z), new THREE.Vector3(0.5, 1.8, 0.5)); let blocked = false; for (const b of obstaclesRef.current) { if (b.intersectsBox(youBox)) { blocked = true; break; } } if (!blocked) { target.x = Math.min(bounds.maxX, Math.max(bounds.minX, target.x)); target.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, target.z)); you.position.set(target.x, you.position.y, target.z); } }

      // Smooth zoom
      const zoomSpeed = 6.0; cameraDistRef.current = cameraDistRef.current + (targetDistRef.current - cameraDistRef.current) * Math.min(1, zoomSpeed * dt);
      const dist = cameraDistRef.current;
      const pitch = pitchRef.current;
      const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
      cam.position.set(you.position.x + off.x, 1.2 + off.y, you.position.z + off.z);
      cam.lookAt(you.position.x, 1.2, you.position.z);

      renderer!.render(scene!, cam);

      // Minimap
      drawMinimap(minimapRef.current, you.position, remoteSeatsRef.current);

      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
      container.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); window.removeEventListener('mousemove', onMouseMove); container.removeEventListener('wheel', onWheel); container.removeEventListener('dblclick', onDblClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { renderer?.dispose(); if (renderer?.domElement?.parentElement === container) container.removeChild(renderer.domElement); } catch { }
      sceneRef.current = null; rendererRef.current = null; cameraRef.current = null; avatarRef.current = null; avatarsGroupRef.current = null; stageScreenRef.current = null; obstaclesRef.current = [];
    };
  }, []);

  // Build/refresh avatars and stage video when participants or tracks change
  useEffect(() => {
    const scene = sceneRef.current; const avatars = avatarsGroupRef.current; if (!scene || !avatars) return;
    // Clear avatars
    while (avatars.children.length) { const ch = avatars.children.pop()!; (ch as any).traverse?.((obj: any) => { if (obj.geometry) obj.geometry.dispose?.(); if (obj.material) { const m = obj.material; if (Array.isArray(m)) m.forEach((mm: any) => mm.dispose?.()); else m.dispose?.(); } }); }

    // Video textures for participants with camera
    const createdVideos: Array<{ track: any; element: HTMLVideoElement; texture: THREE.VideoTexture; sid: string }>[] = [[]];
    const videoBySid = new Map<string, THREE.VideoTexture>();
    try {
      for (const ref of cameraRefs) {
        if (!isTrackReference(ref)) continue; const track: any = ref?.publication?.track; if (!track) continue;
        const sid: string = ((ref as any)?.participant?.sid ?? (ref as any)?.participant?.identity) as string; if (!sid) continue;
        const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.autoplay = true; try { track.attach(el); el.play?.().catch(() => { }); } catch { }
        const tex = new THREE.VideoTexture(el); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; (tex as any).colorSpace = (THREE as any).SRGBColorSpace ?? undefined;
        videoBySid.set(sid, tex); createdVideos[0].push({ track, element: el, texture: tex, sid });
      }
    } catch { }

    // Assign seats to remote participants; local user uses personal desk
    const remotes = participants.filter(p => p.id !== localSid);
    const seats: Seat[] = zoneSeats.slice(0, remotes.length || 0);
    remoteSeatsRef.current = seats.map(s => ({ x: s.x, z: s.z }));
    remotes.forEach((p, i) => {
      const seat = seats[i] ?? { x: 0, z: 0, yaw: 0, zone: 'Floor' };
      const g = new THREE.Group(); g.position.set(seat.x, 0, seat.z); g.rotation.y = seat.yaw;
      // avatar (remote): compact humanoid
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 6, 12), new THREE.MeshStandardMaterial({ color: 0x8a8af0 })); torso.position.set(0, 0.9, 0); torso.castShadow = true; g.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 })); head.position.set(0, 1.36, 0); head.castShadow = true; g.add(head);
      // name label
      const label = makeNameSprite((p.name || 'User').slice(0, 32)); label.position.set(0, 1.7, 0); g.add(label);
      // video card in front
      const cardGeo = new THREE.PlaneGeometry(0.52, 0.32); const vid = videoBySid.get(p.id); const cardMat = new THREE.MeshBasicMaterial({ map: vid ?? makeCardTexture(p.name || 'User'), transparent: !!vid, toneMapped: false });
      const card = new THREE.Mesh(cardGeo, cardMat); card.position.set(0, 1.35, -0.35); g.add(card);
      avatars.add(g);
    });

    // Stage screen share
    const screenMesh = stageScreenRef.current;
    if (screenMesh) {
      try { (screenMesh.material as any).map?.dispose?.(); } catch { }
      let applied = false;
      for (const ref of screenRefs) {
        if (!isTrackReference(ref)) continue; const track: any = ref?.publication?.track; if (!track) continue;
        const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.autoplay = true; try { track.attach(el); el.play?.().catch(() => { }); } catch { }
        const tex = new THREE.VideoTexture(el); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; (tex as any).colorSpace = (THREE as any).SRGBColorSpace ?? undefined;
        (screenMesh.material as any) = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); applied = true; break;
      }
      if (!applied) {
        (screenMesh.material as any) = new THREE.MeshBasicMaterial({ color: 0x111111 });
      }
    }

    // Local desk monitor shows local camera when available
    const localMon = localDeskMonitorRef.current;
    if (localMon) {
      let appliedLocal = false;
      for (const ref of cameraRefs) {
        if (!isTrackReference(ref)) continue;
        const sid: string = ((ref as any)?.participant?.sid ?? (ref as any)?.participant?.identity) as string;
        if (!sid || sid !== localSid) continue;
        const track: any = ref?.publication?.track; if (!track) continue;
        const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.autoplay = true; try { track.attach(el); el.play?.().catch(() => { }); } catch { }
        const tex = new THREE.VideoTexture(el); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; (tex as any).colorSpace = (THREE as any).SRGBColorSpace ?? undefined;
        (localMon.material as any) = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); appliedLocal = true; break;
      }
      if (!appliedLocal) {
        (localMon.material as any) = new THREE.MeshBasicMaterial({ map: makeCardTexture('You'), toneMapped: false });
      }
    }

    return () => { try { for (const arr of createdVideos) { for (const v of arr) { try { v.track?.detach?.(v.element); } catch { } try { v.texture.dispose(); } catch { } } } } catch { } };
  }, [participants, cameraRefs, screenRefs, zoneSeats, localSid]);

  // Keep renderer size synced when layout chrome changes
  useEffect(() => {
    const container = containerRef.current; const renderer = rendererRef.current; const camera = cameraRef.current; if (!container || !renderer || !camera) return; const w = container.clientWidth; const h = container.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }, [chatOpen, bottomSafeAreaPx, topSafeAreaPx]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="relative mx-auto h-full w-full" style={{ paddingTop: topSafeAreaPx, paddingBottom: bottomSafeAreaPx, paddingRight: chatOpen ? 408 : undefined }} />
      <canvas ref={minimapRef} width={220} height={220} className="absolute right-4 bottom-4 rounded-lg border border-[#26272B] bg-[#18181B]/80" style={{ zIndex: 5 }} />
      <div className="absolute left-4 bottom-[90px] text-white/70 text-xs bg-[#00000066] px-2 py-1 rounded">WASD/Arrows to move, drag to look, Q/E rotate, +/− zoom</div>
    </div>
  );
};

function drawMinimap(canvas: HTMLCanvasElement | null, you: THREE.Vector3, remotes: Array<{ x: number; z: number }>) {
  if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; const W = canvas.width, H = canvas.height; ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#202024'; ctx.fillRect(0, 0, W, H); const pad = 16; const rw = W - pad * 2, rh = H - pad * 2; ctx.strokeStyle = '#2f2f36'; ctx.lineWidth = 2; ctx.strokeRect(pad, pad, rw, rh);
  const toMap = (x: number, z: number) => ({ X: pad + ((x + ROOM_W / 2) / ROOM_W) * rw, Y: pad + ((z + ROOM_D / 2) / ROOM_D) * rh });
  // Draw zones
  ctx.fillStyle = '#3a3a41'; const circles = [[-10, -4, 12], [10, -4, 12], [-10, 6, 12], [10, 6, 12]] as Array<[number, number, number]>; for (const [cx, cz, r] of circles) { const p = toMap(cx, cz); ctx.beginPath(); ctx.arc(p.X, p.Y, r, 0, Math.PI * 2); ctx.fill(); }
  // Lounge rug
  const lr = toMap(0, 8.5); ctx.fillStyle = '#33333a'; ctx.fillRect(lr.X - 22, lr.Y - 15, 44, 30);
  // Booths strip
  ctx.fillStyle = '#3e3e47'; for (let i = 0; i < 5; i++) { const p = toMap(ROOM_W / 2 - 2.2, -7 + i * 6); ctx.fillRect(p.X - 8, p.Y - 10, 16, 20); }
  // Stage
  const st = toMap(0, -ROOM_D / 2 + 2.2); ctx.fillStyle = '#2d2d34'; ctx.fillRect(st.X - 30, st.Y - 12, 60, 24);
  // Remotes
  ctx.fillStyle = '#8a8af0'; for (const r of remotes) { const p = toMap(r.x, r.z); ctx.beginPath(); ctx.arc(p.X, p.Y, 3, 0, Math.PI * 2); ctx.fill(); }
  // You
  const yp = toMap(you.x, you.z); ctx.fillStyle = '#3D93F8'; ctx.beginPath(); ctx.arc(yp.X, yp.Y, 4, 0, Math.PI * 2); ctx.fill();
}

export default Meeting3D;
