import * as THREE from 'three';
import { createSofa } from './sofa';

function createRealisticTiledFloor(scene: THREE.Scene, ROOM_W: number, ROOM_D: number) {
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
        color: 0x1a1a1a,
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
    const tileMaterials = [
        new THREE.MeshStandardMaterial({
            color: 0xb5bac2,
            roughness: 0.2,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9
        }),
        new THREE.MeshStandardMaterial({
            color: 0xa7adb6,
            roughness: 0.25,
            metalness: 0.08,
            transparent: true,
            opacity: 0.85
        }),
        new THREE.MeshStandardMaterial({
            color: 0x7c828a,
            roughness: 0.18,
            metalness: 0.12,
            transparent: true,
            opacity: 0.95
        })
    ];

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

    // Add grout lines
    const groutGroup = new THREE.Group();
    groutGroup.name = 'floor-grout';

    // Horizontal grout lines (running along X axis)
    for (let j = 0; j <= tilesZ; j++) {
        const groutGeo = new THREE.PlaneGeometry(ROOM_W, 0.003);
        const groutMat = new THREE.MeshBasicMaterial({
            color: 0x151518,
            transparent: true,
            opacity: 0.6
        });

        const groutLine = new THREE.Mesh(groutGeo, groutMat);
        groutLine.rotation.x = -Math.PI / 2;
        groutLine.position.set(0, 0.0005, startZ - tileSize / 2 + j * tileSize);
        groutGroup.add(groutLine);
    }

    // Vertical grout lines (running along Z axis)
    for (let i = 0; i <= tilesX; i++) {
        const groutGeo = new THREE.PlaneGeometry(0.003, ROOM_D);
        const groutMat = new THREE.MeshBasicMaterial({
            color: 0x151518,
            transparent: true,
            opacity: 0.6
        });

        const groutLine = new THREE.Mesh(groutGeo, groutMat);
        groutLine.rotation.x = -Math.PI / 2;
        groutLine.position.set(startX - tileSize / 2 + i * tileSize, 0.0005, 0);
        groutGroup.add(groutLine);
    }

    scene.add(groutGroup);

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
            scene.remove(baseFloor);
            scene.remove(tileGroup);
            scene.remove(groutGroup);
            scene.remove(floorSpotlight);

            baseFloorGeo.dispose();
            baseFloorMat.dispose();
            tileGeo.dispose();
            tileMaterials.forEach(mat => mat.dispose());

            tileGroup.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });

            groutGroup.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
    };
}

export type BuiltZonesInfo = {
    zoneColliders: THREE.Box3[];
    disposeZones: () => void;
    openOfficeArea: { minX: number; maxX: number; minZ: number; maxZ: number };
    stageScreen: THREE.Mesh | null;
    roomRects: Array<{ name: string; rect: { minX: number; maxX: number; minZ: number; maxZ: number } }>;
    doorways: Array<{ x: number; z: number }>;
    landmarks: Array<{ name: string; x: number; z: number }>;
    navNodes: Array<{ id: string; x: number; z: number }>;
    navEdges: Array<[string, string]>;
    meta: { gameRect: { minX: number; maxX: number; minZ: number; maxZ: number } };
    roomLabels?: THREE.Sprite[];
};

function labelSprite(text: string, scaleX = 3.0, color = '#ffffff') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const cx = c.getContext('2d')!;
    cx.clearRect(0, 0, 512, 128);
    cx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = 'rgba(0,0,0,0.8)'; cx.shadowBlur = 8; cx.shadowOffsetY = 3;
    cx.fillStyle = color; cx.fillText(text, 256, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    sp.scale.set(scaleX, 1, 1);
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
    accentColor?: number
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
        scene.add(mesh);
        colliders.push(new THREE.Box3().setFromObject(mesh));

        // Add accent stripe if accent color provided
        if (accentColor && s.h > 1.5) {
            const stripe = new THREE.Mesh(
                new THREE.BoxGeometry(s.w * 0.95, 0.08, s.d * 0.95),
                new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.2 })
            );
            stripe.position.set(s.x, s.y + s.h * 0.3, s.z);
            scene.add(stripe);
        }
    }
}

function segmentIntersectsAnyBox(a: THREE.Vector3, b: THREE.Vector3, boxes: THREE.Box3[]) {
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = new THREE.Vector3(a.x + (b.x - a.x) * t, 1.0, a.z + (b.z - a.z) * t);
        const probe = new THREE.Box3().setFromCenterAndSize(p, new THREE.Vector3(0.3, 1.8, 0.3));
        for (const box of boxes) { if (box.intersectsBox(probe)) return true; }
    }
    return false;
}

