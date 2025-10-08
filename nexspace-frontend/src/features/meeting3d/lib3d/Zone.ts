import * as THREE from 'three';
import { createSofa } from './sofa';
import { createOfficeChair } from './officeChair';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MODE_PALETTE, type ModePalette, type FurniturePalette, getRoomPalette, resolveRoomPaletteKey, numberToHex } from './themeConfig';
import { ROOM_DEFINITIONS, ROOM_PORTALS } from '../rooms/definitions';
import type { RoomId } from '../rooms/types';
import { resolveRoomLayout, type ResolvedRoomLayout } from '../rooms/layout';

function createRealisticTiledFloor(
    scene: THREE.Scene,
    ROOM_W: number,
    ROOM_D: number,
    palette: import('./themeConfig').ModePalette
) {
    // Remove the old simple grid if it exists
    const existingGrid = scene.getObjectByName('floor-grid');
    if (existingGrid) {
        scene.remove(existingGrid);
    }

    // Floor parameters - use exact room dimensions
    const tileSize = 1.2; // Fixed tile size for consistent appearance

    // Calculate how many tiles fit in each direction
    const tilesX = Math.floor(ROOM_W / tileSize);
    const tilesZ = Math.floor(ROOM_D / tileSize);

    // Create the base floor plane to exactly match room size
    const baseFloorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
    const baseFloorMat = new THREE.MeshStandardMaterial({
        color: palette.floorBase,
        roughness: 0.15,
        metalness: 0.05,
    });

    const baseFloor = new THREE.Mesh(baseFloorGeo, baseFloorMat);
    baseFloor.rotation.x = -Math.PI / 2;
    baseFloor.position.y = -0.002;
    baseFloor.receiveShadow = true;
    baseFloor.name = 'floor-base';
    scene.add(baseFloor);

    // Create individual tiles
    const tileGroup = new THREE.Group();
    tileGroup.name = 'floor-grid';

    // Tile geometry (slightly smaller than tileSize to create gaps)
    const tileGeo = new THREE.PlaneGeometry(tileSize * 0.98, tileSize * 0.98);

    // Create tile materials
    const tileMaterials = (palette.floorTiles && palette.floorTiles.length ? palette.floorTiles : [0xB5BAC2, 0xA7ADB6, 0x7C828A])
        .map((c, i) => new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.22,
            metalness: 0.1,
            transparent: true,
            opacity: 0.88 + (i % 3) * 0.02
        }));

    // Create tiles - start from room boundaries and work inward
    const startX = -ROOM_W / 2 + tileSize / 2; // Start at left edge + half tile
    const startZ = -ROOM_D / 2 + tileSize / 2; // Start at front edge + half tile

    for (let i = 0; i < tilesX; i++) {
        for (let j = 0; j < tilesZ; j++) {
            const materialIndex = Math.floor(Math.random() * tileMaterials.length);
            const tileMaterial = tileMaterials[materialIndex];

            const tile = new THREE.Mesh(tileGeo, tileMaterial);
            tile.rotation.x = -Math.PI / 2;
            tile.position.set(
                startX + i * tileSize,
                -0.001,
                startZ + j * tileSize
            );

            // Add subtle random height variation
            tile.position.y += (Math.random() - 0.5) * 0.0005;
            tile.receiveShadow = true;
            tile.castShadow = false;

            tileGroup.add(tile);
        }
    }

    scene.add(tileGroup);

    // Add grout lines (merged into a single mesh to reduce draw calls)
    const groutPieces: THREE.BufferGeometry[] = [];
    for (let j = 0; j <= tilesZ; j++) {
        const g = new THREE.PlaneGeometry(ROOM_W, 0.003);
        g.rotateX(-Math.PI / 2);
        g.translate(0, 0.0005, startZ - tileSize / 2 + j * tileSize);
        groutPieces.push(g);
    }
    for (let i = 0; i <= tilesX; i++) {
        const g = new THREE.PlaneGeometry(0.003, ROOM_D);
        g.rotateX(-Math.PI / 2);
        g.translate(startX - tileSize / 2 + i * tileSize, 0.0005, 0);
        groutPieces.push(g);
    }
    const mergedGroutGeo = BufferGeometryUtils.mergeGeometries(groutPieces, false) || new THREE.PlaneGeometry(0, 0);
    const groutMat = new THREE.MeshBasicMaterial({ color: palette.floorGrout, transparent: true, opacity: 0.6 });
    const groutMesh = new THREE.Mesh(mergedGroutGeo, groutMat);
    groutMesh.name = 'floor-grout-merged';
    scene.add(groutMesh);

    // Enhanced lighting for tile visibility
    const floorSpotlight = new THREE.SpotLight(0xffffff, 0.3, 0, Math.PI / 8);
    floorSpotlight.position.set(0, 20, 0);
    floorSpotlight.target.position.set(0, 0, 0);
    floorSpotlight.castShadow = false;
    scene.add(floorSpotlight);
    scene.add(floorSpotlight.target);

    // Return cleanup function (same as before)
    return {
        dispose: () => {
            try { scene.remove(baseFloor); } catch { }
            try { scene.remove(tileGroup); } catch { }
            try { scene.remove(groutMesh); } catch { }
            try { scene.remove(floorSpotlight); scene.remove(floorSpotlight.target); } catch { }

            try { baseFloorGeo.dispose(); baseFloorMat.dispose(); } catch { }
            try { tileGeo.dispose(); tileMaterials.forEach(m => m.dispose()); } catch { }
            try { mergedGroutGeo.dispose(); (groutMesh.material as THREE.Material).dispose?.(); } catch { }

            try {
                tileGroup.traverse((o: any) => {
                    if (o?.isMesh) {
                        o.geometry?.dispose?.();
                        const m = o.material; Array.isArray(m) ? m.forEach((mm: any) => mm.dispose?.()) : m?.dispose?.();
                    }
                });
            } catch { }
        }
    };
}

export type BuiltZonesInfo = {
    zoneColliders: THREE.Box3[];
    disposeZones: () => void;
    openOfficeArea: { minX: number; maxX: number; minZ: number; maxZ: number };
    stageScreen: THREE.Mesh | null;
    roomRects: Array<{ id?: RoomId; name: string; rect: { minX: number; maxX: number; minZ: number; maxZ: number } }>;
    doorways: Array<{ x: number; z: number }>;
    landmarks: Array<{ name: string; x: number; z: number }>;
    navNodes: Array<{ id: string; x: number; z: number }>;
    navEdges: Array<[string, string]>;
    meta: { gameRect: { minX: number; maxX: number; minZ: number; maxZ: number } };
    roomLabels?: THREE.Sprite[];
    conferenceDoorBlocker?: THREE.Box3;
    conferenceDoorPanel?: THREE.Mesh;
    setConferenceDoorVisual?: (open: boolean) => void;
    conferenceDoorOpen?: boolean;
};

