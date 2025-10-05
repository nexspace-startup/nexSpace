import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { MODE_PALETTE, type Mode, type ModePalette } from './themeConfig';
import { getMaterial } from './materialCache';
import { preloadEnvironmentMap, type EnvironmentVariant, type EnvironmentMapHandle } from './environmentMaps';
import { mountRoomModules, type RoomModuleHandle } from './RoomModuleLoader';
import { meeting3dFeatures } from '../config';
import { ROOM_DEFINITIONS, ROOM_PORTALS, getRoomById } from '../rooms/definitions';
import type { RoomBounds, RoomDefinition, RoomPortal } from '../rooms/types';

RectAreaLightUniformsLib.init();

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

type BuiltEnvironment = {
  obstacles: THREE.Box3[];
  stageScreen: THREE.Mesh | null;
  localMonitor: THREE.Mesh | null;
  disposeEnv: () => void;
  moduleHandles: Promise<RoomModuleHandle[]>;
  roomLayout: THREE.Group | null;
};

const ENV_HANDLES: Partial<Record<EnvironmentVariant, EnvironmentMapHandle>> = {};

const ROOM_PARTITION_HEIGHT = 2.6;
const ROOM_PARTITION_THICKNESS = 0.16;
const PORTAL_GAP_PAD = 0.45;
const PORTAL_EDGE_EPS = 0.8;

function disposeObjectDeep(object: THREE.Object3D | null | undefined) {
  if (!object) return;
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const line = node as THREE.Line | THREE.LineSegments;
    const sprite = node as THREE.Sprite;
    if (mesh && mesh.geometry) {
      try { mesh.geometry.dispose(); } catch { /* noop */ }
    }
    if (line && line.geometry) {
      try { line.geometry.dispose(); } catch { /* noop */ }
    }
    const materials: THREE.Material[] = [];
    if (mesh && mesh.material) {
      if (Array.isArray(mesh.material)) {
        materials.push(...mesh.material);
      } else {
        materials.push(mesh.material as THREE.Material);
      }
    }
    if (line && line.material) {
      if (Array.isArray(line.material)) {
        materials.push(...line.material);
      } else {
        materials.push(line.material as THREE.Material);
      }
    }
    if (sprite && sprite.material) {
      materials.push(sprite.material as THREE.Material);
    }
    materials.forEach((material) => {
      if (!material || disposedMaterials.has(material)) {
        return;
      }
      const map = (material as any).map as THREE.Texture | undefined;
      if (map && !disposedTextures.has(map)) {
        try { map.dispose(); } catch { /* noop */ }
        disposedTextures.add(map);
      }
      try { material.dispose(); } catch { /* noop */ }
      disposedMaterials.add(material);
    });
  });
}

function variantFromTheme(theme: Mode): EnvironmentVariant {
  return theme === 'light' ? 'day' : 'night';
}

function makeFloorTexture(palette: ModePalette): THREE.CanvasTexture {
  const size = 1024;
  const canvas = IS_BROWSER ? document.createElement('canvas') : null;
  if (!canvas) {
    const fallback = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    fallback.needsUpdate = true;
    return fallback as unknown as THREE.CanvasTexture;
  }
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const tiles = palette.floorTiles.length ? palette.floorTiles : [palette.floorBase];
  const tileSize = size / 8;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const idx = (x + y) % tiles.length;
      ctx.fillStyle = `#${tiles[idx].toString(16).padStart(6, '0')}`;
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
  ctx.strokeStyle = `#${palette.floorGrout.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 8;
  for (let i = 0; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, i * tileSize);
    ctx.lineTo(size, i * tileSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i * tileSize, 0);
    ctx.lineTo(i * tileSize, size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function makeLightmap(size = 512, intensity = 0.85): THREE.Texture {
  if (!IS_BROWSER) {
    const tex = new THREE.DataTexture(new Float32Array([intensity]), 1, 1, THREE.RedFormat, THREE.FloatType);
    tex.needsUpdate = true;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.48);
  gradient.addColorStop(0, `rgba(255,255,255,${intensity})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

function addFloor(scene: THREE.Scene, width: number, depth: number, palette: ModePalette) {
  const mat = getMaterial('floor-base', palette) as THREE.MeshStandardMaterial;
  mat.map = makeFloorTexture(palette);
  mat.map.repeat.set(width / 6, depth / 6);
  mat.lightMap = makeLightmap(1024, 0.7);
  mat.lightMapIntensity = 0.95;
  mat.needsUpdate = true;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  floor.name = 'ENV_FLOOR';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.userData.dimensions = { width, depth };
  scene.add(floor);
  return floor;
}

function addWalls(scene: THREE.Scene, width: number, depth: number, palette: ModePalette) {
  const wallMat = getMaterial('wall-base', palette).clone() as THREE.MeshStandardMaterial;
  wallMat.lightMap = makeLightmap(1024, 0.6);
  wallMat.lightMapIntensity = 0.8;

  const height = 3.6;
  const thickness = 0.12;

  const makeWall = (w: number, h: number, d: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat.clone());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  const walls: THREE.Mesh[] = [];
  const north = makeWall(width, height, thickness);
  north.name = 'WALL_N';
  north.position.set(0, height / 2, -depth / 2);
  const south = north.clone();
  south.name = 'WALL_S';
  south.position.set(0, height / 2, depth / 2);

  const east = makeWall(thickness, height, depth);
  east.name = 'WALL_E';
  east.position.set(width / 2, height / 2, 0);
  const west = east.clone();
  west.name = 'WALL_W';
  west.position.set(-width / 2, height / 2, 0);

  scene.add(north, south, east, west);
  walls.push(north, south, east, west);

  const glassMat = getMaterial('glass', palette);
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.6, 1.8), glassMat);
  ribbon.name = 'WINDOW_STRIP';
  ribbon.position.set(0, 2.4, -depth / 2 + 0.05);
  scene.add(ribbon);
  return walls;
}

