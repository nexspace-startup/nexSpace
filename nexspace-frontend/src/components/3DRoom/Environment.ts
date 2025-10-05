import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MODE_PALETTE, type Mode, type ModePalette } from './themeConfig';

// --- Util: set texture to sRGB across three versions
function setSRGB(tex: THREE.Texture) {
    const anyTex = tex as any;
    if ('colorSpace' in anyTex && anyTex.colorSpace !== undefined) {
        anyTex.colorSpace = (THREE as any).SRGBColorSpace ?? anyTex.colorSpace;
    }
}

// Runtime guard for SSR environments (no window/document)
const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

// --- Subtle, tileable wall texture (cached) ---------------------------------
let WALL_TEX_LIGHT: THREE.Texture | null = null;
let WALL_TEX_DARK: THREE.Texture | null = null;

function makeWallTexture(base: string, grain: string): THREE.Texture {
    // SSR-safe fallback: return a tiny data texture with the base color
    if (!IS_BROWSER) {
        const col = new THREE.Color(base);
        const data = new Uint8Array([
            Math.round(col.r * 255),
            Math.round(col.g * 255),
            Math.round(col.b * 255),
            255,
        ]);
        const tex = new THREE.DataTexture(data, 1, 1);
        setSRGB(tex);
        tex.needsUpdate = true;
        return tex;
    }
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    // base coat
    g.fillStyle = base; g.fillRect(0, 0, S, S);
    // subtle noise speckles
    const noise = g.createImageData(S, S);
    for (let i = 0; i < noise.data.length; i += 4) {
        const v = Math.random() * 16; // very light
        noise.data[i] = v; noise.data[i + 1] = v; noise.data[i + 2] = v; noise.data[i + 3] = 24; // low alpha
    }
    g.putImageData(noise, 0, 0);
    // faint vertical grain lines
    g.strokeStyle = grain; g.globalAlpha = 0.08; g.lineWidth = 1;
    for (let x = 0; x < S; x += 24) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, S); g.stroke(); }
    g.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    setSRGB(tex);
    tex.anisotropy = 2;
    tex.needsUpdate = true;
    return tex;
}

function getWallTexture(mode: 'light' | 'dark') {
    if (mode === 'light') {
        if (!WALL_TEX_LIGHT) WALL_TEX_LIGHT = makeWallTexture('#F6F8FB', '#D8DEE9');
        return WALL_TEX_LIGHT;
    }
    if (!WALL_TEX_DARK) WALL_TEX_DARK = makeWallTexture('#1f2633', '#2d3544');
    return WALL_TEX_DARK;
}

