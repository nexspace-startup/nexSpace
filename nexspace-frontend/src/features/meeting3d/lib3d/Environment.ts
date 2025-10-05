import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { MODE_PALETTE, type Mode, type ModePalette } from './themeConfig';
import { getMaterial } from './materialCache';
import { preloadEnvironmentMap, type EnvironmentVariant, type EnvironmentMapHandle } from './environmentMaps';
import { mountRoomModules, type RoomModuleHandle } from './RoomModuleLoader';
import { meeting3dFeatures } from '../config';

RectAreaLightUniformsLib.init();

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

type BuiltEnvironment = {
  obstacles: THREE.Box3[];
  stageScreen: THREE.Mesh | null;
  localMonitor: THREE.Mesh | null;
  disposeEnv: () => void;
  moduleHandles: Promise<RoomModuleHandle[]>;
};

const ENV_HANDLES: Partial<Record<EnvironmentVariant, EnvironmentMapHandle>> = {};

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
  const screenMat = getMaterial('screen', palette) as THREE.MeshBasicMaterial;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 4.2), screenMat);
  screen.position.set(0, 2.5, -15.6);
  screen.name = 'STAGE_SCREEN';
  scene.add(screen);

  const podium = new THREE.Mesh(
    new RoundedBoxGeometry(3.2, 0.3, 1.0, 4, 0.08),
    getMaterial('wood-accent', palette),
  );
  podium.position.set(0, 0.16, -14.6);
  podium.receiveShadow = true;
  podium.castShadow = true;
  scene.add(podium);

  const monitor = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.7, 0.06),
    getMaterial('metal-accent', palette),
  );
  monitor.position.set(19.1, 2.1, 14.4);
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
  const surround = addSurroundingGrid(scene, opts.ROOM_W, opts.ROOM_D, renderer, palette);

  const obstacles: THREE.Box3[] = [];
  obstacles.push(
    new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 1.6, -15.2), new THREE.Vector3(11.5, 3.2, 1.0)),
  );
  for (const collider of planters.userData.colliders ?? []) {
    obstacles.push(collider);
  }

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