function addStage(scene: THREE.Scene, palette: ModePalette) {
  const conference = getRoomById('conference');
  const openDesk = getRoomById('open-desk');
  const screenMat = getMaterial('screen', palette) as THREE.MeshBasicMaterial;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 3.8), screenMat);
  if (conference) {
    const centerX = (conference.bounds.minX + conference.bounds.maxX) / 2;
    const frontZ = conference.bounds.minZ + 0.3;
    screen.position.set(centerX, 2.4, frontZ);
  } else {
    screen.position.set(0, 2.4, -15.6);
  }
  screen.name = 'STAGE_SCREEN';
  scene.add(screen);

  const podium = new THREE.Mesh(
    new RoundedBoxGeometry(2.8, 0.3, 1.0, 4, 0.08),
    getMaterial('wood-accent', palette),
  );
  if (conference) {
    const centerX = (conference.bounds.minX + conference.bounds.maxX) / 2;
    const podiumZ = conference.bounds.minZ + 1.3;
    podium.position.set(centerX, 0.18, podiumZ);
  } else {
    podium.position.set(0, 0.16, -14.6);
  }
  podium.receiveShadow = true;
  podium.castShadow = true;
  scene.add(podium);

  const monitor = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.7, 0.06),
    getMaterial('metal-accent', palette),
  );
  if (openDesk) {
    const monitorX = openDesk.bounds.maxX - 1.2;
    const monitorZ = openDesk.bounds.maxZ - 1.1;
    monitor.position.set(monitorX, 1.8, monitorZ);
  } else {
    monitor.position.set(2.0, 1.6, 6.0);
  }
  monitor.name = 'LOCAL_MONITOR';
  monitor.castShadow = true;
  monitor.receiveShadow = true;
  scene.add(monitor);

  return { screen, monitor };
}

function addPlanters(scene: THREE.Scene, palette: ModePalette) {
  const potGeo = new RoundedBoxGeometry(0.5, 0.36, 0.5, 3, 0.08);
  const potMat = new THREE.MeshStandardMaterial({
    color: palette.furniture.plantPot,
    roughness: 0.75,
    metalness: 0.12,
  });
  const leafGeo = new THREE.ConeGeometry(0.28, 0.8, 12);
  const leafMat = new THREE.MeshStandardMaterial({
    color: palette.furniture.plantLeaf,
    roughness: 0.55,
    metalness: 0.05,
  });

  const planterGroup = new THREE.Group();
  planterGroup.name = 'PLANTERS';

  const positions: Array<[number, number, number]> = [
    [-10.5, 0.18, -5.5],
    [-12.2, 0.18, 4.0],
    [14.5, 0.18, 2.5],
    [10.4, 0.18, -8.0],
  ];

  positions.forEach(([x, y, z], idx) => {
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.set(x, y, z);
    pot.castShadow = true;
    pot.receiveShadow = true;
    pot.userData.materialToken = 'plantPot';
    planterGroup.add(pot);

    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(x, y + 0.65, z);
    leaf.castShadow = true;
    leaf.userData.materialToken = 'plantLeaf';
    planterGroup.add(leaf);

    const collider = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(x, 0.6, z),
      new THREE.Vector3(0.6, 1.2, 0.6),
    );
    (planterGroup.userData.colliders ??= []).push(collider);
  });

  scene.add(planterGroup);
  return planterGroup;
}

