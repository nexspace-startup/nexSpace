import * as THREE from 'three';
import type { DeskPrefab } from './desks';

export type SeatTransform = { position: THREE.Vector3; yaw: number };

type Config = {
    bayCols: number;
    bayRows: number;
    deskGapX: number;
    deskGapZ: number;
    bayAisleX: number;
    bayAisleZ: number;
    startX: number;
    startZ: number;
    maxWidth: number;
    maxDepth: number;
    faceYaw: number;
};

export class DeskGridManager {
    scene: THREE.Scene;
    prefab: DeskPrefab;
    cfg: Config;

    topInst?: THREE.InstancedMesh;
    legInst?: THREE.InstancedMesh;
    chairInst?: THREE.InstancedMesh;
    kbInst?: THREE.InstancedMesh;
    mouseInst?: THREE.InstancedMesh;
    mugInst?: THREE.InstancedMesh;
    plantInst?: THREE.InstancedMesh;

    seatTransforms: SeatTransform[] = [];
    colliders: THREE.Box3[] = [];

    bayRects: Array<{ minX: number; minZ: number; maxX: number; maxZ: number }> = [];
    aisleLines: Array<{ x1: number; z1: number; x2: number; z2: number }> = [];

    private _deskCount = 0;

    constructor(scene: THREE.Scene, prefab: DeskPrefab, cfg: Config) {
        this.scene = scene; this.prefab = prefab; this.cfg = cfg;
    }