function makeGridTexture({
    size = 1024,
    cell = 64,
    majorEvery = 4,
    bg = '#202024',
    minor = 'rgba(190,200,215,0.25)',
    major = 'rgba(230,240,255,0.55)',
} = {}) {
    // SSR-safe fallback: solid background texture
    if (!IS_BROWSER) {
        const col = new THREE.Color(bg);
        const data = new Uint8Array([
            Math.round(col.r * 255),
            Math.round(col.g * 255),
            Math.round(col.b * 255),
            255,
        ]);
        const tex = new THREE.DataTexture(data, 1, 1);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        setSRGB(tex);
        tex.needsUpdate = true;
        return tex;
    }
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    g.fillStyle = bg;
    g.fillRect(0, 0, size, size);

    // vertical lines
    for (let x = 0; x <= size; x += cell) {
        const isMajor = (x / cell) % majorEvery === 0;
        g.strokeStyle = isMajor ? major : minor;
        g.lineWidth = isMajor ? 2 : 1;
        g.beginPath();
        g.moveTo(x + 0.5, 0);
        g.lineTo(x + 0.5, size);
        g.stroke();
    }
    // horizontal lines
    for (let y = 0; y <= size; y += cell) {
        const isMajor = (y / cell) % majorEvery === 0;
        g.strokeStyle = isMajor ? major : minor;
        g.lineWidth = isMajor ? 2 : 1;
        g.beginPath();
        g.moveTo(0, y + 0.5);
        g.lineTo(size, y + 0.5);
        g.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    setSRGB(tex);
    tex.needsUpdate = true;
    return tex;
}

function makeRadialFade(size = 1024): THREE.Texture {
    if (!IS_BROWSER) {
        // Transparent 1x1 texture as a harmless placeholder during SSR
        const data = new Uint8Array([255, 255, 255, 0]);
        const tex = new THREE.DataTexture(data, 1, 1);
        setSRGB(tex);
        tex.needsUpdate = true;
        return tex;
    }
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(
        size / 2, size / 2, size * 0.25,
        size / 2, size / 2, size * 0.65
    );
    grd.addColorStop(0.0, 'rgba(0,0,0,0.0)');
    grd.addColorStop(1.0, 'rgba(0,0,0,0.45)');
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    setSRGB(tex);
    tex.needsUpdate = true;
    return tex;
}

// Helper: update the grid material's map texture while preserving repeat/anisotropy
function updateGridTexture(
  mesh: THREE.Mesh | null | undefined,
  pal: ModePalette
) {
  if (!mesh) return;
  const mat: any = (mesh as any).material;
  if (!mat) return;
  const prev: THREE.Texture | undefined = mat.map as any;
  const tex = makeGridTexture({
    cell: 64,
    majorEvery: 10,
    bg: pal.gridBg,
    minor: pal.gridMinor,
    major: pal.gridMajor,
  });
  const geom: any = (mesh.geometry as any);
  const width: number = geom?.parameters?.width ?? 0;
  const height: number = geom?.parameters?.height ?? 0;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (width && height) {
    tex.repeat.set((width / 2) / 10, (height / 2) / 10);
  } else if ((prev as any)?.repeat) {
    tex.repeat.copy((prev as any).repeat);
  }
  tex.anisotropy = (prev as any)?.anisotropy ?? 8;
  mat.map = tex;
  mat.needsUpdate = true;
  (mesh as any).visible = true;
  try { prev?.dispose?.(); } catch { /* noop */ }
}

// --- Public: add grid plane (surround) --------------------------------------
export function addSurroundingGrid(
    scene: THREE.Scene,
    ROOM_W: number,
    ROOM_D: number,
    renderer?: THREE.WebGLRenderer,
    palette?: ModePalette
) {
    const pal = palette ?? MODE_PALETTE.dark;
    const gridTex = makeGridTexture({
        cell: 64,
        majorEvery: 10,
        bg: pal.gridBg,
        minor: pal.gridMinor,
        major: pal.gridMajor,
    });

    const W = ROOM_W * 6;
    const D = ROOM_D * 6;

    gridTex.repeat.set(W / 10, D / 10);
    if (renderer) gridTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const gridMat = new THREE.MeshBasicMaterial({
        map: gridTex,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        toneMapped: false,
        // no polygonOffset: prevents it from being pulled in front of the floor
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), gridMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.12;     // pushed down to avoid z-fighting
    plane.renderOrder = 0;
    plane.name = 'SURROUND_GRID';
    scene.add(plane);

    const fadeTex = makeRadialFade();
    const fadeMat = new THREE.MeshBasicMaterial({
        map: fadeTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
    });
    const fade = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), fadeMat);
    fade.rotation.x = -Math.PI / 2;
    fade.position.y = -0.119;
    fade.renderOrder = 0;
    fade.name = 'SURROUND_FADE';
    scene.add(fade);

    if (!scene.fog) scene.fog = new THREE.FogExp2(0x0b0f16, 0.015);

    return { gridPlane: plane, fadePlane: fade };
}