function createRoomSign(
  room: RoomDefinition,
  accent: THREE.Color,
  centerX: number,
  centerZ: number,
  depth: number,
): THREE.Mesh {
  const width = Math.min(3.4, Math.max(2.2, depth * 0.6));
  const height = 0.9;
  let material: THREE.MeshBasicMaterial;
  if (IS_BROWSER) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(10,16,24,0.88)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accent.getStyle();
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 64px "Inter", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room.title, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
  } else {
    material = new THREE.MeshBasicMaterial({
      color: accent.getHex(),
      transparent: true,
      opacity: 0.82,
      toneMapped: false,
    });
  }
  material.depthWrite = false;
  material.depthTest = true;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  sign.position.set(centerX, 1.9, centerZ - depth / 2 + 0.6);
  sign.lookAt(new THREE.Vector3(centerX, 1.9, centerZ + depth / 2));
  sign.renderOrder = 3;
  sign.name = `room-sign-${room.id}`;
  return sign;
}

type PartitionBuild = { meshes: THREE.Mesh[]; obstacles: THREE.Box3[] };

function buildPartitionsForRoom(room: RoomDefinition, palette: ModePalette): PartitionBuild {
  const meshes: THREE.Mesh[] = [];
  const obstacles: THREE.Box3[] = [];
  const bounds = room.bounds;
  const accent = new THREE.Color(room.accentColor);
  const baseColor = accent.clone().lerp(new THREE.Color(palette.surroundWalls), 0.45);
  const material = new THREE.MeshStandardMaterial({
    color: baseColor.getHex(),
    roughness: 0.72,
    metalness: 0.12,
  });
  const portals = ROOM_PORTALS.filter((portal) => portal.rooms.includes(room.id));

  const addSegment = (
    orientation: 'horizontal' | 'vertical',
    fixed: number,
    start: number,
    end: number,
  ) => {
    const length = end - start;
    if (length <= 0.2) {
      return;
    }
    const geometry =
      orientation === 'horizontal'
        ? new THREE.BoxGeometry(length, ROOM_PARTITION_HEIGHT, ROOM_PARTITION_THICKNESS)
        : new THREE.BoxGeometry(ROOM_PARTITION_THICKNESS, ROOM_PARTITION_HEIGHT, length);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (orientation === 'horizontal') {
      const centerX = (start + end) / 2;
      mesh.position.set(centerX, ROOM_PARTITION_HEIGHT / 2, fixed);
      obstacles.push(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(centerX, ROOM_PARTITION_HEIGHT / 2, fixed),
          new THREE.Vector3(length, ROOM_PARTITION_HEIGHT, ROOM_PARTITION_THICKNESS),
        ),
      );
    } else {
      const centerZ = (start + end) / 2;
      mesh.position.set(fixed, ROOM_PARTITION_HEIGHT / 2, centerZ);
      obstacles.push(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(fixed, ROOM_PARTITION_HEIGHT / 2, centerZ),
          new THREE.Vector3(ROOM_PARTITION_THICKNESS, ROOM_PARTITION_HEIGHT, length),
        ),
      );
    }
    meshes.push(mesh);
  };

  const buildSegments = (
    orientation: 'horizontal' | 'vertical',
    fixed: number,
    min: number,
    max: number,
  ) => {
    const relevant = portals
      .filter((portal) =>
        orientation === 'horizontal'
          ? Math.abs(portal.position.z - fixed) <= portal.radius + PORTAL_EDGE_EPS
          : Math.abs(portal.position.x - fixed) <= portal.radius + PORTAL_EDGE_EPS,
      )
      .map((portal) => ({
        coord: orientation === 'horizontal' ? portal.position.x : portal.position.z,
        radius: portal.radius,
      }))
      .sort((a, b) => a.coord - b.coord);

    let cursor = min;
    for (const portal of relevant) {
      const gapStart = portal.coord - (portal.radius + PORTAL_GAP_PAD);
      if (gapStart - cursor > 0.25) {
        addSegment(orientation, fixed, cursor, gapStart);
      }
      cursor = Math.max(cursor, portal.coord + portal.radius + PORTAL_GAP_PAD);
    }
    if (max - cursor > 0.25) {
      addSegment(orientation, fixed, cursor, max);
    }
  };

  buildSegments('horizontal', bounds.minZ, bounds.minX, bounds.maxX);
  buildSegments('horizontal', bounds.maxZ, bounds.minX, bounds.maxX);
  buildSegments('vertical', bounds.minX, bounds.minZ, bounds.maxZ);
  buildSegments('vertical', bounds.maxX, bounds.minZ, bounds.maxZ);

  return { meshes, obstacles };
}

type FurnitureBuild = { objects: THREE.Object3D[]; obstacles: THREE.Box3[] };