    ensureDeskCount(n: number): SeatTransform[] {
        if (n === this._deskCount) return this.seatTransforms;
        this._deskCount = n;
        this.disposeInstanced();
        this.colliders = [];
        this.seatTransforms = [];
        this.bayRects = [];
        this.aisleLines = [];

        const deskW = this.prefab.deskW, deskD = this.prefab.deskD;
        const { bayCols, bayRows, deskGapX, deskGapZ, bayAisleX, bayAisleZ, startX, startZ, maxWidth, maxDepth, faceYaw } = this.cfg;

        const perBay = bayCols * bayRows;
        const totalBaysNeeded = Math.ceil(n / perBay);

        const bayWidth = bayCols * deskW + (bayCols - 1) * deskGapX;
        const bayDepth = bayRows * deskD + (bayRows - 1) * deskGapZ;

        const baysPerRow = Math.max(1, Math.floor((maxWidth + bayAisleX) / (bayWidth + bayAisleX)));
        const bayRowsCount = Math.ceil(totalBaysNeeded / baysPerRow);
        void bayRowsCount;

        const tops = new THREE.InstancedMesh(this.prefab.topGeo, this.prefab.topMat, n);
        const legs = new THREE.InstancedMesh(this.prefab.legGeo, this.prefab.legMat, n * 4);
        const chairs = new THREE.InstancedMesh(this.prefab.chairGeo, this.prefab.chairMat, n);
        const kbs = new THREE.InstancedMesh(this.prefab.kbGeo, this.prefab.subtleMat, Math.ceil(n * 0.8));
        const mice = new THREE.InstancedMesh(this.prefab.mouseGeo, this.prefab.subtleMat, Math.ceil(n * 0.7));
        const mugs = new THREE.InstancedMesh(this.prefab.mugGeo, this.prefab.subtleMat, Math.ceil(n * 0.6));
        const plants = new THREE.InstancedMesh(this.prefab.plantGeo, new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.6, metalness: 0.15 }), Math.ceil(n * 0.4));

        this.topInst = tops; this.legInst = legs; this.chairInst = chairs; this.kbInst = kbs; this.mouseInst = mice; this.mugInst = mugs; this.plantInst = plants;

        const tmp = new THREE.Object3D();

        let deskPlaced = 0, legPlaced = 0, kbPlaced = 0, mousePlaced = 0, mugPlaced = 0, plantPlaced = 0;
        for (let bi = 0; bi < totalBaysNeeded; bi++) {
            const bayRow = Math.floor(bi / baysPerRow);
            const bayCol = bi % baysPerRow;

            const originX = startX + bayCol * (bayWidth + bayAisleX);
            const originZ = startZ + bayRow * (bayDepth + bayAisleZ);

            this.bayRects.push({ minX: originX - 0.2, minZ: originZ - 0.2, maxX: originX + bayWidth + 0.2, maxZ: originZ + bayDepth + 0.2 });
            if (bayCol > 0) this.aisleLines.push({ x1: originX - bayAisleX * 0.5, z1: originZ, x2: originX - bayAisleX * 0.5, z2: originZ + bayDepth });
            if (bayRow > 0) this.aisleLines.push({ x1: originX, z1: originZ - bayAisleZ * 0.5, x2: originX + bayWidth, z2: originZ - bayAisleZ * 0.5 });

            for (let r = 0; r < bayRows; r++) {
                for (let c = 0; c < bayCols; c++) {
                    if (deskPlaced >= n) break;

                    const x = originX + c * (deskW + deskGapX) + deskW / 2;
                    const z = originZ + r * (deskD + deskGapZ) + deskD / 2;
                    const yaw = faceYaw;

                    // desk top
                    tmp.position.set(x, this.prefab.deskH, z);
                    tmp.rotation.set(0, yaw, 0);
                    tmp.updateMatrix();
                    tops.setMatrixAt(deskPlaced, tmp.matrix);

                    // legs (4 corners)
                    const dx = deskW / 2 - 0.08, dz = deskD / 2 - 0.08;
                    const off = [[dx, -dz], [-dx, -dz], [dx, dz], [-dx, dz]];
                    for (const [ox, oz] of off) {
                        const rx = Math.cos(yaw) * ox - Math.sin(yaw) * oz;
                        const rz = Math.sin(yaw) * ox + Math.cos(yaw) * oz;
                        tmp.position.set(x + rx, this.prefab.deskH / 2, z + rz);
                        tmp.rotation.set(0, 0, 0);
                        tmp.updateMatrix();
                        legs.setMatrixAt(legPlaced++, tmp.matrix);
                    }

                    // seat transform (in front of desk)
                    const seatDist = this.prefab.deskD / 2 + 0.45;
                    const sx = x + Math.sin(yaw) * seatDist;
                    const sz = z + Math.cos(yaw) * seatDist;
                    this.seatTransforms.push({ position: new THREE.Vector3(sx, 0, sz), yaw });

                    // chair
                    tmp.position.set(sx, 0.75, sz);
                    tmp.rotation.set(0, yaw, 0); tmp.updateMatrix();
                    chairs.setMatrixAt(deskPlaced, tmp.matrix);

                    // small props
                    if (Math.random() < 0.8 && kbPlaced < kbs.count) {
                        const kx = x - Math.sin(yaw) * 0.05; const kz = z - Math.cos(yaw) * 0.05;
                        tmp.position.set(kx, this.prefab.deskH + 0.04, kz);
                        tmp.rotation.set(0, yaw, 0); tmp.updateMatrix();
                        kbs.setMatrixAt(kbPlaced++, tmp.matrix);
                    }
                    if (Math.random() < 0.7 && mousePlaced < mice.count) {
                        const mx = x + Math.cos(yaw) * 0.18; const mz = z - Math.sin(yaw) * 0.18;
                        tmp.position.set(mx, this.prefab.deskH + 0.05, mz);
                        tmp.rotation.set(0, yaw, 0); tmp.updateMatrix();
                        mice.setMatrixAt(mousePlaced++, tmp.matrix);
                    }
                    if (Math.random() < 0.6 && mugPlaced < mugs.count) {
                        const ux = x - Math.cos(yaw) * 0.22; const uz = z + Math.sin(yaw) * 0.22;
                        tmp.position.set(ux, this.prefab.deskH + 0.06, uz);
                        tmp.rotation.set(0, 0, 0); tmp.updateMatrix();
                        mugs.setMatrixAt(mugPlaced++, tmp.matrix);
                    }
                    if (Math.random() < 0.4 && plantPlaced < plants.count) {
                        const px = x + Math.cos(yaw) * 0.22; const pz = z - Math.sin(yaw) * 0.22;
                        tmp.position.set(px, this.prefab.deskH + 0.16, pz);
                        tmp.updateMatrix();
                        plants.setMatrixAt(plantPlaced++, tmp.matrix);
                    }

                    // collider for desk+chair footprint
                    const box = new THREE.Box3(
                        new THREE.Vector3(x - deskW / 2 - 0.1, 0, z - deskD / 2 - 0.2),
                        new THREE.Vector3(x + deskW / 2 + 0.1, 1.2, z + deskD / 2 + 0.6)
                    );
                    this.colliders.push(box);

                    deskPlaced++;
                }
            }
        }

        [tops, legs, chairs, kbs, mice, mugs, plants].forEach(m => { m.instanceMatrix.needsUpdate = true; });
        this.scene.add(tops, legs, chairs, kbs, mice, mugs, plants);

        return this.seatTransforms;
    }

    disposeInstanced() {
        const kill = (m?: THREE.InstancedMesh) => {
            if (!m) return;
            try { (m.geometry as any).dispose?.(); } catch { }
            const mat: any = m.material; if (Array.isArray(mat)) mat.forEach((mm: any) => mm.dispose?.()); else mat?.dispose?.();
            this.scene.remove(m);
        };
        kill(this.topInst); kill(this.legInst); kill(this.chairInst); kill(this.kbInst); kill(this.mouseInst); kill(this.mugInst); kill(this.plantInst);
        this.topInst = undefined; this.legInst = undefined; this.chairInst = undefined; this.kbInst = undefined; this.mouseInst = undefined; this.mugInst = undefined; this.plantInst = undefined;
    }

    dispose() {
        this.disposeInstanced();
        try { this.prefab.dispose(); } catch { }
    }
}