export function buildEnvironment(
    scene: THREE.Scene,
    opts: { ROOM_W: number; ROOM_D: number; palette?: ModePalette },
    renderer?: THREE.WebGLRenderer
) {
    const { ROOM_W, ROOM_D } = opts;

    // Lights (cool shadows, warm hits)
    const hemi = new THREE.HemisphereLight(0x9fb6ff, 0x1a1b20, 0.55); hemi.name = 'HEMI'; scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff1c2, 0.95); dir.name = 'DIR_MAIN';
    dir.position.set(10, 14, 8); dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 140;
    scene.add(dir);
    const amb = new THREE.AmbientLight(0x223, 0.18); amb.name = 'AMBIENT'; scene.add(amb);

    const obstacles: THREE.Box3[] = [];

    // Surrounding grid
    addSurroundingGrid(scene, ROOM_W, ROOM_D, renderer, opts.palette);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 1.0 });
    const H = 3.3, T = 0.1;
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, H, T), wallMat); wallN.position.set(0, H / 2, -ROOM_D / 2); wallN.name = 'WALL_N';
    const wallS = wallN.clone(); wallS.position.set(0, H / 2, ROOM_D / 2); wallS.name = 'WALL_S';
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(T, H, ROOM_D), wallMat); wallE.position.set(ROOM_W / 2, H / 2, 0); wallE.name = 'WALL_E';
    const wallW = wallE.clone(); wallW.position.set(-ROOM_W / 2, H / 2, 0); wallW.name = 'WALL_W';
    scene.add(wallN, wallS, wallE, wallW);

    // Window strip
    let windowsMat: THREE.MeshBasicMaterial;
    if (IS_BROWSER) {
      const winCanvas = document.createElement('canvas'); winCanvas.width = 1024; winCanvas.height = 256;
      const wctx = winCanvas.getContext('2d')!; const g = wctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#bcd5ff'); g.addColorStop(1, '#7fb0ff'); wctx.fillStyle = g; wctx.fillRect(0, 0, 1024, 256);
      windowsMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(winCanvas), toneMapped: false, opacity: 0.9, transparent: true });
    } else {
      windowsMat = new THREE.MeshBasicMaterial({ color: 0x7fb0ff, toneMapped: false, opacity: 0.9, transparent: true });
    }
    const windows = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.2), windowsMat);
    windows.name = 'WINDOWS';
    windows.position.set(0, 2.4, -ROOM_D / 2 + 0.06); scene.add(windows);

    // Huge presentation screen
    const stageScreen = new THREE.Mesh(new THREE.PlaneGeometry(12.0, 4.5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    stageScreen.position.set(0, 2.6, -ROOM_D / 2 + 0.08); scene.add(stageScreen);

    // Local personal desk
    const localGroup = new THREE.Group();
    const deskTop = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.06, 0.8, 4, 0.05), new THREE.MeshStandardMaterial({ color: 0x6a6f7b, roughness: 0.8, metalness: 0.15 }));
    deskTop.position.set(ROOM_W / 2 - 4.0, 0.75, ROOM_D / 2 - 5.2);
    deskTop.castShadow = true; deskTop.receiveShadow = true; localGroup.add(deskTop);

    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.75, 12);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2f333b, roughness: 0.9 });
    const addLeg = (lx: number, lz: number) => { const leg = new THREE.Mesh(legGeo, legMat); leg.position.set(deskTop.position.x + lx, 0.375, deskTop.position.z + lz); scene.add(leg); };
    [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]].forEach(([x, z]) => addLeg(x, z));

    const monitorGeo = new THREE.BoxGeometry(1.2, 0.72, 0.06);
    const monitorMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.1,
        metalness: 0.8
    });
    const monitor = new THREE.Mesh(monitorGeo, monitorMat);
    monitor.position.set(deskTop.position.x, 2.2, deskTop.position.z);
    monitor.castShadow = true;
    localGroup.add(monitor);
    scene.add(monitor);


    // Lounge rug
    const rug = new THREE.Mesh(new RoundedBoxGeometry(5.2, 0.02, 3.8, 4, 0.1), new THREE.MeshStandardMaterial({ color: 0x343845, roughness: 0.9, metalness: 0.05, emissive: 0x1b1e28, emissiveIntensity: 0.05 }));
    rug.name = 'RUG';
    rug.position.set(0, 0.01, 10.5); rug.receiveShadow = true; scene.add(rug);

    const disposeEnv = () => {
        [wallN, wallS, wallE, wallW, windows, stageScreen, rug, deskTop, monitor].forEach(m => {
            try { (m as any).geometry?.dispose?.(); const mat = (m as any).material; if (Array.isArray(mat)) mat.forEach((mm: any) => mm.dispose?.()); else mat?.dispose?.(); } catch { }
        });
        try { legGeo.dispose(); legMat.dispose(); } catch { }
    };

    return { obstacles, stageScreen, localMonitor: monitor, disposeEnv };
}