function buildFurnitureForRoom(room: RoomDefinition, palette: ModePalette): FurnitureBuild {
  const objects: THREE.Object3D[] = [];
  const obstacles: THREE.Box3[] = [];
  const { bounds } = room;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const furniture = palette.furniture;

  const addCollider = (center: THREE.Vector3, size: THREE.Vector3) => {
    obstacles.push(new THREE.Box3().setFromCenterAndSize(center, size));
  };

  const addObject = (object: THREE.Object3D, size?: THREE.Vector3) => {
    objects.push(object);
    if (size) {
      addCollider(object.position.clone(), size);
    }
  };

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: furniture.conferenceTableTop,
    roughness: 0.5,
    metalness: 0.18,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: furniture.conferenceTableLegs,
    roughness: 0.32,
    metalness: 0.65,
  });
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: furniture.chairSeat,
    roughness: 0.75,
    metalness: 0.08,
  });
  const sofaMaterial = new THREE.MeshStandardMaterial({
    color: furniture.sofaFabric,
    roughness: 0.82,
    metalness: 0.05,
  });
  const counterMaterial = new THREE.MeshStandardMaterial({
    color: furniture.coffeeCounter,
    roughness: 0.6,
    metalness: 0.12,
  });
  const gameTableMaterial = new THREE.MeshStandardMaterial({
    color: furniture.gameTableTop,
    roughness: 0.56,
    metalness: 0.16,
  });
  const gameBaseMaterial = new THREE.MeshStandardMaterial({
    color: furniture.gameTableLeg,
    roughness: 0.58,
    metalness: 0.12,
  });

  switch (room.id) {
    case 'lobby': {
      const desk = new THREE.Mesh(new RoundedBoxGeometry(3.8, 1.0, 1.2, 5, 0.12), counterMaterial.clone());
      desk.position.set(centerX, 0.5, bounds.maxZ - 1.6);
      desk.castShadow = true;
      desk.receiveShadow = true;
      addObject(desk, new THREE.Vector3(3.8, 1.2, 1.2));

      const kiosk = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.6, 0.5, 4, 0.08), metalMaterial.clone());
      kiosk.position.set(bounds.minX + width * 0.25, 0.8, centerZ);
      kiosk.castShadow = true;
      kiosk.receiveShadow = true;
      addObject(kiosk, new THREE.Vector3(0.9, 1.6, 0.5));

      const sofa = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.6, 1.0, 4, 0.12), sofaMaterial.clone());
      sofa.position.set(bounds.maxX - 2.2, 0.3, centerZ - 0.6);
      sofa.castShadow = true;
      sofa.receiveShadow = true;
      addObject(sofa, new THREE.Vector3(2.6, 0.8, 1.0));

      const lowTable = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.3, 0.8, 4, 0.1), woodMaterial.clone());
      lowTable.position.set(bounds.maxX - 2.2, 0.18, centerZ + 0.4);
      lowTable.castShadow = true;
      lowTable.receiveShadow = true;
      addObject(lowTable, new THREE.Vector3(1.4, 0.4, 0.8));
      break;
    }
    case 'open-desk': {
      const deskGeo = new RoundedBoxGeometry(2.6, 0.12, 1.3, 3, 0.08);
      const chairGeo = new RoundedBoxGeometry(0.54, 0.45, 0.54, 3, 0.12);
      const deskPositions = [
        { x: bounds.minX + 4.2, z: centerZ - 4.4 },
        { x: bounds.minX + 10.5, z: centerZ - 4.4 },
        { x: bounds.maxX - 4.2, z: centerZ - 4.4 },
        { x: bounds.minX + 4.2, z: centerZ + 3.8 },
        { x: bounds.minX + 10.5, z: centerZ + 3.8 },
        { x: bounds.maxX - 4.2, z: centerZ + 3.8 },
      ];
      deskPositions.forEach((pos) => {
        const desk = new THREE.Mesh(deskGeo.clone(), woodMaterial.clone());
        desk.position.set(pos.x, 0.78, pos.z);
        desk.castShadow = true;
        desk.receiveShadow = true;
        addObject(desk, new THREE.Vector3(2.6, 1.2, 1.4));

        const chairFront = new THREE.Mesh(chairGeo.clone(), seatMaterial.clone());
        chairFront.position.set(pos.x, 0.45, pos.z - 0.9);
        chairFront.castShadow = true;
        chairFront.receiveShadow = true;
        addObject(chairFront, new THREE.Vector3(0.6, 0.7, 0.7));

        const chairBack = new THREE.Mesh(chairGeo.clone(), seatMaterial.clone());
        chairBack.position.set(pos.x, 0.45, pos.z + 0.9);
        chairBack.rotation.y = Math.PI;
        chairBack.castShadow = true;
        chairBack.receiveShadow = true;
        addObject(chairBack, new THREE.Vector3(0.6, 0.7, 0.7));
      });

      const collabTable = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 24), gameTableMaterial.clone());
      collabTable.position.set(centerX, 0.78, centerZ);
      collabTable.castShadow = true;
      collabTable.receiveShadow = true;
      addObject(collabTable, new THREE.Vector3(2.8, 1.0, 2.8));

      const stoolGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.48, 20);
      const stoolMat = seatMaterial.clone();
      const stoolOffsets: Array<[number, number]> = [
        [1.0, 0],
        [-1.0, 0],
        [0, 1.0],
        [0, -1.0],
      ];
      stoolOffsets.forEach(([ox, oz]) => {
        const stool = new THREE.Mesh(stoolGeo.clone(), stoolMat);
        stool.position.set(centerX + ox, 0.24, centerZ + oz);
        stool.castShadow = true;
        stool.receiveShadow = true;
        addObject(stool, new THREE.Vector3(0.64, 0.6, 0.64));
      });
      break;
    }
    case 'conference': {
      const table = new THREE.Mesh(new RoundedBoxGeometry(5.6, 0.18, 2.6, 6, 0.2), woodMaterial.clone());
      table.position.set(centerX, 0.9, centerZ);
      table.castShadow = true;
      table.receiveShadow = true;
      addObject(table, new THREE.Vector3(5.6, 1.2, 2.6));

      const chairGeo = new RoundedBoxGeometry(0.6, 0.55, 0.6, 3, 0.14);
      const chairOffsets: Array<[number, number]> = [
        [-2.2, -1.4],
        [-0.8, -1.4],
        [0.8, -1.4],
        [2.2, -1.4],
        [-2.2, 1.4],
        [-0.8, 1.4],
        [0.8, 1.4],
        [2.2, 1.4],
      ];
      chairOffsets.forEach(([ox, oz]) => {
        const chair = new THREE.Mesh(chairGeo.clone(), seatMaterial.clone());
        chair.position.set(centerX + ox, 0.45, centerZ + oz);
        chair.rotation.y = oz > 0 ? Math.PI : 0;
        chair.castShadow = true;
        chair.receiveShadow = true;
        addObject(chair, new THREE.Vector3(0.7, 0.8, 0.7));
      });

      const credenza = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.8, 0.6, 4, 0.08), metalMaterial.clone());
      credenza.position.set(centerX, 0.4, bounds.minZ + 0.8);
      credenza.castShadow = true;
      credenza.receiveShadow = true;
      addObject(credenza, new THREE.Vector3(3.2, 0.8, 0.6));
      break;
    }
    case 'focus-booths': {
      const podMaterial = new THREE.MeshStandardMaterial({
        color: palette.rooms.focus.base,
        roughness: 0.78,
        metalness: 0.08,
      });
      const podAccent = new THREE.MeshStandardMaterial({
        color: palette.rooms.focus.accent,
        roughness: 0.6,
        metalness: 0.2,
      });
      const podCount = 4;
      for (let i = 0; i < podCount; i += 1) {
        const x = bounds.minX + 2.2 + i * 3.2;
        const shell = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.8, 1.4, 4, 0.18), podMaterial.clone());
        shell.position.set(x, 0.9, bounds.minZ + 1.6);
        shell.castShadow = true;
        shell.receiveShadow = true;
        addObject(shell, new THREE.Vector3(1.6, 1.8, 1.4));

        const desk = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.12, 0.6, 3, 0.08), podAccent.clone());
        desk.position.set(x, 0.95, bounds.minZ + 1.2);
        desk.castShadow = true;
        desk.receiveShadow = true;
        addObject(desk, new THREE.Vector3(1.2, 0.8, 0.6));

        const chair = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.5, 0.6, 3, 0.12), seatMaterial.clone());
        chair.position.set(x, 0.45, bounds.minZ + 2.0);
        chair.castShadow = true;
        chair.receiveShadow = true;
        addObject(chair, new THREE.Vector3(0.7, 0.8, 0.7));
      }
      break;
    }
    case 'cafe-lounge': {
      const counter = new THREE.Mesh(new RoundedBoxGeometry(width * 0.6, 0.9, 0.8, 4, 0.12), counterMaterial.clone());
      counter.position.set(centerX - width * 0.1, 0.45, bounds.minZ + 1.1);
      counter.castShadow = true;
      counter.receiveShadow = true;
      addObject(counter, new THREE.Vector3(width * 0.6, 0.9, 0.8));

      const sofa = new THREE.Mesh(new RoundedBoxGeometry(3.0, 0.7, 1.2, 4, 0.14), sofaMaterial.clone());
      sofa.position.set(bounds.minX + 2.4, 0.35, centerZ + 2.6);
      sofa.castShadow = true;
      sofa.receiveShadow = true;
      addObject(sofa, new THREE.Vector3(3.0, 0.9, 1.2));

      const tables: Array<[number, number]> = [
        [centerX + 2.6, centerZ + 2.6],
        [centerX - 0.4, centerZ + 3.2],
      ];
      tables.forEach(([x, z]) => {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 24), gameTableMaterial.clone());
        top.position.set(x, 0.78, z);
        top.castShadow = true;
        top.receiveShadow = true;
        addObject(top, new THREE.Vector3(1.6, 1.0, 1.6));

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.68, 20), gameBaseMaterial.clone());
        base.position.set(x, 0.34, z);
        base.castShadow = true;
        base.receiveShadow = true;
        addObject(base);
      });

      const stoolGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.5, 20);
      const stoolPositions: Array<[number, number]> = [
        [centerX + 1.4, centerZ + 1.2],
        [centerX + 3.4, centerZ + 1.2],
        [centerX + 1.4, centerZ + 2.2],
        [centerX + 3.4, centerZ + 2.2],
      ];
      stoolPositions.forEach(([x, z]) => {
        const stool = new THREE.Mesh(stoolGeo.clone(), seatMaterial.clone());
        stool.position.set(x, 0.25, z);
        stool.castShadow = true;
        stool.receiveShadow = true;
        addObject(stool, new THREE.Vector3(0.64, 0.6, 0.64));
      });
      break;
    }
    default:
      break;
  }

  return { objects, obstacles };
}