export function buildZones(
    scene: THREE.Scene,
    { ROOM_W, ROOM_D }: { ROOM_W: number; ROOM_D: number; }
): BuiltZonesInfo {
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
    // change positions of rooms and when you change, change label, lighting, and doorways too
    const huddleA = { minX: -22, maxX: -9, minZ: -14, maxZ: 0.5 };
    const confRoom = { minX: 6.5, maxX: 18, minZ: -12, maxZ: 6 };
    const loungeRect = { minX: -4.5, maxX: 5.5, minZ: 4.5, maxZ: 14.5 };
    const gameRect = { minX: -18, maxX: -10.5, minZ: 6, maxZ: 13.5 };
    const pantryRect = { minX: ROOM_W / 2 - 9.0, maxX: ROOM_W / 2 - 3.2, minZ: ROOM_D / 2 - 9.2, maxZ: ROOM_D / 2 - 4.2 };
    const openRect = { minX: -ROOM_W / 2 + 4.0, maxX: ROOM_W / 2 - 7.0, minZ: -1.0, maxZ: 12.5 };

    const roomRects = [
        { name: 'Focus Pod A', rect: huddleA },
        { name: 'Conference', rect: confRoom },
        { name: 'Lounge', rect: loungeRect },
        { name: 'Game Room', rect: gameRect },
        { name: 'Kitchen', rect: pantryRect },
        { name: 'Open Office', rect: openRect },
    ];

    // Walls with warm, inviting colors and modern design
    const doorways: Array<{ x: number; z: number }> = [];

    // Focus Pod A - calm blue-gray
    addRoomWithDoor(scene, colliders, huddleA, 2.5, 0.12, { wall: 'E', width: 1.8, centerZ: -6.5 }, 0x3d4a5c, 0x5a7a95);
    doorways.push({ x: huddleA.maxX, z: -2.0 });
    addWarmLighting(scene, (huddleA.minX + huddleA.maxX) / 2, 2.2, (huddleA.minZ + huddleA.maxZ) / 2, 0x4a90e2);

    // Conference Room - professional warm gray
    addRoomWithDoor(scene, colliders, confRoom, 2.7, 0.12, { wall: 'W', width: 2.2, centerZ: -2.0 }, 0x4a4d52, 0x6b8e9c);
    doorways.push({ x: confRoom.minX, z: 2.0 });
    addWarmLighting(scene, (confRoom.minX + confRoom.maxX) / 2, 2.4, (confRoom.minZ + confRoom.maxZ) / 2, 0x87ceeb);

    // Lounge - warm terracotta/rust
    addRoomWithDoor(scene, colliders, loungeRect, 0.5, 0.1, { wall: 'N', width: 2.6 }, 0x5c4033, 0x8b6914);
    doorways.push({ x: (loungeRect.minX + loungeRect.maxX) / 2, z: loungeRect.minZ });
    addWarmLighting(scene, (loungeRect.minX + loungeRect.maxX) / 2, 2.2, (loungeRect.minZ + loungeRect.maxZ) / 2, 0xffa500);

    // Game Room - fun purple
    addRoomWithDoor(scene, colliders, gameRect, 2.5, 0.12, { wall: 'E', width: 2.0 }, 0x4a3f5c, 0x7b68ee);
    doorways.push({ x: (gameRect.minX + gameRect.maxX) / 2, z: gameRect.minZ });
    addWarmLighting(scene, (gameRect.minX + gameRect.maxX) / 2, 2.2, (gameRect.minZ + gameRect.maxZ) / 2, 0xda70d6);

    // Kitchen - warm cream
    addRoomWithDoor(scene, colliders, pantryRect, 2.5, 0.1, { wall: 'W', width: 1.8 }, 0x5c5233, 0xdaa520);
    doorways.push({ x: pantryRect.minX, z: (pantryRect.minZ + pantryRect.maxZ) / 2 });
    addWarmLighting(scene, (pantryRect.minX + pantryRect.maxX) / 2, 2.2, (pantryRect.minZ + pantryRect.maxZ) / 2, 0xffd700);

    // Enhanced Conference Room with modern table
    const confCenter = { x: (confRoom.minX + confRoom.maxX) / 2, z: (confRoom.minZ + confRoom.maxZ) / 2 };
    const confTop = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.4, 0.1, 32),
        createWoodMaterial(0x8b4513, 0.3)
    );
    const confPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.75, 24),
        new THREE.MeshStandardMaterial({ color: 0x2f2f2f, metalness: 0.6, roughness: 0.4 })
    );
    confTop.position.set(confCenter.x, 0.85, confCenter.z);
    confPost.position.set(confCenter.x, 0.42, confCenter.z);
    confTop.castShadow = true; confTop.receiveShadow = true;
    confPost.castShadow = true; confPost.receiveShadow = true;
    scene.add(confTop, confPost);
    colliders.push(new THREE.Box3().setFromObject(confTop));

    // Enhanced Game Room with modern table and detailed dice
    const gameCenter = { x: (gameRect.minX + gameRect.maxX) / 2, z: (gameRect.minZ + gameRect.maxZ) / 2 };
    const tableTop = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.1, 1.4),
        createWoodMaterial(0x654321, 0.3)
    );
    tableTop.position.set(gameCenter.x, 0.88, gameCenter.z);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    scene.add(tableTop);

    const tableLeg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.82, 16),
        new THREE.MeshStandardMaterial({ color: 0x2f2f2f, metalness: 0.7, roughness: 0.3 })
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

    const lblA = labelSprite('Focus Pod A', 3.2, '#87ceeb');
    lblA.position.set((huddleA.minX + huddleA.maxX) / 2, 2.8, (huddleA.minZ + huddleA.maxZ) / 2);
    (lblA as any).userData = {
        roomName: 'Focus Pod A',
        centerX: (huddleA.minX + huddleA.maxX) / 2,
        centerZ: (huddleA.minZ + huddleA.maxZ) / 2
    };
    scene.add(lblA);
    roomLabelSprites.push(lblA);

    const lblC = labelSprite('Conference', 3.2, '#b0e0e6');
    lblC.position.set((confRoom.minX + confRoom.maxX) / 2, 2.9, (confRoom.minZ + confRoom.maxZ) / 2);
    (lblC as any).userData = {
        roomName: 'Conference',
        centerX: (confRoom.minX + confRoom.maxX) / 2,
        centerZ: (confRoom.minZ + confRoom.maxZ) / 2
    };
    scene.add(lblC);
    roomLabelSprites.push(lblC);

    const lblL = labelSprite('Lounge', 3.2, '#ffa500');
    lblL.position.set((loungeRect.minX + loungeRect.maxX) / 2, 2.8, (loungeRect.minZ + loungeRect.maxZ) / 2);
    (lblL as any).userData = {
        roomName: 'Lounge',
        centerX: (loungeRect.minX + loungeRect.maxX) / 2,
        centerZ: (loungeRect.minZ + loungeRect.maxZ) / 2
    };
    scene.add(lblL);
    roomLabelSprites.push(lblL);

    const lblG = labelSprite('Game Room', 3.0, '#da70d6');
    lblG.position.set((gameRect.minX + gameRect.maxX) / 2, 2.8, (gameRect.minZ + gameRect.maxZ) / 2);
    (lblG as any).userData = {
        roomName: 'Game Room',
        centerX: (gameRect.minX + gameRect.maxX) / 2,
        centerZ: (gameRect.minZ + gameRect.maxZ) / 2
    };
    scene.add(lblG);
    roomLabelSprites.push(lblG);

    const lblKitchen = labelSprite('Kitchen', 3.0, '#ffd700');
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

    pebble('Stage', 0, -ROOM_D / 2 + 3.0, 0x87ceeb);
    pebble('Conference Table', confCenter.x, confCenter.z, 0x9bf6ff);
    pebble('Lounge', (loungeRect.minX + loungeRect.maxX) / 2, (loungeRect.minZ + loungeRect.maxZ) / 2, 0xffa500);
    pebble('Game Table', gameCenter.x, gameCenter.z, 0xda70d6);
    pebble('Kitchen', (pantryRect.minX + pantryRect.maxX) / 2, (pantryRect.minZ + pantryRect.maxZ) / 2, 0xffd700);

    // Add some decorative plants in the open area
    const plantPositions = [
        { x: -5, z: 5 }, { x: 8, z: 3 }, { x: 2, z: 8 }, { x: -8, z: 6 }
    ];
    plantPositions.forEach((pos) => {
        const pot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.35, 0.6, 12),
            new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 })
        );
        pot.position.set(pos.x, 0.3, pos.z);
        pot.castShadow = true;
        pot.receiveShadow = true;
        scene.add(pot);

        const plant = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.9 })
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
    pushNode('conf', center(confRoom).x, center(confRoom).z);
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
    createRealisticTiledFloor(scene, ROOM_W, ROOM_D);
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

    const coffeeCounter = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.9, 0.9),
        createWoodMaterial(0x8b4513, 0.4)
    );
    coffeeCounter.position.set(coffeeStation.x, 0.45, coffeeStation.z);

    coffeeCounter.castShadow = true;
    coffeeCounter.receiveShadow = true;
    coffeeCounter.rotateY(Math.PI / 2);
    scene.add(coffeeCounter);
    colliders.push(new THREE.Box3().setFromObject(coffeeCounter));

    // Add coffee machine
    const coffeeMachine = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.7, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x2c2c2c, metalness: 0.7, roughness: 0.3 })
    );
    coffeeMachine.position.set(coffeeStation.x, 1.15, coffeeStation.z);

    scene.add(coffeeMachine);

    // Add some seating in open area
    const casualSeats = [
        { x: 0.5, z: 13, rotation: Math.PI }, { x: -2, z: 10, rotation: Math.PI / 2 }, { x: 3, z: 10, rotation: -Math.PI / 2 }
    ];

    casualSeats.forEach(seat => {
        const sofa = createSofa({ fabricColor: "#7f7f83" }); // grey sofa
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
        roomLabels: roomLabelSprites
    };
}