// Apply theme to environment objects (walls, grid, fog, lights)
export function applyEnvironmentTheme(
  scene: THREE.Scene,
  theme: Mode
) {
  const setMatColor = (obj: THREE.Object3D | undefined | null, color: number, opts?: Partial<THREE.MeshStandardMaterial>) => {
    const m = obj as THREE.Mesh | undefined;
    if (!m || !(m.material as any)) return;
    const mat = m.material as any;
    if (mat.color) mat.color.set(color);
    // apply cached wall texture if applicable
    if (m.name && m.name.startsWith('WALL_')) {
      const wallTex = getWallTexture(theme);
      mat.map = wallTex;
      mat.toneMapped = true;
    }
    if (opts) {
      for (const k of Object.keys(opts)) (mat as any)[k] = (opts as any)[k];
    }
    mat.needsUpdate = true;
  };
  const pal = MODE_PALETTE[theme];
  if (theme === 'light') {
    // Softer light walls
    setMatColor(scene.getObjectByName('WALL_N'), pal.surroundWalls, { roughness: 1.0, metalness: 0.0 });
    setMatColor(scene.getObjectByName('WALL_S'), pal.surroundWalls, { roughness: 1.0, metalness: 0.0 });
    setMatColor(scene.getObjectByName('WALL_E'), pal.surroundWalls, { roughness: 1.0, metalness: 0.0 });
    setMatColor(scene.getObjectByName('WALL_W'), pal.surroundWalls, { roughness: 1.0, metalness: 0.0 });
    // Rug under sofa: warm light gray-beige
    setMatColor(scene.getObjectByName('RUG'), pal.rugLight, { emissive: 0x000000, emissiveIntensity: 0.0 } as any);
    // Update surrounding grid texture but keep layout identical
    const g = scene.getObjectByName('SURROUND_GRID') as THREE.Mesh | null;
    if (g && (g.material as any)) { updateGridTexture(g, pal); }
    const f = scene.getObjectByName('SURROUND_FADE'); if (f) f.visible = false;
    // Lights: brighten, cooler ambient
    const hemi = scene.getObjectByName('HEMI') as THREE.HemisphereLight | null; if (hemi) { hemi.intensity = 0.7; hemi.color.set(0xffffff); hemi.groundColor.set(0xbbbbbb); }
    const dir = scene.getObjectByName('DIR_MAIN') as THREE.DirectionalLight | null; if (dir) { dir.intensity = 0.8; dir.color.set(0xffffff); }
    const amb = scene.getObjectByName('AMBIENT') as THREE.AmbientLight | null; if (amb) { amb.intensity = 0.25; amb.color.set(0xffffff); }
    // No fog in light mode
    (scene as any).fog = null;
  } else {
    // Dark defaults
    setMatColor(scene.getObjectByName('WALL_N'), pal.surroundWalls, { roughness: 1.0, metalness: 0.0 });
    setMatColor(scene.getObjectByName('WALL_S'), pal.surroundWalls, { roughness: 1.0, metalness: 0.0 });
    setMatColor(scene.getObjectByName('WALL_E'), pal.surroundWalls, { roughness: 1.0, metalness: 0.0 });
    setMatColor(scene.getObjectByName('WALL_W'), pal.surroundWalls, { roughness: 1.0, metalness: 0.0 });
    // Rug: darker tone for contrast under sofa
    setMatColor(scene.getObjectByName('RUG'), pal.rugDark, { emissive: 0x1b1e28, emissiveIntensity: 0.05 } as any);
    const g2 = scene.getObjectByName('SURROUND_GRID') as THREE.Mesh | null;
    if (g2 && (g2.material as any)) { updateGridTexture(g2, pal); }
    const f = scene.getObjectByName('SURROUND_FADE'); if (f) f.visible = true;
    const hemi = scene.getObjectByName('HEMI') as THREE.HemisphereLight | null; if (hemi) { hemi.intensity = 0.55; hemi.color.set(0x9fb6ff); hemi.groundColor.set(0x1a1b20); }
    const dir = scene.getObjectByName('DIR_MAIN') as THREE.DirectionalLight | null; if (dir) { dir.intensity = 0.95; dir.color.set(0xfff1c2); }
    const amb = scene.getObjectByName('AMBIENT') as THREE.AmbientLight | null; if (amb) { amb.intensity = 0.18; amb.color.set(0x222233); }
    if (!scene.fog) scene.fog = new THREE.FogExp2(0x0b0f16, 0.015); else (scene.fog as any).color = new THREE.Color(0x0b0f16);
  }
}