function createPortalLabel(portal: RoomPortal): THREE.Sprite {
  if (!IS_BROWSER) {
    const material = new THREE.SpriteMaterial({ color: 0xffffff, opacity: 0.85, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.4, 0.8, 1);
    sprite.name = `portal-label-${portal.id}`;
    return sprite;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 144;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(12,18,28,0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(148,163,184,0.6)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 48px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(portal.label ?? 'Portal', canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.6, 0.86, 1);
  sprite.name = `portal-label-${portal.id}`;
  return sprite;
}

function createPortalMarkers(palette: ModePalette): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ROOM_PORTALS_MARKERS';
  ROOM_PORTALS.forEach((portal) => {
    const ringGeometry = new THREE.RingGeometry(Math.max(0.2, portal.radius - 0.25), portal.radius, 40);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(portal.position.x, 0.04, portal.position.z);
    ring.renderOrder = 1;
    group.add(ring);

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, toneMapped: false }),
    );
    beacon.position.set(portal.position.x, 1.1, portal.position.z);
    group.add(beacon);

    const label = createPortalLabel(portal);
    label.position.set(portal.position.x, 1.95, portal.position.z);
    group.add(label);
  });
  return group;
}

type RoomLayoutHandle = { group: THREE.Group; obstacles: THREE.Box3[]; dispose: () => void };

