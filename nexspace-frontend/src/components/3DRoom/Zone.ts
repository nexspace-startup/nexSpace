import * as THREE from 'three';

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
};

function labelSprite(text: string, scaleX = 3.0) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const cx = c.getContext('2d')!;
    cx.clearRect(0, 0, 512, 128);
    cx.font = 'bold 56px system-ui';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = 'rgba(0,0,0,0.55)'; cx.shadowBlur = 12; cx.shadowOffsetY = 2;
    cx.fillStyle = '#fff'; cx.fillText(text, 256, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    sp.scale.set(scaleX, 1, 1);
    return sp;
}

// Dice faces with pips
function makeDiceMaterials(): THREE.MeshStandardMaterial[] {
    const makeFace = (pips: [number, number][]) => {
        const s = 256;
        const canv = document.createElement('canvas'); canv.width = canv.height = s;
        const g = canv.getContext('2d')!;
        g.fillStyle = '#f4f7e1'; g.fillRect(0, 0, s, s);
        g.fillStyle = '#111';
        const r = 20;
        pips.forEach(([cx, cy]) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); });
        const tex = new THREE.CanvasTexture(canv);
        tex.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshStandardMaterial({ map: tex, metalness: 0.25, roughness: 0.55, emissive: 0x111111, emissiveIntensity: 0.05 });
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