// Smoothly animate between two palettes for environment pieces only
let ENV_THEME_ANIM: number | null = null;
export function animateEnvironmentTheme(
  scene: THREE.Scene,
  from: ModePalette,
  to: ModePalette,
  durationMs: number = 220
) {
  if (ENV_THEME_ANIM) { cancelAnimationFrame(ENV_THEME_ANIM); ENV_THEME_ANIM = null; }
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
  const fromCol = (n: number) => new THREE.Color(n);
  const toCol = (n: number) => new THREE.Color(n);

  const fromRug = from === MODE_PALETTE.light ? from.rugLight : from.rugDark;
  const toRug = to === MODE_PALETTE.light ? to.rugLight : to.rugDark;
  const targets: Array<{ mesh: THREE.Mesh | null; from: THREE.Color; to: THREE.Color }> = [
    { mesh: scene.getObjectByName('WALL_N') as THREE.Mesh, from: fromCol(from.surroundWalls), to: toCol(to.surroundWalls) },
    { mesh: scene.getObjectByName('WALL_S') as THREE.Mesh, from: fromCol(from.surroundWalls), to: toCol(to.surroundWalls) },
    { mesh: scene.getObjectByName('WALL_E') as THREE.Mesh, from: fromCol(from.surroundWalls), to: toCol(to.surroundWalls) },
    { mesh: scene.getObjectByName('WALL_W') as THREE.Mesh, from: fromCol(from.surroundWalls), to: toCol(to.surroundWalls) },
    { mesh: scene.getObjectByName('RUG') as THREE.Mesh, from: fromCol(fromRug), to: toCol(toRug) },
  ];
  const bg0 = new THREE.Color(from.sky);
  const bg1 = new THREE.Color(to.sky);

  // Grid cross-fade: fade out old, swap, fade in
  const grid = scene.getObjectByName('SURROUND_GRID') as THREE.Mesh | null;
  let gridSwapped = false;
  const gridMat: any = grid?.material;
  if (gridMat) { gridMat.transparent = true; }

  const t0 = performance.now();
  const step = () => {
    const now = performance.now();
    const k = Math.min(1, (now - t0) / durationMs);
    // Lerp colors
    targets.forEach(t => {
      if (!t.mesh) return;
      const m: any = t.mesh.material; if (!m || !m.color) return;
      m.color.r = lerp(t.from.r, t.to.r, k);
      m.color.g = lerp(t.from.g, t.to.g, k);
      m.color.b = lerp(t.from.b, t.to.b, k);
      m.needsUpdate = true;
    });
    // Background
    const bg = new THREE.Color(
      lerp(bg0.r, bg1.r, k),
      lerp(bg0.g, bg1.g, k),
      lerp(bg0.b, bg1.b, k)
    );
    scene.background = bg;

    // Grid fade out/in around mid point, preserving repeat/anisotropy
    if (grid && gridMat) {
      const half = 0.5;
      if (k < half) {
        gridMat.opacity = 1 - (k / half);
      } else {
        if (!gridSwapped) { updateGridTexture(grid, to); gridSwapped = true; }
        gridMat.opacity = (k - half) / half;
      }
    }

    if (k < 1) {
      ENV_THEME_ANIM = requestAnimationFrame(step);
    } else {
      ENV_THEME_ANIM = null;
      // Finalize
      applyEnvironmentTheme(scene, (to === MODE_PALETTE.light ? 'light' : 'dark') as Mode);
    }
  };
  step();
}