function addRoomLayout(scene: THREE.Scene, palette: ModePalette): RoomLayoutHandle {
  const layoutGroup = new THREE.Group();
  layoutGroup.name = 'ROOM_LAYOUT';
  const obstacles: THREE.Box3[] = [];

  for (const room of ROOM_DEFINITIONS) {
    const roomGroup = new THREE.Group();
    roomGroup.name = `layout-${room.id}`;
    const bounds = room.bounds;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const accent = new THREE.Color(room.accentColor);

    const floorColor = accent.clone().lerp(new THREE.Color(palette.floorBase), 0.55);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: floorColor.getHex(),
      roughness: 0.82,
      metalness: 0.14,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(centerX, 0.005, centerZ);
    floor.receiveShadow = true;
    floor.name = `room-floor-${room.id}`;
    roomGroup.add(floor);

    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, depth)),
      new THREE.LineBasicMaterial({ color: accent.getHex(), transparent: true, opacity: 0.6 }),
    );
    border.rotation.x = -Math.PI / 2;
    border.position.set(centerX, 0.01, centerZ);
    roomGroup.add(border);

    const sign = createRoomSign(room, accent, centerX, centerZ, depth);
    roomGroup.add(sign);

    const partitions = buildPartitionsForRoom(room, palette);
    partitions.meshes.forEach((mesh) => roomGroup.add(mesh));
    obstacles.push(...partitions.obstacles);

    const furniture = buildFurnitureForRoom(room, palette);
    furniture.objects.forEach((obj) => roomGroup.add(obj));
    obstacles.push(...furniture.obstacles);

    layoutGroup.add(roomGroup);
  }

  const portalMarkers = createPortalMarkers(palette);
  layoutGroup.add(portalMarkers);

  scene.add(layoutGroup);

  const dispose = () => {
    layoutGroup.removeFromParent();
    disposeObjectDeep(layoutGroup);
  };

  return { group: layoutGroup, obstacles, dispose };
}

function addAmbientLights(scene: THREE.Scene) {
  const hemi = new THREE.HemisphereLight(0xf0f4ff, 0x1a1f28, 0.6);
  hemi.name = 'HEMI';
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xfff3d1, 1.0);
  dir.name = 'DIR_MAIN';
  dir.position.set(10, 16, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 120;
  dir.shadow.camera.left = -40;
  dir.shadow.camera.right = 40;
  dir.shadow.camera.top = 35;
  dir.shadow.camera.bottom = -35;
  scene.add(dir);

  const fill = new THREE.RectAreaLight(0xbcd4ff, 0.35, 12, 6);
  fill.position.set(-8, 4.5, 8);
  fill.lookAt(0, 1.6, 0);
  fill.name = 'AREA_FILL';
  scene.add(fill);

  const ambient = new THREE.AmbientLight(0x20263a, 0.2);
  ambient.name = 'AMBIENT';
  scene.add(ambient);
}

