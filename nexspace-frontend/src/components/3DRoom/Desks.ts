import * as THREE from 'three';

export type DeskPrefab = {
    topGeo: THREE.BufferGeometry;
    legGeo: THREE.BufferGeometry;
    chairGeo: THREE.BufferGeometry;
    monitorGeo: THREE.BufferGeometry;
    kbGeo: THREE.BufferGeometry;
    mouseGeo: THREE.BufferGeometry;
    mugGeo: THREE.BufferGeometry;
    plantGeo: THREE.BufferGeometry;
    topMat: THREE.Material;
    legMat: THREE.Material;
    chairMat: THREE.Material;
    darkMat: THREE.Material;
    subtleMat: THREE.Material;
    deskW: number; deskD: number; deskH: number;
    monitorW: number; monitorH: number;
    dispose(): void;
};

export function createDeskModule(): DeskPrefab {
    const deskW = 1.4, deskD = 0.8, deskH = 0.75;
    const monitorW = 0.6, monitorH = 0.36;

    const topGeo = new THREE.BoxGeometry(deskW, 0.06, deskD);
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, deskH, 10);
    const chairGeo = new THREE.CapsuleGeometry(0.18, 0.45, 6, 10);
    const monitorGeo = new THREE.PlaneGeometry(monitorW, monitorH);
    const kbGeo = new THREE.BoxGeometry(0.45, 0.025, 0.14);
    const mouseGeo = new THREE.SphereGeometry(0.035, 10, 8);
    const mugGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.09, 10);
    const plantGeo = new THREE.IcosahedronGeometry(0.18, 1);

    const topMat = new THREE.MeshStandardMaterial({ color: 0x6a6a73, roughness: 0.85 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2f2f36, roughness: 0.9 });
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.9 });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x111111, toneMapped: false });
    const subtleMat = new THREE.MeshStandardMaterial({ color: 0x5b4d40, roughness: 0.9 });

    return {
        topGeo, legGeo, chairGeo, monitorGeo, kbGeo, mouseGeo, mugGeo, plantGeo,
        topMat, legMat, chairMat, darkMat, subtleMat,
        deskW, deskD, deskH, monitorW, monitorH,
        dispose() {
            [topGeo, legGeo, chairGeo, monitorGeo, kbGeo, mouseGeo, mugGeo, plantGeo].forEach(g => { try { g.dispose(); } catch { } });
            [topMat, legMat, chairMat, darkMat, subtleMat].forEach((m: any) => { try { m.dispose?.(); } catch { } });
        }
    };
}