function addRoomWithDoor(
    scene: THREE.Scene,
    colliders: THREE.Box3[],
    rect: { minX: number; maxX: number; minZ: number; maxZ: number },
    height: number,
    thickness: number,
    door: { wall: 'N' | 'S' | 'E' | 'W', width: number, centerX?: number, centerZ?: number },
    color = 0x3a3a41
) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1.0 });
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

    // Big screen (north)
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(12.0, 4.5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    screen.position.set(0, 2.6, -ROOM_D / 2 + 0.08); scene.add(screen);

    // Rooms
    const huddleA = { minX: -18, maxX: -6, minZ: -8, maxZ: 2.5 };
    const confRoom = { minX: 6, maxX: 18, minZ: -8, maxZ: 10 };
    const loungeRect = { minX: -3.5, maxX: 6, minZ: 8.5, maxZ: 14.5 };
    const gameRect = { minX: 7.0, maxX: 14.5, minZ: 8.5, maxZ: 14.5 };        // beside lounge
    const podsRect = { minX: -ROOM_W / 2 + 2.5, maxX: -ROOM_W / 2 + 9.0, minZ: -ROOM_D / 2 + 6.8, maxZ: -ROOM_D / 2 + 12.0 };
    const pantryRect = { minX: ROOM_W / 2 - 9.0, maxX: ROOM_W / 2 - 3.2, minZ: ROOM_D / 2 - 9.2, maxZ: ROOM_D / 2 - 4.2 };
    const openRect = { minX: -ROOM_W / 2 + 4.0, maxX: ROOM_W / 2 - 7.0, minZ: 0.0, maxZ: 12.5 };
    const boothsStripX = ROOM_W / 2 - 2.6;

    const roomRects = [
        { name: 'Huddle A', rect: huddleA },
        { name: 'Conference', rect: confRoom },
        { name: 'Lounge', rect: loungeRect },
        { name: 'Game Room', rect: gameRect },
        { name: 'Pods', rect: podsRect },
        { name: 'Pantry', rect: pantryRect },
        { name: 'Reception', rect: { minX: -ROOM_W / 2 + 2.5, maxX: -ROOM_W / 2 + 7.5, minZ: -ROOM_D / 2 + 2.5, maxZ: -ROOM_D / 2 + 6.5 } },
        { name: 'Booths', rect: { minX: boothsStripX - 1.0, maxX: boothsStripX + 1.0, minZ: -10.0, maxZ: 18.0 } },
        { name: 'Open Office', rect: openRect },
    ];

    // Walls with interior doors
    const doorways: Array<{ x: number; z: number }> = [];
    addRoomWithDoor(scene, colliders, huddleA, 2.5, 0.12, { wall: 'E', width: 1.7, centerZ: -2.0 }, 0x3a3f4a);
    doorways.push({ x: huddleA.maxX, z: -2.0 });

    addRoomWithDoor(scene, colliders, confRoom, 2.7, 0.12, { wall: 'W', width: 2.2, centerZ: 2.0 }, 0x3a3f4a);
    doorways.push({ x: confRoom.minX, z: 2.0 });

    addRoomWithDoor(scene, colliders, loungeRect, 2.5, 0.1, { wall: 'N', width: 2.6 }, 0x39404b);
    doorways.push({ x: (loungeRect.minX + loungeRect.maxX) / 2, z: loungeRect.minZ });

    addRoomWithDoor(scene, colliders, gameRect, 2.5, 0.12, { wall: 'N', width: 2.0, centerX: (gameRect.minX + gameRect.maxX) / 2 }, 0x3a3f4a);
    doorways.push({ x: (gameRect.minX + gameRect.maxX) / 2, z: gameRect.minZ });

    addRoomWithDoor(scene, colliders, podsRect, 2.5, 0.1, { wall: 'N', width: 1.6, centerX: (podsRect.minX + podsRect.maxX) / 2 }, 0x333b47);
    doorways.push({ x: (podsRect.minX + podsRect.maxX) / 2, z: podsRect.minZ });

    addRoomWithDoor(scene, colliders, pantryRect, 2.5, 0.1, { wall: 'W', width: 1.8 }, 0x333b47);
    doorways.push({ x: pantryRect.minX, z: (pantryRect.minZ + pantryRect.maxZ) / 2 });

    // Conference: big round table
    const confTop = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0x5c6272, roughness: 0.75, metalness: 0.2 }));
    const confPost = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.75, 18), new THREE.MeshStandardMaterial({ color: 0x2f2f36, metalness: 0.3 }));
    confTop.position.set((confRoom.minX + confRoom.maxX) / 2, 0.84, (confRoom.minZ + confRoom.maxZ) / 2);
    confPost.position.set(confTop.position.x, 0.44, confTop.position.z);
    confTop.castShadow = true; confTop.receiveShadow = true; scene.add(confTop, confPost);
    colliders.push(new THREE.Box3().setFromObject(confTop));

    // Booths strip
    const boothMat = new THREE.MeshStandardMaterial({ color: 0x3e4554, roughness: 0.95, metalness: 0.12 });
    for (let i = 0; i < 6; i++) {
        const bx = boothsStripX; const bz = -8 + i * 6;
        const booth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.3, 2.8), boothMat);
        booth.position.set(bx, 1.15, bz); scene.add(booth);
        colliders.push(new THREE.Box3().setFromObject(booth));
    }

    // Game Room: table + numbered dice
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.2), new THREE.MeshStandardMaterial({ color: 0x5a6172, metalness: 0.25, roughness: 0.6 }));
    tableTop.position.set((gameRect.minX + gameRect.maxX) / 2, 0.88, (gameRect.minZ + gameRect.maxZ) / 2); scene.add(tableTop);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.82, 14), new THREE.MeshStandardMaterial({ color: 0x2f2f36 }));
    leg.position.set(tableTop.position.x, 0.46, tableTop.position.z); scene.add(leg);
    colliders.push(new THREE.Box3().setFromObject(tableTop));

    const diceMats = makeDiceMaterials();
    const dice = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), diceMats);
    dice.position.set(tableTop.position.x, tableTop.position.y + 0.2, tableTop.position.z);
    dice.name = 'GAME_ROOM_DICE';
    scene.add(dice);

    // Labels
    const lblA = labelSprite('Huddle A', 3.2); (lblA as any).position.set((huddleA.minX + huddleA.maxX) / 2, 2.35, (huddleA.minZ + huddleA.maxZ) / 2); scene.add(lblA);
    const lblC = labelSprite('Conference', 3.2); (lblC as any).position.set((confRoom.minX + confRoom.maxX) / 2, 2.35, (confRoom.minZ + confRoom.maxZ) / 2); scene.add(lblC);
    const lblL = labelSprite('Lounge', 3.2); (lblL as any).position.set((loungeRect.minX + loungeRect.maxX) / 2, 2.35, (loungeRect.minZ + loungeRect.maxZ) / 2); scene.add(lblL);
    const lblG = labelSprite('Game Room', 3.0); (lblG as any).position.set((gameRect.minX + gameRect.maxX) / 2, 2.35, (gameRect.minZ + gameRect.maxZ) / 2); scene.add(lblG);
    const lblBooths = labelSprite('Booths', 3.0); (lblBooths as any).position.set(ROOM_W / 2 - 2.6, 2.3, 10); scene.add(lblBooths);
    const lblRec = labelSprite('Reception', 3.0); (lblRec as any).position.set(-ROOM_W / 2 + 4.0, 2.0, -ROOM_D / 2 + 4.0); scene.add(lblRec);

    // Landmarks (for minimap landmark clicks)
    const landmarks: Array<{ name: string; x: number; z: number }> = [];
    function pebble(name: string, x: number, z: number, color = 0x7fffd4) {
        const geom = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20);
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.25 });
        const m = new THREE.Mesh(geom, mat); m.position.set(x, 0.03, z); m.name = `TP_${name.replace(/\s+/g, '_')}`;
        scene.add(m);
        landmarks.push({ name, x, z });
    }
    pebble('Stage', 0, -ROOM_D / 2 + 3.0);
    pebble('Conference Table', (confRoom.minX + confRoom.maxX) / 2, (confRoom.minZ + confRoom.maxZ) / 2, 0x9bf6ff);
    pebble('Lounge', (loungeRect.minX + loungeRect.maxX) / 2, (loungeRect.minZ + loungeRect.maxZ) / 2, 0xffd6a5);
    pebble('Game Table', (gameRect.minX + gameRect.maxX) / 2, (gameRect.minZ + gameRect.maxZ) / 2, 0xbdb2ff);
    pebble('Reception', -ROOM_W / 2 + 4.0, -ROOM_D / 2 + 3.6, 0xffadad);
    pebble('Pods', (podsRect.minX + podsRect.maxX) / 2, (podsRect.minZ + podsRect.maxZ) / 2, 0xcaffbf);
    pebble('Pantry', (pantryRect.minX + pantryRect.maxX) / 2, (pantryRect.minZ + pantryRect.maxZ) / 2, 0xfdffb6);

    // Nav graph
    const navNodes: Array<{ id: string; x: number; z: number }> = [];
    const pushNode = (id: string, x: number, z: number) => { navNodes.push({ id, x, z }); };
    const center = (r: { minX: number; maxX: number; minZ: number; maxZ: number }) => ({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 });

    pushNode('open', (openRect.minX + openRect.maxX) / 2, (openRect.minZ + openRect.maxZ) / 2);
    pushNode('huddleA', center(huddleA).x, center(huddleA).z);
    pushNode('conf', center(confRoom).x, center(confRoom).z);
    pushNode('lounge', center(loungeRect).x, center(loungeRect).z);
    pushNode('game', center(gameRect).x, center(gameRect).z);
    pushNode('pods', center(podsRect).x, center(podsRect).z);
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

    const disposeZones = () => { };

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
        meta: { gameRect }
    };
}