function updateEnvironmentVariant(scene: THREE.Scene, variant: EnvironmentVariant) {
  if (!meeting3dFeatures.enableHdriEnvironment) {
    scene.environment = null;
    scene.background = new THREE.Color(variant === 'day' ? 0xf5f7fa : 0x06080d);
    return;
  }
  const handle = ENV_HANDLES[variant];
  if (handle) {
    scene.environment = handle.target;
    scene.background = handle.target;
  } else {
    scene.environment = null;
    scene.background = new THREE.Color(variant === 'day' ? 0xf5f7fa : 0x06080d);
  }
}

export function addSurroundingGrid(
  scene: THREE.Scene,
  ROOM_W: number,
  ROOM_D: number,
  renderer?: THREE.WebGLRenderer,
  palette?: ModePalette,
) {
  const pal = palette ?? MODE_PALETTE.dark;
  const size = Math.max(ROOM_W, ROOM_D) + 12;
  const geometry = new THREE.PlaneGeometry(size, size);
  const texture = makeFloorTexture(pal);
  texture.repeat.set(size / 12, size / 12);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.1,
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.name = 'SURROUND_GRID';
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -0.002;
  scene.add(plane);

  const fadeTex = (() => {
    if (!IS_BROWSER) {
      const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
      tex.needsUpdate = true;
      return tex;
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(512, 512, 60, 512, 512, 512);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  })();

  const fadeMat = new THREE.MeshBasicMaterial({ map: fadeTex, transparent: true, opacity: 0.75 });
  const fadePlane = new THREE.Mesh(new THREE.CircleGeometry(size * 0.6, 64), fadeMat);
  fadePlane.name = 'SURROUND_FADE';
  fadePlane.rotation.x = -Math.PI / 2;
  fadePlane.position.y = -0.001;
  scene.add(fadePlane);

  if (!scene.fog) {
    scene.fog = new THREE.FogExp2(0x0b0f16, 0.015);
  }

  return { gridPlane: plane, fadePlane };
}

export function buildEnvironment(
  scene: THREE.Scene,
  opts: { ROOM_W: number; ROOM_D: number; palette?: ModePalette; theme?: Mode },
  renderer?: THREE.WebGLRenderer,
): BuiltEnvironment {
  const palette = opts.palette ?? MODE_PALETTE.dark;
  const theme = opts.theme ?? 'dark';

  addAmbientLights(scene);
  const floor = addFloor(scene, opts.ROOM_W, opts.ROOM_D, palette);
  const walls = addWalls(scene, opts.ROOM_W, opts.ROOM_D, palette);
  const stage = addStage(scene, palette);
  const planters = addPlanters(scene, palette);
  const roomLayoutHandle = addRoomLayout(scene, palette);
  const surround = addSurroundingGrid(scene, opts.ROOM_W, opts.ROOM_D, renderer, palette);

  const obstacles: THREE.Box3[] = [];
  if (stage.screen) {
    const stageWidth = (stage.screen.geometry as any)?.parameters?.width ?? 11.5;
    const center = stage.screen.position.clone();
    const depth = 1.2;
    center.z += depth * 0.45;
    obstacles.push(new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(stageWidth, 3.0, depth)));
  }
  for (const collider of planters.userData.colliders ?? []) {
    obstacles.push(collider);
  }
  obstacles.push(...roomLayoutHandle.obstacles);

  if (renderer && meeting3dFeatures.enableHdriEnvironment) {
    (['day', 'night'] as EnvironmentVariant[]).forEach((variant) => {
      void preloadEnvironmentMap(renderer, variant).then((handle) => {
        ENV_HANDLES[variant] = handle;
        if (variant === variantFromTheme(theme)) {
          updateEnvironmentVariant(scene, variant);
        }
      }).catch(() => {});
    });
  }

  const abortController = new AbortController();
  const moduleHandles = meeting3dFeatures.useRoomModules
    ? mountRoomModules(scene, palette, abortController.signal)
    : Promise.resolve<RoomModuleHandle[]>([]);

  const disposeEnv = () => {
    abortController.abort();
    [floor, ...walls, stage.screen, stage.monitor, surround.gridPlane, surround.fadePlane].forEach((mesh) => {
      if (!mesh) return;
      mesh.removeFromParent();
      if ((mesh as any).geometry) {
        (mesh as any).geometry.dispose?.();
      }
      const material = (mesh as any).material;
      if (Array.isArray(material)) {
        material.forEach((mat) => mat?.dispose?.());
      } else {
        material?.dispose?.();
      }
    });
    planters.removeFromParent();
    planters.traverse((obj) => {
      if ((obj as any).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat.dispose();
        }
      }
    });
    roomLayoutHandle.dispose();
    void moduleHandles.then((handles) => {
      handles.forEach((handle) => {
        handle.group.removeFromParent();
        handle.dispose();
      });
    }).catch(() => {});
  };

  return {
    obstacles,
    stageScreen: stage.screen,
    localMonitor: stage.monitor,
    disposeEnv,
    moduleHandles,
    roomLayout: roomLayoutHandle.group,
  };
}