function labelSprite(text: string, scaleX = 3.0, palette: ModePalette, color?: string) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const cx = c.getContext('2d')!;
    cx.clearRect(0, 0, 512, 128);
    cx.fillStyle = palette.signage.panel;
    cx.fillRect(0, 0, 512, 128);
    cx.strokeStyle = color ?? palette.signage.border ?? palette.signage.text;
    cx.lineWidth = 5;
    cx.strokeRect(6, 6, 512 - 12, 128 - 12);
    cx.font = '600 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = palette.signage.glow; cx.shadowBlur = 10; cx.shadowOffsetY = 2;
    cx.fillStyle = palette.signage.text;
    cx.fillText(text, 256, 64);
    const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true });
    material.userData = { ...(material.userData ?? {}), canvas: c };
    const sp = new THREE.Sprite(material);
    sp.scale.set(scaleX, 1, 1);
    (sp as any).userData = { ...(sp as any).userData, labelText: text };
    return sp;
}

// Enhanced dice faces with warm colors
function makeDiceMaterials(): THREE.MeshStandardMaterial[] {
    const makeFace = (pips: [number, number][], faceColor = '#f8f4e6') => {
        const s = 256;
        const canv = document.createElement('canvas'); canv.width = canv.height = s;
        const g = canv.getContext('2d')!;

        // Gradient background for warmth
        const gradient = g.createLinearGradient(0, 0, s, s);
        gradient.addColorStop(0, faceColor);
        gradient.addColorStop(1, '#ede8d3');
        g.fillStyle = gradient;
        g.fillRect(0, 0, s, s);

        // Rounded corners
        g.globalCompositeOperation = 'destination-in';
        g.beginPath();
        g.roundRect(8, 8, s - 16, s - 16, 20);
        g.fill();
        g.globalCompositeOperation = 'source-over';

        // Pips with shadow
        g.fillStyle = '#2c1810';
        g.shadowColor = 'rgba(0,0,0,0.3)';
        g.shadowBlur = 3;
        g.shadowOffsetY = 1;
        const r = 18;
        pips.forEach(([cx, cy]) => {
            g.beginPath();
            g.arc(cx, cy, r, 0, Math.PI * 2);
            g.fill();
        });

        const tex = new THREE.CanvasTexture(canv);
        tex.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshStandardMaterial({
            map: tex,
            metalness: 0.1,
            roughness: 0.4,
            emissive: new THREE.Color(0x2a1810),
            emissiveIntensity: 0.02
        });
    };

    const mid = 128, off = 64, far = 196;
    return [
        makeFace([[far, mid]]),
        makeFace([[off, off], [far, far]]),
        makeFace([[mid, mid], [off, far], [far, off]]),
        makeFace([[off, off], [off, far], [far, off], [far, far]]),
        makeFace([[off, off], [off, far], [far, off], [far, far], [mid, mid]]),
        makeFace([[off, off], [off, mid], [off, far], [far, off], [far, mid], [far, far]])
    ];
}

// Create wood texture material
function createWoodMaterial(baseColor: number, roughness = 0.8): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness,
        metalness: 0.05,
        emissive: new THREE.Color(baseColor).multiplyScalar(0.05),
        emissiveIntensity: 0.1
    });
}

// Add warm ambient lighting to rooms
function addWarmLighting(scene: THREE.Scene, x: number, y: number, z: number, color: number, intensity = 0.4) {
    const light = new THREE.PointLight(color, intensity, 8, 2);
    light.position.set(x, y, z);
    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    scene.add(light);

    // Add subtle glow effect
    const glowGeometry = new THREE.SphereGeometry(0.1, 8, 6);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(light.position);
    scene.add(glow);
}

function addRoomWithDoor(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    rect: { minX: number; maxX: number; minZ: number; maxZ: number },
    height: number,
    thickness: number,
    door: { wall: 'N' | 'S' | 'E' | 'W', width: number, centerX?: number, centerZ?: number },
    color = 0x4a4a52,
    accentColor?: number,
    roomKey?: keyof ModePalette['rooms']
) {
    const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        metalness: 0.1,
        emissive: new THREE.Color(color).multiplyScalar(0.05),
        emissiveIntensity: 0.02
    });

    const segments: Array<{ x: number; y: number; z: number; w: number; h: number; d: number }> = [];
    const H = height, T = thickness;
    const spanX = rect.maxX - rect.minX;
    const spanZ = rect.maxZ - rect.minZ;
    const doorW = door.width;

    const addWallWithDoor = (wall: 'N' | 'S' | 'E' | 'W') => {
        if (wall === 'N' || wall === 'S') {
            const z = wall === 'N' ? rect.minZ : rect.maxZ;
            const cx = door.centerX ?? (rect.minX + rect.maxX) / 2;
            const leftW = (cx - doorW / 2) - rect.minX;
            const rightW = rect.maxX - (cx + doorW / 2);
            if (leftW > 0.01) segments.push({ x: rect.minX + leftW / 2, y: H / 2, z, w: leftW, h: H, d: T });
            if (rightW > 0.01) segments.push({ x: rect.maxX - rightW / 2, y: H / 2, z, w: rightW, h: H, d: T });
        } else {
            const x = wall === 'W' ? rect.minX : rect.maxX;
            const cz = door.centerZ ?? (rect.minZ + rect.maxZ) / 2;
            const topD = (cz - doorW / 2) - rect.minZ;
            const botD = rect.maxZ - (cz + doorW / 2);
            if (topD > 0.01) segments.push({ x, y: H / 2, z: rect.minZ + topD / 2, w: T, h: H, d: topD });
            if (botD > 0.01) segments.push({ x, y: H / 2, z: rect.maxZ - botD / 2, w: T, h: H, d: botD });
        }
    };

    if (door.wall === 'N') addWallWithDoor('N'); else segments.push({ x: (rect.minX + rect.maxX) / 2, y: H / 2, z: rect.minZ, w: spanX, h: H, d: T });
    if (door.wall === 'S') addWallWithDoor('S'); else segments.push({ x: (rect.minX + rect.maxX) / 2, y: H / 2, z: rect.maxZ, w: spanX, h: H, d: T });

    if (door.wall === 'W') addWallWithDoor('W'); else segments.push({ x: rect.minX, y: H / 2, z: (rect.minZ + rect.maxZ) / 2, w: T, h: H, d: spanZ });
    if (door.wall === 'E') addWallWithDoor('E'); else segments.push({ x: rect.maxX, y: H / 2, z: (rect.minZ + rect.maxZ) / 2, w: T, h: H, d: spanZ });

    for (const s of segments) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), mat);
        mesh.position.set(s.x, s.y, s.z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.name = 'ROOM_WALL';
        (mesh as any).userData.roomKey = roomKey;
        scene.add(mesh);
        colliders.push(new THREE.Box3().setFromObject(mesh));

        // Add accent stripe if accent color provided
        if (accentColor && s.h > 1.5) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(s.w * 0.95, 0.08, s.d * 0.95),
                new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.2 })
            );
            stripe.position.set(s.x, s.y + s.h * 0.3, s.z);
            stripe.name = 'ROOM_ACCENT';
            (stripe as any).userData.roomKey = roomKey;
            scene.add(stripe);
        }
    }
}


