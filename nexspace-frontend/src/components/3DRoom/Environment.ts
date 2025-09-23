import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// --- Util: set texture to sRGB across three versions
function setSRGB(tex: THREE.Texture) {
    (tex as any).colorSpace !== undefined
        ? ((tex as any).colorSpace = (THREE as any).SRGBColorSpace)
        : ((tex as any).encoding = (THREE as any).sRGBEncoding);
}

function makeGridTexture({
    size = 1024,
    cell = 64,
    majorEvery = 4,
    bg = '#202024',
    minor = 'rgba(190,200,215,0.25)',
    major = 'rgba(230,240,255,0.55)',
} = {}) {
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

function makeRadialFade(size = 1024) {
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

// --- Public: add grid plane (surround) --------------------------------------
export function addSurroundingGrid(
    scene: THREE.Scene,
    ROOM_W: number,
    ROOM_D: number,
    renderer?: THREE.WebGLRenderer
) {
    const gridTex = makeGridTexture({
        cell: 64,
        majorEvery: 10,
        bg: '#202024',
        minor: 'rgba(190,200,215,0.25)',
        major: 'rgba(230,240,255,0.55)',
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
    scene.add(fade);

    if (!scene.fog) scene.fog = new THREE.FogExp2(0x0b0f16, 0.015);
}

export function buildEnvironment(
    scene: THREE.Scene,
    opts: { ROOM_W: number; ROOM_D: number; },
    renderer?: THREE.WebGLRenderer
) {
    const { ROOM_W, ROOM_D } = opts;

    // Lights (cool shadows, warm hits)
    const hemi = new THREE.HemisphereLight(0x9fb6ff, 0x1a1b20, 0.55); scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff1c2, 0.95);
    dir.position.set(10, 14, 8); dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 1; dir.shadow.camera.far = 140;
    scene.add(dir);
    scene.add(new THREE.AmbientLight(0x223, 0.18));

    const obstacles: THREE.Box3[] = [];

    // Surrounding grid
    addSurroundingGrid(scene, ROOM_W, ROOM_D, renderer);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 1.0 });
    const H = 3.3, T = 0.1;
    const wallN = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, H, T), wallMat); wallN.position.set(0, H / 2, -ROOM_D / 2);
    const wallS = wallN.clone(); wallS.position.set(0, H / 2, ROOM_D / 2);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(T, H, ROOM_D), wallMat); wallE.position.set(ROOM_W / 2, H / 2, 0);
    const wallW = wallE.clone(); wallW.position.set(-ROOM_W / 2, H / 2, 0);
    scene.add(wallN, wallS, wallE, wallW);

    // Window strip
    const winCanvas = document.createElement('canvas'); winCanvas.width = 1024; winCanvas.height = 256;
    const wctx = winCanvas.getContext('2d')!; const g = wctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#bcd5ff'); g.addColorStop(1, '#7fb0ff'); wctx.fillStyle = g; wctx.fillRect(0, 0, 1024, 256);
    const windows = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(winCanvas), toneMapped: false, opacity: 0.9, transparent: true }));
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
    rug.position.set(0, 0.01, 10.5); rug.receiveShadow = true; scene.add(rug);

    const disposeEnv = () => {
        [wallN, wallS, wallE, wallW, windows, stageScreen, rug, deskTop, monitor].forEach(m => {
            try { (m as any).geometry?.dispose?.(); const mat = (m as any).material; if (Array.isArray(mat)) mat.forEach((mm: any) => mm.dispose?.()); else mat?.dispose?.(); } catch { }
        });
        try { legGeo.dispose(); legMat.dispose(); } catch { }
    };

    return { obstacles, stageScreen, localMonitor: monitor, disposeEnv };
}
