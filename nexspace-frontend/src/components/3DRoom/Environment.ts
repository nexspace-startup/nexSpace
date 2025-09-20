import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function buildEnvironment(
    scene: THREE.Scene,
    opts: { ROOM_W: number; ROOM_D: number; carpet: () => THREE.Texture }
) {
    const { ROOM_W, ROOM_D, carpet } = opts;

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
    const grid = new THREE.GridHelper(ROOM_W * 6, 80, 0x2b2f3a, 0x2a2f39);
    (grid.material as any).opacity = 0.32; (grid.material as any).transparent = true;
    grid.position.y = -0.001; scene.add(grid);

    // Main office floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), new THREE.MeshStandardMaterial({ map: carpet(), color: 0x272a33, roughness: 0.96 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

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

    const mon = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    mon.position.set(deskTop.position.x, 0.75 + 0.3, deskTop.position.z - 0.15);
    localGroup.add(mon);
    scene.add(localGroup);

    // Lounge rug
    const rug = new THREE.Mesh(new RoundedBoxGeometry(5.2, 0.02, 3.8, 4, 0.1), new THREE.MeshStandardMaterial({ color: 0x343845, roughness: 0.9, metalness: 0.05, emissive: 0x1b1e28, emissiveIntensity: 0.05 }));
    rug.position.set(0, 0.01, 10.5); rug.receiveShadow = true; scene.add(rug);

    const disposeEnv = () => {
        [floor, wallN, wallS, wallE, wallW, windows, stageScreen, rug, deskTop, mon].forEach(m => {
            try { (m as any).geometry?.dispose?.(); const mat = (m as any).material; if (Array.isArray(mat)) mat.forEach((mm: any) => mm.dispose?.()); else mat?.dispose?.(); } catch { }
        });
        try { legGeo.dispose(); legMat.dispose(); } catch { }
    };

    return { obstacles, stageScreen, localMonitor: mon, disposeEnv };
}