// type GlassRoomReturn = {
//     doorPanel: THREE.Mesh;
//     blockerBox: THREE.Box3;
//     wall: 'N' | 'S' | 'E' | 'W';
//     width: number;
//     centerX?: number;
//     centerZ?: number;
//     height: number;
//     thickness: number;
// };

function addGlassRoomWithOpenDoor(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    rect: { minX: number; maxX: number; minZ: number; maxZ: number },
    height: number,
    thickness: number,
    door: { wall: 'N' | 'S' | 'E' | 'W', width: number, centerX?: number, centerZ?: number },
): any {
    // Glass walls
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.12,
        metalness: 0.0,
        transmission: 0.92,
        thickness: 0.08,
        clearcoat: 0.3,
        clearcoatRoughness: 0.15
    });

    const H = height, T = thickness;
    const spanX = rect.maxX - rect.minX;
    const spanZ = rect.maxZ - rect.minZ;
    const doorW = door.width;
    const segments: Array<{ x: number; y: number; z: number; w: number; h: number; d: number }> = [];

    const addWallWithDoor = (wall: 'N' | 'S' | 'E' | 'W') => {
        if (wall === 'N' || wall === 'S') {
            const z = wall === 'N' ? rect.minZ : rect.maxZ;
            const cx = door.centerX ?? (rect.minX + rect.maxX) / 2;
            const leftW = (cx - doorW / 2) - rect.minX;
            const rightW = rect.maxX - (cx + doorW / 2);
            if (leftW > 0.01) segments.push({ x: rect.minX + leftW / 2, y: H / 2, z, w: leftW, h: H, d: T });
            if (rightW > 0.01) segments.push({ x: rect.maxX - rightW / 2, y: H / 2, z, w: rightW, h: H, d: T });
        } else {
            const x = wall === 'W' ? rect.minX : rect.maxX;
            const cz = door.centerZ ?? (rect.minZ + rect.maxZ) / 2;
            const topD = (cz - doorW / 2) - rect.minZ;
            const botD = rect.maxZ - (cz + doorW / 2);
            if (topD > 0.01) segments.push({ x, y: H / 2, z: rect.minZ + topD / 2, w: T, h: H, d: topD });
            if (botD > 0.01) segments.push({ x, y: H / 2, z: rect.maxZ - botD / 2, w: T, h: H, d: botD });
        }
    };

    if (door.wall === 'N') addWallWithDoor('N'); else segments.push({ x: (rect.minX + rect.maxX) / 2, y: H / 2, z: rect.minZ, w: spanX, h: H, d: T });
    if (door.wall === 'S') addWallWithDoor('S'); else segments.push({ x: (rect.minX + rect.maxX) / 2, y: H / 2, z: rect.maxZ, w: spanX, h: H, d: T });
    if (door.wall === 'W') addWallWithDoor('W'); else segments.push({ x: rect.minX, y: H / 2, z: (rect.minZ + rect.maxZ) / 2, w: T, h: H, d: spanZ });
    if (door.wall === 'E') addWallWithDoor('E'); else segments.push({ x: rect.maxX, y: H / 2, z: (rect.minZ + rect.maxZ) / 2, w: T, h: H, d: spanZ });

    for (const s of segments) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), glassMat);
        wall.matrixAutoUpdate = false; wall.position.set(s.x, s.y, s.z); wall.updateMatrix();
        wall.castShadow = false; wall.receiveShadow = true;
        scene.add(wall);
        colliders.push(new THREE.Box3().setFromObject(wall));
    }

    // Beige office ceiling (tiled, double-sided)
    const tileSize = 0.6; // ~60cm tiles
    const cTexCanvas = document.createElement('canvas'); cTexCanvas.width = cTexCanvas.height = 512;
    const cg = cTexCanvas.getContext('2d')!;
    cg.fillStyle = '#f1e5c8'; cg.fillRect(0, 0, 512, 512);
    // draw T-bar grid
    cg.strokeStyle = 'rgba(60,60,60,0.25)'; cg.lineWidth = 2;
    const step = Math.floor(512 / 8);
    for (let x = 0; x <= 512; x += step) { cg.beginPath(); cg.moveTo(x + 0.5, 0); cg.lineTo(x + 0.5, 512); cg.stroke(); }
    for (let y = 0; y <= 512; y += step) { cg.beginPath(); cg.moveTo(0, y + 0.5); cg.lineTo(512, y + 0.5); cg.stroke(); }
    const cTex = new THREE.CanvasTexture(cTexCanvas); cTex.wrapS = cTex.wrapT = THREE.RepeatWrapping;
    cTex.repeat.set(Math.max(1, spanX / tileSize), Math.max(1, spanZ / tileSize));
    const roof = new THREE.Mesh(
        new THREE.PlaneGeometry(spanX, spanZ),
        new THREE.MeshStandardMaterial({ color: 0xffffff, map: cTex, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide })
    );
    roof.rotation.x = -Math.PI / 2;
    roof.position.set((rect.minX + rect.maxX) / 2, H + 0.02, (rect.minZ + rect.maxZ) / 2);
    roof.receiveShadow = true;
    scene.add(roof);

    // Visual glass door panel (always open) — no collider so it stays passable
    const doorH = H * 0.92;
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, doorH, door.width), glassMat);
    if (door.wall === 'W') {
        const cz = door.centerZ ?? (rect.minZ + rect.maxZ) / 2;
        doorPanel.position.set(rect.minX + 0.6, doorH / 2, cz);
        doorPanel.rotation.y = Math.PI / 2; // swung open inside room
    } else if (door.wall === 'E') {
        const cz = door.centerZ ?? (rect.minZ + rect.maxZ) / 2;
        doorPanel.position.set(rect.maxX - 0.6, doorH / 2, cz);
        doorPanel.rotation.y = -Math.PI / 2;
    } else if (door.wall === 'N') {
        const cx = door.centerX ?? (rect.minX + rect.maxX) / 2;
        doorPanel.position.set(cx, doorH / 2, rect.minZ + 0.6);
        doorPanel.rotation.y = 0;
    } else { // 'S'
        const cx = door.centerX ?? (rect.minX + rect.maxX) / 2;
        doorPanel.position.set(cx, doorH / 2, rect.maxZ - 0.6);
        doorPanel.rotation.y = Math.PI;
    }
    scene.add(doorPanel);   // Compute blocker collider for the doorway (used when door is closed)\r\n    let blockerCenter: THREE.Vector3;\r\n    let blockerSize: THREE.Vector3;\r\n    if (door.wall === 'W' || door.wall === 'E') {\r\n        const cz = door.centerZ ?? (rect.minZ + rect.maxZ) / 2;\r\n        const bx = door.wall === 'W' ? rect.minX + T / 2 : rect.maxX - T / 2;\r\n        blockerCenter = new THREE.Vector3(bx, H / 2, cz);\r\n        blockerSize = new THREE.Vector3(T, H, door.width);\r\n    } else {\r\n        const cx = door.centerX ?? (rect.minX + rect.maxX) / 2;\r\n        const bz = door.wall === 'N' ? rect.minZ + T / 2 : rect.maxZ - T / 2;\r\n        blockerCenter = new THREE.Vector3(cx, H / 2, bz);\r\n        blockerSize = new THREE.Vector3(door.width, H, T);\r\n    }\r\n    const blockerBox = new THREE.Box3().setFromCenterAndSize(blockerCenter, blockerSize);\r\n\r\n    return { doorPanel, blockerBox, wall: door.wall, width: door.width, centerX: door.centerX, centerZ: door.centerZ, height: H, thickness: T };\r\n}\r\n
}
function segmentIntersectsAnyBox(a: THREE.Vector3, b: THREE.Vector3, boxes: THREE.Box3[]) {
    // Slightly slimmer probe to avoid false positives at tight doorways
    const half = 0.28;
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = new THREE.Vector3(a.x + (b.x - a.x) * t, 1.0, a.z + (b.z - a.z) * t);
        const probe = new THREE.Box3().setFromCenterAndSize(p, new THREE.Vector3(half, 1.8, half));
        for (const box of boxes) { if (box.intersectsBox(probe)) return true; }
    }
    return false;
}