function updateWallMaterial(scene: THREE.Scene, palette: ModePalette) {
  const walls = ['WALL_N', 'WALL_S', 'WALL_E', 'WALL_W']
    .map((name) => scene.getObjectByName(name) as THREE.Mesh | null)
    .filter(Boolean) as THREE.Mesh[];
  walls.forEach((wall) => {
    const mat = wall.material as THREE.MeshStandardMaterial;
    if (!mat) return;
    mat.color.set(palette.surroundWalls);
    mat.needsUpdate = true;
  });
}

export function applyEnvironmentTheme(
  scene: THREE.Scene,
  theme: Mode,
) {
  const palette = MODE_PALETTE[theme];
  updateWallMaterial(scene, palette);
  const floor = scene.getObjectByName('ENV_FLOOR') as THREE.Mesh | null;
  if (floor) {
    const mat = floor.material as THREE.MeshStandardMaterial;
    if (mat?.map instanceof THREE.Texture) {
      mat.map.dispose();
      mat.map = makeFloorTexture(palette);
      const dims = (floor.userData?.dimensions ?? {}) as { width?: number; depth?: number };
      const repeatX = (dims.width ?? 48) / 6;
      const repeatY = (dims.depth ?? 34) / 6;
      mat.map.repeat.set(repeatX, repeatY);
    }
    mat.needsUpdate = true;
  }
  const variant = variantFromTheme(theme);
  updateEnvironmentVariant(scene, variant);
  const fogColor = variant === 'day' ? 0xf5f7fa : 0x0b0f16;
  if (!scene.fog) {
    scene.fog = new THREE.FogExp2(fogColor, variant === 'day' ? 0.006 : 0.015);
  } else {
    scene.fog.color.set(fogColor);
    (scene.fog as THREE.FogExp2).density = variant === 'day' ? 0.006 : 0.015;
  }
  const planters = scene.getObjectByName('PLANTERS');
  if (planters) {
    planters.traverse((obj) => {
      if (!(obj as any).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const token = (mesh.userData?.materialToken ?? '') as string;
      if (token === 'plantPot') {
        (mesh.material as THREE.MeshStandardMaterial).color.set(palette.furniture.plantPot);
      }
      if (token === 'plantLeaf') {
        (mesh.material as THREE.MeshStandardMaterial).color.set(palette.furniture.plantLeaf);
      }
      (mesh.material as THREE.Material).needsUpdate = true;
    });
  }
}

let ENV_THEME_ANIM: number | null = null;
export function animateEnvironmentTheme(
  scene: THREE.Scene,
  from: ModePalette,
  to: ModePalette,
  durationMs: number = 260,
) {
  if (ENV_THEME_ANIM) {
    cancelAnimationFrame(ENV_THEME_ANIM);
    ENV_THEME_ANIM = null;
  }

  const walls = ['WALL_N', 'WALL_S', 'WALL_E', 'WALL_W']
    .map((name) => scene.getObjectByName(name) as THREE.Mesh | null)
    .filter(Boolean) as THREE.Mesh[];
  const rug = scene.getObjectByName('RUG') as THREE.Mesh | null;
  const start = performance.now();

  const lerpColor = (out: THREE.Color, a: THREE.Color, b: THREE.Color, t: number) => {
    out.r = a.r + (b.r - a.r) * t;
    out.g = a.g + (b.g - a.g) * t;
    out.b = a.b + (b.b - a.b) * t;
  };

  const fromWall = new THREE.Color(from.surroundWalls);
  const toWall = new THREE.Color(to.surroundWalls);
  const fromRug = new THREE.Color(from.rugDark);
  const toRug = new THREE.Color(to.rugDark);

  const tick = () => {
    const now = performance.now();
    const t = Math.min(1, (now - start) / durationMs);
    const wallColor = new THREE.Color();
    lerpColor(wallColor, fromWall, toWall, t);
    walls.forEach((wall) => {
      const mat = wall.material as THREE.MeshStandardMaterial;
      mat.color.copy(wallColor);
      mat.needsUpdate = true;
    });
    if (rug) {
      const mat = rug.material as THREE.MeshStandardMaterial;
      const rugColor = new THREE.Color();
      lerpColor(rugColor, fromRug, toRug, t);
      mat.color.copy(rugColor);
      mat.needsUpdate = true;
    }
    if (t < 1) {
      ENV_THEME_ANIM = requestAnimationFrame(tick);
    }
  };

  ENV_THEME_ANIM = requestAnimationFrame(tick);
}