export function buildZones(
    scene: THREE.Scene,
    { ROOM_W, ROOM_D, palette, mode, layout }: { ROOM_W: number; ROOM_D: number; palette?: import('./themeConfig').ModePalette; mode?: 'light' | 'dark'; layout?: ResolvedRoomLayout }
): BuiltZonesInfo {
    const activePalette: import('./themeConfig').ModePalette = palette ?? MODE_PALETTE[mode || 'dark'];
    const resolvedLayout: ResolvedRoomLayout = layout ?? resolveRoomLayout({ roomWidth: ROOM_W, roomDepth: ROOM_D, rooms: ROOM_DEFINITIONS });
    const furniture = activePalette.furniture;
    const colliders: THREE.Box3[] = [];

    // Enhanced big screen (north) with modern look
    const frameZ = -ROOM_D / 2 + 0.06;           // where you put the frame
    const bezelDepth = 0.08;                      // BoxGeometry z-size
    const eps = 0.001;                            // tiny offset (1 mm in world units)

    const screenFrame = new THREE.Mesh(
        new THREE.BoxGeometry(15.5, 8.0, bezelDepth),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.2 })
    );
    screenFrame.position.set(0, 2.7, frameZ);
    scene.add(screenFrame);

    const screenMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        emissive: 0x001122,
        emissiveIntensity: 0.3,
        roughness: 0.1,
        metalness: 0.8,
        polygonOffset: true,
        polygonOffsetFactor: -1,     // pull toward camera
        polygonOffsetUnits: -1,
    });

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(14.8, 7.3), screenMat);
    // place just in front of frame’s front face (center + half-thickness + epsilon)
    screen.position.set(0, 2.7, frameZ + bezelDepth / 2 + eps);
    scene.add(screen);

    // Room definitions with better spacing
    const roomById = (roomId: RoomId) => ROOM_DEFINITIONS.find((room) => room.id === roomId);
    const resolveBounds = (
        roomId: RoomId,
        fallback: { minX: number; maxX: number; minZ: number; maxZ: number }
    ) => {
        const match = resolvedLayout.get(roomId);
        if (match) {
            return { ...match.bounds };
        }
        const def = roomById(roomId);
        if (def) { return { ...def.bounds }; }
        return { ...fallback };
    };
    const lobbyRect = resolveBounds('lobby', { minX: -9.5, maxX: 9.5, minZ: -ROOM_D / 2 + 2.0, maxZ: -6.4 });
    const focusRect = resolveBounds('focus-booths', { minX: -22, maxX: -9, minZ: -14, maxZ: 0.5 });
    const conferenceRect = resolveBounds('conference', { minX: 6.5, maxX: 18, minZ: -12, maxZ: 6 });
    const loungeRect = resolveBounds('cafe-lounge', { minX: -4.5, maxX: 5.5, minZ: 4.5, maxZ: 14.5 });
    const openRect = resolveBounds('open-desk', { minX: -ROOM_W / 2 + 4.0, maxX: ROOM_W / 2 - 7.0, minZ: -1.0, maxZ: 12.5 });
    const gameRect = { minX: -18, maxX: -10.5, minZ: 6, maxZ: 13.5 };
    const pantryRect = { minX: ROOM_W / 2 - 9.0, maxX: ROOM_W / 2 - 3.2, minZ: ROOM_D / 2 - 9.2, maxZ: ROOM_D / 2 - 4.2 };

    const roomTitle = (roomId: RoomId, fallback: string) => roomById(roomId)?.title ?? fallback;
    const roomRects = [
        { id: 'lobby', name: roomTitle('lobby', 'Lobby'), rect: lobbyRect },
        { id: 'focus-booths', name: roomTitle('focus-booths', 'Focus Booths'), rect: focusRect },
        { id: 'conference', name: roomTitle('conference', 'Conference'), rect: conferenceRect },
        { id: 'cafe-lounge', name: roomTitle('cafe-lounge', 'Cafe Lounge'), rect: loungeRect },
        { id: 'open-desk', name: roomTitle('open-desk', 'Open Desk Area'), rect: openRect },
        { name: 'Cafe Games', rect: gameRect },
        { name: 'Cafe Prep', rect: pantryRect },
    ];

    // Walls with warm, inviting colors and modern design
    const doorways: Array<{ x: number; z: number }> = [];
    const addDoorway = (x: number, z: number) => {
        if (!doorways.some((d) => Math.abs(d.x - x) < 0.01 && Math.abs(d.z - z) < 0.01)) {
            doorways.push({ x, z });
        }
    };
    ROOM_PORTALS.forEach((portal) => addDoorway(portal.position.x, portal.position.z));

    // Focus Pod A - light powder blue (light mode friendly)
    const focusPaletteKey = resolveRoomPaletteKey('focus-booths');
    const focusColors = getRoomPalette(activePalette, 'focus-booths');
    addRoomWithDoor(
        scene,
        colliders,
        focusRect,
        2.5,
        0.12,
        { wall: 'E', width: 1.8, centerZ: -6.5 },
        focusColors.base,
        focusColors.accent,
        focusPaletteKey
    );
    addWarmLighting(scene, (focusRect.minX + focusRect.maxX) / 2, 2.2, (focusRect.minZ + focusRect.maxZ) / 2, focusColors.accent);

    // Conference Room — glass walls with open glass door and beige roof
    const conferenceColors = getRoomPalette(activePalette, 'conference');
    const confGlass = addGlassRoomWithOpenDoor(scene, colliders, conferenceRect, 5.2, 0.06, { wall: 'W', width: 2.2, centerZ: -2.0 });
    addWarmLighting(scene, (conferenceRect.minX + conferenceRect.maxX) / 2, 2.7, (conferenceRect.minZ + conferenceRect.maxZ) / 2, conferenceColors?.accent ?? activePalette.accent);

    // Lounge - warm peach
    const loungeColors = getRoomPalette(activePalette, 'cafe-lounge');
    addRoomWithDoor(
        scene,
        colliders,
        loungeRect,
        0.5,
        0.1,
        { wall: 'N', width: 2.6 },
        loungeColors.base,
        loungeColors.accent,
        resolveRoomPaletteKey('cafe-lounge')
    );
    addWarmLighting(scene, (loungeRect.minX + loungeRect.maxX) / 2, 2.2, (loungeRect.minZ + loungeRect.maxZ) / 2, loungeColors.accent);

    // Game Room - soft lavender
    const gameColors = getRoomPalette(activePalette, 'game');
    addRoomWithDoor(
        scene,
        colliders,
        gameRect,
        2.5,
        0.12,
        { wall: 'E', width: 2.0 },
        gameColors.base,
        gameColors.accent,
        'game'
    );
    addDoorway((gameRect.minX + gameRect.maxX) / 2, gameRect.minZ);
    addWarmLighting(scene, (gameRect.minX + gameRect.maxX) / 2, 2.2, (gameRect.minZ + gameRect.maxZ) / 2, gameColors.accent);

    // Kitchen - pale mint
    const kitchenColors = getRoomPalette(activePalette, 'kitchen');
    addRoomWithDoor(
        scene,
        colliders,
        pantryRect,
        2.5,
        0.1,
        { wall: 'W', width: 1.8 },
        kitchenColors.base,
        kitchenColors.accent,
        'kitchen'
    );
    addDoorway(pantryRect.minX, (pantryRect.minZ + pantryRect.maxZ) / 2);
    addWarmLighting(scene, (pantryRect.minX + pantryRect.maxX) / 2, 2.2, (pantryRect.minZ + pantryRect.maxZ) / 2, kitchenColors.accent);

    // 1) Compute center once
    const confCenter = {
        x: (conferenceRect.minX + conferenceRect.maxX) / 2,
        z: (conferenceRect.minZ + conferenceRect.maxZ) / 2
    };

    // 2) Make a pivot at the room center and add to scene
    const confPivot = new THREE.Group();
    confPivot.position.set(confCenter.x, 0, confCenter.z);
    scene.add(confPivot);

    // 3) Build everything as before, but temporarily add to scene (or a temp array)
    const created = []; // collect objects to reparent cleanly

    // --- table ---
    const tableLen = Math.min((conferenceRect.maxX - conferenceRect.minX) * 0.72, 8.0);
    const tableDepth = Math.min((conferenceRect.maxZ - conferenceRect.minZ) * 0.48, 3.2);

    const confTopMat = createWoodMaterial(furniture.conferenceTableTop, 0.35);
    confTopMat.userData.furnitureKey = 'conferenceTableTop';
    const confTableTop = new THREE.Mesh(
        new THREE.BoxGeometry(tableLen, 0.08, tableDepth),
        confTopMat
    );
    confTableTop.position.set(confCenter.x, 0.82, confCenter.z);
    confTableTop.castShadow = confTableTop.receiveShadow = true;
    scene.add(confTableTop);
    created.push(confTableTop);

    // legs
    const legMat = new THREE.MeshStandardMaterial({ color: furniture.conferenceTableLegs, metalness: 0.75, roughness: 0.25 });
    legMat.userData.furnitureKey = 'conferenceTableLegs';
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.78, 16);
    const legOffsetX = (tableLen / 2) - 0.25;
    const legOffsetZ = (tableDepth / 2) - 0.25;

    [[legOffsetX, legOffsetZ], [-legOffsetX, legOffsetZ], [legOffsetX, -legOffsetZ], [-legOffsetX, -legOffsetZ]]
        .forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(confCenter.x + lx, 0.39, confCenter.z + lz);
            leg.castShadow = leg.receiveShadow = true;
            scene.add(leg);
            created.push(leg);
        });

    // chairs
    const sideCount = 4;
    const gap = tableLen / (sideCount + 1);
    const chairDist = tableDepth / 2 + 0.55;
    const chairSeatColor = furniture.chairSeat;
    const chairFrameColor = furniture.chairFrame;
    const chairPlasticColor = furniture.chairPlastic;

    for (let i = 1; i <= sideCount; i++) {
        const offsetX = -tableLen / 2 + i * gap;

        const c1 = createOfficeChair({ seatColor: chairSeatColor, frameColor: chairFrameColor, plasticColor: chairPlasticColor, wheelCount: 5 });
        c1.group.position.set(confCenter.x + offsetX, 0, confCenter.z + chairDist);
        c1.group.rotation.y = Math.PI;
        scene.add(c1.group);
        created.push(c1.group);

        const c2 = createOfficeChair({ seatColor: chairSeatColor, frameColor: chairFrameColor, plasticColor: chairPlasticColor, wheelCount: 5 });
        c2.group.position.set(confCenter.x + offsetX, 0, confCenter.z - chairDist);
        c2.group.rotation.y = 0;
        scene.add(c2.group);
        created.push(c2.group);
    }

    const headDist = tableLen / 2 + 0.6;

    const cWest = createOfficeChair({ seatColor: chairSeatColor, frameColor: chairFrameColor, plasticColor: chairPlasticColor, wheelCount: 5 });
    cWest.group.position.set(confCenter.x - headDist, 0, confCenter.z);
    cWest.group.rotation.y = Math.PI / 2;
    scene.add(cWest.group);
    created.push(cWest.group);

    const cEast = createOfficeChair({ seatColor: chairSeatColor, frameColor: chairFrameColor, plasticColor: chairPlasticColor, wheelCount: 5 });
    cEast.group.position.set(confCenter.x + headDist, 0, confCenter.z);
    cEast.group.rotation.y = -Math.PI / 2;
    scene.add(cEast.group);
    created.push(cEast.group);

    // lamps
    const lampY = 2.2;
    const lampOffsetX = tableLen * 0.22;
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffe0a8, emissiveIntensity: 1.4 });
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x404040, wireframe: true });

    [-lampOffsetX, lampOffsetX].forEach((ox) => {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), bulbMat);
        bulb.position.set(confCenter.x + ox, lampY, confCenter.z);
        scene.add(bulb);
        created.push(bulb);

        const shade = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), frameMat);
        shade.position.copy(bulb.position);
        scene.add(shade);
        created.push(shade);

        const l = new THREE.PointLight(0xffd8a8, 0.9, 8, 2);
        l.position.copy(bulb.position);
        l.castShadow = true;
        scene.add(l);
        created.push(l);
    });

    // TV
    const tv = new THREE.Mesh(
        new THREE.PlaneGeometry(3.8, 2.1),
        new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.8 })
    );
    tv.position.set(conferenceRect.maxX - 0.07, 1.6, confCenter.z + 0.2);
    tv.rotation.y = -Math.PI / 2;
    tv.castShadow = true;
    scene.add(tv);
    created.push(tv);

    // 4) Re-parent all created objects UNDER the pivot, preserving world transform
    for (const obj of created) confPivot.attach(obj);

    // 5) Now rotate the pivot 90° around Y (about the room center)
    confPivot.rotation.y = Math.PI / 2;

    // 6) (Optional) Recompute colliders after rotation
    //    If you rely on world-space boxes, rebuild them now:
    // colliders.length = 0;
    // const bbox = new THREE.Box3().setFromObject(confPivot);
    // colliders.push(bbox);


    // Enhanced Game Room with modern table and detailed dice
    const gameCenter = { x: (gameRect.minX + gameRect.maxX) / 2, z: (gameRect.minZ + gameRect.maxZ) / 2 };
    const gameTopMat = createWoodMaterial(furniture.gameTableTop, 0.3);
    gameTopMat.userData.furnitureKey = 'gameTableTop';
    const tableTop = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.1, 1.4),
        gameTopMat
    );
    tableTop.position.set(gameCenter.x, 0.88, gameCenter.z);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    scene.add(tableTop);

    const gameLegMat = new THREE.MeshStandardMaterial({ color: furniture.gameTableLeg, metalness: 0.7, roughness: 0.3 });
    gameLegMat.userData.furnitureKey = 'gameTableLeg';
    const tableLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.82, 16),
        gameLegMat
    );
    tableLeg.position.set(gameCenter.x, 0.46, gameCenter.z);
    tableLeg.castShadow = true;
    scene.add(tableLeg);
    colliders.push(new THREE.Box3().setFromObject(tableTop));

    const diceMats = makeDiceMaterials();
    const dice = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), diceMats);
    dice.position.set(gameCenter.x + 0.3, tableTop.position.y + 0.22, gameCenter.z);
    dice.castShadow = true;
    dice.name = 'GAME_ROOM_DICE';
    scene.add(dice);

    // Enhanced Labels with click data
    const roomLabelSprites: THREE.Sprite[] = [];

    const focusLabel = roomTitle('focus-booths', 'Focus Booths');
    const focusColors = getRoomPalette(activePalette, 'focus-booths');
    const lblA = labelSprite(focusLabel, 3.2, activePalette, numberToHex(focusColors.accent));
    lblA.position.set((focusRect.minX + focusRect.maxX) / 2, 2.8, (focusRect.minZ + focusRect.maxZ) / 2);
    (lblA as any).userData = {
        roomName: focusLabel,
        centerX: (focusRect.minX + focusRect.maxX) / 2,
        centerZ: (focusRect.minZ + focusRect.maxZ) / 2
    };
    scene.add(lblA);
    roomLabelSprites.push(lblA);

    const conferenceLabel = roomTitle('conference', 'Conference Rooms');
    const conferenceColors = getRoomPalette(activePalette, 'conference');
    const conferenceAccent = conferenceColors?.accent ?? activePalette.accent;
    const lblC = labelSprite(conferenceLabel, 3.2, activePalette, numberToHex(conferenceAccent));
    lblC.position.set((conferenceRect.minX + conferenceRect.maxX) / 2, 2.9, (conferenceRect.minZ + conferenceRect.maxZ) / 2);
    (lblC as any).userData = {
        roomName: conferenceLabel,
        centerX: (conferenceRect.minX + conferenceRect.maxX) / 2,
        centerZ: (conferenceRect.minZ + conferenceRect.maxZ) / 2
    };
    scene.add(lblC);
    roomLabelSprites.push(lblC);

    const loungeLabel = roomTitle('cafe-lounge', 'Cafe Lounge');
    const loungeColors = getRoomPalette(activePalette, 'cafe-lounge');
    const lblL = labelSprite(loungeLabel, 3.2, activePalette, numberToHex(loungeColors.accent));
    lblL.position.set((loungeRect.minX + loungeRect.maxX) / 2, 2.8, (loungeRect.minZ + loungeRect.maxZ) / 2);
    (lblL as any).userData = {
        roomName: loungeLabel,
        centerX: (loungeRect.minX + loungeRect.maxX) / 2,
        centerZ: (loungeRect.minZ + loungeRect.maxZ) / 2
    };
    scene.add(lblL);
    roomLabelSprites.push(lblL);

    const gameColors = getRoomPalette(activePalette, 'game');
    const lblG = labelSprite('Cafe Games', 3.0, activePalette, numberToHex(gameColors.accent));
    lblG.position.set((gameRect.minX + gameRect.maxX) / 2, 2.8, (gameRect.minZ + gameRect.maxZ) / 2);
    (lblG as any).userData = {
        roomName: 'Cafe Games',
        centerX: (gameRect.minX + gameRect.maxX) / 2,
        centerZ: (gameRect.minZ + gameRect.maxZ) / 2
    };
    scene.add(lblG);
    roomLabelSprites.push(lblG);

    const kitchenColors = getRoomPalette(activePalette, 'kitchen');
    const lblKitchen = labelSprite('Kitchen', 3.0, activePalette, numberToHex(kitchenColors.accent));
    lblKitchen.position.set((pantryRect.minX + pantryRect.maxX) / 2, 2.2, (pantryRect.minZ + pantryRect.maxZ) / 2);
    (lblKitchen as any).userData = {
        roomName: 'Kitchen',
        centerX: (pantryRect.minX + pantryRect.maxX) / 2,
        centerZ: (pantryRect.minZ + pantryRect.maxZ) / 2
    };
    scene.add(lblKitchen);
    roomLabelSprites.push(lblKitchen);

    // Enhanced Landmarks with glowing pebbles
    const landmarks: Array<{ name: string; x: number; z: number }> = [];
    function pebble(name: string, x: number, z: number, color = 0x7fffd4) {
        const geom = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 24);
        const mat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.8,
            metalness: 0.4,
            roughness: 0.2
        });
        const m = new THREE.Mesh(geom, mat);
        m.position.set(x, 0.04, z);
        m.name = `TP_${name.replace(/\s+/g, '_')}`;
        m.castShadow = true;
        scene.add(m);
        landmarks.push({ name, x, z });

        // Add subtle glow
        const glowRing = new THREE.Mesh(
            new THREE.RingGeometry(0.25, 0.35, 16),
            new THREE.MeshStandardMaterial({
                color,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
                emissive: color,
                emissiveIntensity: 0.2
            })
        );
        glowRing.rotation.x = -Math.PI / 2;
        glowRing.position.set(x, 0.01, z);
        scene.add(glowRing);
    }

    pebble('Stage', 0, -ROOM_D / 2 + 3.0, activePalette.accent);
    pebble('Conference Table', confCenter.x, confCenter.z, activePalette.rooms.conference?.accent ?? activePalette.accent);
    pebble('Lounge', (loungeRect.minX + loungeRect.maxX) / 2, (loungeRect.minZ + loungeRect.maxZ) / 2, activePalette.rooms.lounge.accent);
    pebble('Game Table', gameCenter.x, gameCenter.z, activePalette.rooms.game.accent);
    pebble('Kitchen', (pantryRect.minX + pantryRect.maxX) / 2, (pantryRect.minZ + pantryRect.maxZ) / 2, activePalette.rooms.kitchen.accent);

    // Add some decorative plants in the open area
    const plantPositions = [
        { x: -5, z: 5 }, { x: 8, z: 3 }, { x: 2, z: 8 }, { x: -8, z: 6 }
    ];
    plantPositions.forEach((pos) => {
        const potMaterial = new THREE.MeshStandardMaterial({ color: furniture.plantPot, roughness: 0.8 });
        potMaterial.userData.furnitureKey = 'plantPot';
        const pot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.35, 0.6, 12),
            potMaterial
        );
        pot.position.set(pos.x, 0.3, pos.z);
        pot.castShadow = true;
        pot.receiveShadow = true;
        scene.add(pot);

        const plantMaterial = new THREE.MeshStandardMaterial({ color: furniture.plantLeaf, roughness: 0.9 });
        plantMaterial.userData.furnitureKey = 'plantLeaf';
        const plant = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 8, 6),
            plantMaterial
        );
        plant.position.set(pos.x, 0.8, pos.z);
        plant.scale.set(1, 1.2, 1);
        scene.add(plant);
    });

    // Navigation graph
    const navNodes: Array<{ id: string; x: number; z: number }> = [];
    const pushNode = (id: string, x: number, z: number) => { navNodes.push({ id, x, z }); };
    const center = (r: { minX: number; maxX: number; minZ: number; maxZ: number }) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });

    pushNode('open', (openRect.minX + openRect.maxX) / 2, (openRect.minZ + openRect.maxZ) / 2);
    pushNode('conf', center(conferenceRect).x, center(conferenceRect).z);
    pushNode('lounge', center(loungeRect).x, center(loungeRect).z);
    pushNode('game', center(gameRect).x, center(gameRect).z);
    pushNode('pantry', center(pantryRect).x, center(pantryRect).z);
    doorways.forEach((d, i) => pushNode(`door${i}`, d.x, d.z));
    landmarks.forEach((lm, i) => pushNode(`lm${i}`, lm.x, lm.z));

    const navEdges: Array<[string, string]> = [];
    for (let i = 0; i < navNodes.length; i++) {
        for (let j = i + 1; j < navNodes.length; j++) {
            const A = navNodes[i], B = navNodes[j];
            const d2 = (A.x - B.x) * (A.x - B.x) + (A.z - B.z) * (A.z - B.z);
            if (d2 < 120) {
                if (!segmentIntersectsAnyBox(new THREE.Vector3(A.x, 1, A.z), new THREE.Vector3(B.x, 1, B.z), colliders)) {
                    navEdges.push([A.id, B.id]);
                }
            }
        }
    }

    // Add ambient lighting for the overall space
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    // Add main overhead lighting
    // const mainLight = new THREE.DirectionalLight(0xffffff, 0.6);
    // mainLight.position.set(0, 20, 0);
    // mainLight.castShadow = true;
    // mainLight.shadow.mapSize.width = 2048;
    // mainLight.shadow.mapSize.height = 2048;
    // mainLight.shadow.camera.near = 0.5;
    // mainLight.shadow.camera.far = 50;
    // mainLight.shadow.camera.left = -ROOM_W / 2;
    // mainLight.shadow.camera.right = ROOM_W / 2;
    // mainLight.shadow.camera.top = ROOM_D / 2;
    // mainLight.shadow.camera.bottom = -ROOM_D / 2;
    // scene.add(mainLight);

    // Lighting setup
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(10, 15, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
    scene.add(directionalLight);

    // Add floor with subtle pattern
    createRealisticTiledFloor(scene, ROOM_W, ROOM_D, activePalette);
    // const floorGeometry = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
    // const floorMaterial = new THREE.MeshStandardMaterial({
    //     color: 0x2d2d2d,
    //     roughness: 0.8,
    //     metalness: 0.1,
    //     emissive: 0x0a0a0a,
    //     emissiveIntensity: 0.05
    // });
    // const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    // floor.rotation.x = -Math.PI / 2;
    // floor.position.y = 0;
    // floor.receiveShadow = true;
    // scene.add(floor);



    // Add coffee station in open area
    const coffeeStation = {
        x: (openRect.minX + openRect.maxX) / 2 - 2,
        z: (openRect.minZ + openRect.maxZ) / 2 + 7
    };

    const counterMat = createWoodMaterial(furniture.coffeeCounter, 0.4);
    counterMat.userData.furnitureKey = 'coffeeCounter';
    const coffeeCounter = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.9, 0.9),
        counterMat
    );
    coffeeCounter.position.set(coffeeStation.x, 0.45, coffeeStation.z);

    coffeeCounter.castShadow = true;
    coffeeCounter.receiveShadow = true;
    coffeeCounter.rotateY(Math.PI / 2);
    scene.add(coffeeCounter);
    colliders.push(new THREE.Box3().setFromObject(coffeeCounter));

    // Add coffee machine
    const coffeeMachineMat = new THREE.MeshStandardMaterial({
        color: furniture.coffeeMachineBody,
        metalness: 0.7,
        roughness: 0.3,
        emissive: new THREE.Color(furniture.coffeeMachineAccent).multiplyScalar(0.12),
        emissiveIntensity: 0.5,
    });
    coffeeMachineMat.userData.furnitureKey = 'coffeeMachineBody';
    const coffeeMachine = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.7, 0.5),
        coffeeMachineMat
    );
    coffeeMachine.position.set(coffeeStation.x, 1.15, coffeeStation.z);

    scene.add(coffeeMachine);

    const coffeeAccentMat = new THREE.MeshStandardMaterial({
        color: furniture.coffeeMachineAccent,
        emissive: furniture.coffeeMachineAccent,
        emissiveIntensity: 0.25,
        metalness: 0.4,
        roughness: 0.35,
    });
    coffeeAccentMat.userData.furnitureKey = 'coffeeMachineAccent';
    const coffeeAccent = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.05), coffeeAccentMat);
    coffeeAccent.position.set(coffeeStation.x, 1.26, coffeeStation.z + 0.28);
    scene.add(coffeeAccent);

    // Add some seating in open area
    const casualSeats = [
        { x: 0.5, z: 13, rotation: Math.PI }, { x: -2, z: 10, rotation: Math.PI / 2 }, { x: 3, z: 10, rotation: -Math.PI / 2 }
    ];

    casualSeats.forEach(seat => {
        const sofa = createSofa({ fabricColor: furniture.sofaFabric, legColor: furniture.sofaLegs });
        sofa.position.set(seat.x, 0, seat.z);
        sofa.rotation.y = seat.rotation
        scene.add(sofa);
    });

    const disposeZones = () => {
        // Cleanup function for disposing resources if needed
    };

    return {
        zoneColliders: colliders,
        disposeZones,
        openOfficeArea: openRect,
        stageScreen: screen,
        roomRects,
        doorways,
        landmarks,
        navNodes,
        navEdges,
        meta: { gameRect },
        roomLabels: roomLabelSprites,
        conferenceDoorBlocker: confGlass?.blockerBox,
        conferenceDoorPanel: confGlass?.doorPanel,
        conferenceDoorOpen: true,
        setConferenceDoorVisual: (open: boolean) => {
            try {
                const d: any = confGlass;
                if (!d) return;
                const doorH = (d.height) * 0.92;
                const cz = d.centerZ ?? (conferenceRect.minZ + conferenceRect.maxZ) / 2;
                if (d.wall === 'W') {
                    if (open) {
                        d.doorPanel.position.set(conferenceRect.minX + 0.6, doorH / 2, cz);
                        d.doorPanel.rotation.y = Math.PI / 2;
                    } else {
                        d.doorPanel.position.set(conferenceRect.minX + d.thickness / 2, doorH / 2, cz);
                        d.doorPanel.rotation.y = 0;
                    }
                }
            } catch { }
        }

    };
}


function applyFurnitureTheme(scene: THREE.Scene, palette: ModePalette) {
    const seenMaterials = new Set<THREE.Material>();
    scene.traverse((obj: any) => {
        if (!obj?.isMesh) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
            if (!mat || seenMaterials.has(mat)) continue;
            seenMaterials.add(mat);
            const key = (mat.userData?.furnitureKey ?? obj.userData?.furnitureKey) as keyof FurniturePalette | undefined;
            if (!key) continue;
            const color = palette.furniture?.[key];
            if (typeof color === 'number' && mat.color) {
                mat.color.set(color);
                mat.needsUpdate = true;
            }
        }
    });
}


export function applyZoneTheme(scene: THREE.Scene, palette: ModePalette) {
    try {
        // Floor base
        const base = scene.getObjectByName('floor-base') as THREE.Mesh | null;
        if (base && (base.material as any)?.color) {
            ((base.material as any).color as THREE.Color).set(palette.floorBase);
            (base.material as any).needsUpdate = true;
        }
        // Floor tiles
        const grid = scene.getObjectByName('floor-grid') as THREE.Group | null;
        if (grid) {
            const lc = palette.floorTiles && palette.floorTiles.length ? palette.floorTiles : [0xB5BAC2, 0xA7ADB6, 0x7C828A];
            let idx = 0;
            grid.traverse((o: any) => {
                if (o && o.isMesh && o.material && (o.material as any).color) {
                    const c = lc[idx++ % lc.length];
                    ((o.material as any).color as THREE.Color).set(c);
                    (o.material as any).needsUpdate = true;
                }
            });
        }
        // Grout
        const grout = scene.getObjectByName('floor-grout-merged') as THREE.Mesh | null;
        if (grout && (grout.material as any)?.color) {
            ((grout.material as any).color as THREE.Color).set(palette.floorGrout);
            (grout.material as any).needsUpdate = true;
        }

        // Room walls & accents
        const applyColorTo = (obj: THREE.Object3D | null, color: number) => {
            if (!obj) return;
            const m: any = (obj as any).material;
            if (m && m.color) { m.color.set(color); m.needsUpdate = true; }
        };
        scene.traverse((o) => {
            if (!(o as any).isMesh) return;
            if (o.name === 'ROOM_WALL' || o.name === 'ROOM_ACCENT') {
                const key = (o as any).userData?.roomKey as keyof ModePalette['rooms'] | undefined;
                if (!key || !palette.rooms[key]) return;
                const col = o.name === 'ROOM_WALL' ? palette.rooms[key].base : palette.rooms[key].accent;
                applyColorTo(o, col);
            }
        });

        applyFurnitureTheme(scene, palette);

        scene.traverse((obj: any) => {
            if (!obj?.isSprite) return;
            const labelText = obj.userData?.labelText as string | undefined;
            const canvas = obj.material?.userData?.canvas as HTMLCanvasElement | undefined;
            if (!labelText || !canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = palette.signage.panel;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = palette.signage.border || numberToHex(palette.accent);
            ctx.lineWidth = 5;
            ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
            ctx.font = '600 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = palette.signage.glow;
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 2;
            ctx.fillStyle = palette.signage.text;
            ctx.fillText(labelText, canvas.width / 2, canvas.height / 2);
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            const tex = obj.material.map as THREE.CanvasTexture | undefined;
            if (tex) tex.needsUpdate = true;
            obj.material.needsUpdate = true;
        });
    } catch { /* ignore */ }
}

// Smoothly animate zone (floor + room walls) colors between palettes
let ZONE_THEME_ANIM: number | null = null;
export function animateZoneTheme(scene: THREE.Scene, from: ModePalette, to: ModePalette, durationMs: number = 200) {
    if (ZONE_THEME_ANIM) { cancelAnimationFrame(ZONE_THEME_ANIM); ZONE_THEME_ANIM = null; }
    const t0 = performance.now();
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

    const floorBase = scene.getObjectByName('floor-base') as THREE.Mesh | null;
    const baseFrom = new THREE.Color(from.floorBase); const baseTo = new THREE.Color(to.floorBase);

    // We snap tile colors (many materials) to avoid heavy per-frame loops.
    // If preferred, we can animate tiles too later.

    // Pre-collect room walls/accents by key
    const roomMeshes: Array<{ m: any; from: THREE.Color; to: THREE.Color }> = [];
    scene.traverse((o) => {
        const mesh: any = o as any;
        if (!mesh?.isMesh || !mesh.material) return;
        if (o.name === 'ROOM_WALL' || o.name === 'ROOM_ACCENT') {
            const key = mesh.userData?.roomKey as keyof ModePalette['rooms'] | undefined; if (!key) return;
            const toRoom = (to.rooms as any)[key];
            const fromRoom = (from.rooms as any)[key];
            if (!toRoom || !fromRoom) return;
            const target = o.name === 'ROOM_WALL' ? toRoom.base : toRoom.accent;
            const source = o.name === 'ROOM_WALL' ? fromRoom.base : fromRoom.accent;
            roomMeshes.push({ m: mesh.material, from: new THREE.Color(source), to: new THREE.Color(target) });
        }
    });

    applyFurnitureTheme(scene, to);

    const step = () => {
        const k = Math.min(1, (performance.now() - t0) / durationMs);
        if (floorBase && (floorBase.material as any)?.color) {
            const c: any = (floorBase.material as any).color;
            c.r = lerp(baseFrom.r, baseTo.r, k);
            c.g = lerp(baseFrom.g, baseTo.g, k);
            c.b = lerp(baseFrom.b, baseTo.b, k);
            (floorBase.material as any).needsUpdate = true;
        }
        for (const it of roomMeshes) {
            if (!it.m?.color) continue;
            it.m.color.r = lerp(it.from.r, it.to.r, k);
            it.m.color.g = lerp(it.from.g, it.to.g, k);
            it.m.color.b = lerp(it.from.b, it.to.b, k);
            it.m.needsUpdate = true;
        }
        if (k < 1) {
            ZONE_THEME_ANIM = requestAnimationFrame(step);
        } else {
            ZONE_THEME_ANIM = null;
            applyZoneTheme(scene, to); // ensure final colors applied everywhere
        }
    };
    step();
}


















