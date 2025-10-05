import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createOfficeChair } from './officeChair';

export type DeskPrefab = {
    topGeo: THREE.BufferGeometry;
    legGeo: THREE.BufferGeometry;
    chairGeo: THREE.BufferGeometry;           // baked geometry for InstancedMesh
    monitorGeo: THREE.BufferGeometry;
    kbGeo: THREE.BufferGeometry;
    mouseGeo: THREE.BufferGeometry;
    mugGeo: THREE.BufferGeometry;

    // Enhanced plant geometries (for custom plants)
    plantPotGeo: THREE.BufferGeometry;
    plantStemGeo: THREE.BufferGeometry;
    plantLeafGeo: THREE.BufferGeometry;
    plantSoilGeo: THREE.BufferGeometry;

    // Alternative plant types
    succulentBaseGeo: THREE.BufferGeometry;
    succulentLeafGeo: THREE.BufferGeometry;
    fernFrondGeo: THREE.BufferGeometry;

    // Simple baked plant for InstancedMesh
    plantGeo: THREE.BufferGeometry;

    // Enhanced materials
    topMat: THREE.Material;
    legMat: THREE.Material;
    chairMat: THREE.Material;
    darkMat: THREE.Material;
    subtleMat: THREE.Material;

    // Plant materials optimized for dark backgrounds
    plantPotMat: THREE.Material;
    plantStemMat: THREE.Material;
    plantLeafMat: THREE.Material;
    plantLeafMat2: THREE.Material; // Variation for diversity
    plantSoilMat: THREE.Material;

    // Succulent materials
    succulentMat: THREE.Material;
    succulentAccentMat: THREE.Material;

    // Fern materials
    fernMat: THREE.Material;
    fernStemMat: THREE.Material;

    deskW: number; deskD: number; deskH: number;
    monitorW: number; monitorH: number;
    dispose(): void;

    // Helper function to create complete plants
    createPlant(type: 'pothos' | 'succulent' | 'fern', position: THREE.Vector3): THREE.Group;
};

// --- helpers to normalize and merge geometries safely ---
function prepForMerge(g: THREE.BufferGeometry): THREE.BufferGeometry {
    let out = g;
    if (out.index) out = out.toNonIndexed();

    // ensure normals
    if (!out.getAttribute('normal')) {
        out.computeVertexNormals();
    }

    // keep only position + normal to avoid attribute mismatches
    const keep = new Set(['position', 'normal']);
    const attrs = (out as any).attributes as Record<string, THREE.BufferAttribute | THREE.InterleavedBufferAttribute>;
    for (const name of Object.keys(attrs)) {
        if (!keep.has(name)) {
            out.deleteAttribute(name as any);
        }
    }

    // explicitly drop index
    out.setIndex(null);
    return out;
}

function bakeGroupToSingleGeometry(root: THREE.Group): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    root.updateMatrixWorld(true);

    root.traverse((o: any) => {
        if (!o.isMesh || !o.geometry) return;
        const cloned = o.geometry.clone();
        cloned.applyMatrix4(o.matrixWorld);
        const prepped = prepForMerge(cloned);
        parts.push(prepped);
    });

    if (parts.length === 0) {
        throw new Error('bakeGroupToSingleGeometry: no mesh geometries found in group.');
    }

    const merged = BufferGeometryUtils.mergeGeometries(parts, false);
    // dispose temp parts either way
    parts.forEach(p => { try { p.dispose(); } catch { } });

    if (!merged) {
        // last resort: fall back to first part to avoid hard crash
        console.warn('mergeGeometries failed; falling back to first prepared part');
        return parts[0];
    }

    merged.computeVertexNormals();
    return merged;
}

// Make a small, good-looking potted plant as one merged geometry (pot + soil + short stem + a few leaves)
function makeInstancedPlantGeo(
    pot: THREE.BufferGeometry,
    soil: THREE.BufferGeometry,
    stem: THREE.BufferGeometry,
    leaf: THREE.BufferGeometry
): THREE.BufferGeometry {
    const clones: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();

    // pot (centered)
    clones.push(prepForMerge(pot.clone()));

    // soil (slightly above pot center)
    const soilClone = soil.clone().applyMatrix4(m.makeTranslation(0, 0.05, 0));
    clones.push(prepForMerge(soilClone));

    // short stem
    const stemClone = stem.clone().applyMatrix4(m.makeTranslation(0, 0.12, 0));
    clones.push(prepForMerge(stemClone));

    // 3 small leaves around the stem
    const leafScale = new THREE.Matrix4().makeScale(0.8, 0.8, 0.8);
    for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        const tx = Math.cos(ang) * 0.035;
        const tz = Math.sin(ang) * 0.035;
        const rotY = new THREE.Matrix4().makeRotationY(ang);
        const rotX = new THREE.Matrix4().makeRotationX(Math.PI / 6);
        const t = new THREE.Matrix4().makeTranslation(tx, 0.15, tz);

        const leafClone = leaf.clone();
        leafClone.applyMatrix4(leafScale).applyMatrix4(rotY).applyMatrix4(rotX).applyMatrix4(t);
        clones.push(prepForMerge(leafClone));
    }

    const merged = BufferGeometryUtils.mergeGeometries(clones, false);
    clones.forEach(c => { try { c.dispose(); } catch { } });

    if (!merged) {
        console.warn('Plant merge failed; returning first element.');
        return clones[0];
    }
    merged.computeVertexNormals();
    return merged;
}

export function createDeskModule(): DeskPrefab {
    const deskW = 1.4, deskD = 0.8, deskH = 0.75;
    const monitorW = 0.6, monitorH = 0.36;

    // Basic desk geometries
    const topGeo = new THREE.BoxGeometry(deskW, 0.06, deskD);
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, deskH, 12);

    // Build chair group, bake once to a single geometry for InstancedMesh
    const chairApi = createOfficeChair({
        seatHeight: 0.5,
        seatColor: "#2f333b",
        frameColor: "#c9cdd3",
        hasArms: true
    });
    const chairGeo = bakeGroupToSingleGeometry(chairApi.group);
    chairApi.dispose(); // free the temporary group/materials

    const monitorGeo = new THREE.BoxGeometry(1.2, 0.72, 0.06);
    const kbGeo = new THREE.BoxGeometry(0.45, 0.025, 0.14);
    const mouseGeo = new THREE.SphereGeometry(0.035, 12, 8);
    const mugGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.09, 12);

    // Enhanced plant geometries
    const plantPotGeo = new THREE.CylinderGeometry(0.08, 0.065, 0.12, 16);
    const plantStemGeo = new THREE.CylinderGeometry(0.002, 0.003, 0.15, 8);
    const plantLeafGeo = new THREE.SphereGeometry(0.025, 8, 6);
    const plantSoilGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.02, 16);

    // Bake a simple plant geometry for InstancedMesh usage
    const plantGeo = makeInstancedPlantGeo(
        plantPotGeo, plantSoilGeo, plantStemGeo, plantLeafGeo
    );

    // Succulent geometries
    const succulentBaseGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.08, 8);
    const succulentLeafGeo = new THREE.ConeGeometry(0.015, 0.06, 6);

    // Fern geometries
    const fernFrondGeo = new THREE.PlaneGeometry(0.12, 0.08);

    // Enhanced materials for dark background compatibility
    const topMat = new THREE.MeshStandardMaterial({
        color: 0x8B7B6B, // Warmer wood tone
        roughness: 0.8,
        metalness: 0.9,
        normalScale: new THREE.Vector2(0.3, 0.3)
    });

    const legMat = new THREE.MeshStandardMaterial({
        color: 0x3A3A42, // Lighter than before for dark bg
        roughness: 0.7,
        metalness: 0.9
    });

    const chairMat = new THREE.MeshStandardMaterial({
        color: 0x5A5A65, // More visible against dark
        roughness: 0.8,
        metalness: 0.9
    });

    const darkMat = new THREE.MeshBasicMaterial({
        color: 0x0F0F0F,
        toneMapped: false
    });

    const subtleMat = new THREE.MeshStandardMaterial({
        color: 0x6B5D50, // Warmer brown
        roughness: 0.85,
        metalness: 0.9
    });

    // Plant materials optimized for dark backgrounds
    const plantPotMat = new THREE.MeshStandardMaterial({
        color: 0xB8860B, // Rich terracotta/gold
        roughness: 0.9,
        metalness: 0.9,
        emissive: 0x1a1206,
        emissiveIntensity: 0.1
    });

    const plantStemMat = new THREE.MeshStandardMaterial({
        color: 0x4A6741, // Rich forest green
        roughness: 0.8,
        metalness: 0.9,
        emissive: 0x0a1208,
        emissiveIntensity: 0.1
    });

    const plantLeafMat = new THREE.MeshStandardMaterial({
        color: 0x5FB85F, // Vibrant green
        roughness: 0.6,
        metalness: 0.0,
        emissive: 0x0f1a0f,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity: 0.9
    });

    const plantLeafMat2 = new THREE.MeshStandardMaterial({
        color: 0x7BC97B, // Lighter green variation
        roughness: 0.7,
        metalness: 0.0,
        emissive: 0x121f12,
        emissiveIntensity: 0.12,
        transparent: true,
        opacity: 0.85
    });

    const plantSoilMat = new THREE.MeshStandardMaterial({
        color: 0x3E2723, // Rich dark brown
        roughness: 0.95,
        metalness: 0.0
    });

    // Succulent materials
    const succulentMat = new THREE.MeshStandardMaterial({
        color: 0x81C784, // Fresh green
        roughness: 0.4,
        metalness: 0.0,
        emissive: 0x0a1a0a,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.95
    });

    const succulentAccentMat = new THREE.MeshStandardMaterial({
        color: 0xFFB74D, // Orange-yellow tips
        roughness: 0.5,
        metalness: 0.0,
        emissive: 0x1a1206,
        emissiveIntensity: 0.15
    });

    // Fern materials
    const fernMat = new THREE.MeshStandardMaterial({
        color: 0x4CAF50, // Bright fern green
        roughness: 0.7,
        metalness: 0.0,
        emissive: 0x0d1a0d,
        emissiveIntensity: 0.18,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide // Show both sides of leaves
    });

    const fernStemMat = new THREE.MeshStandardMaterial({
        color: 0x2E7D32, // Dark green stem
        roughness: 0.8,
        metalness: 0.0,
        emissive: 0x081a08,
        emissiveIntensity: 0.1
    });

    // Helper function to create complete plants (for non-instanced decorative plants)
    const createPlant = (type: 'pothos' | 'succulent' | 'fern', position: THREE.Vector3): THREE.Group => {
        const plantGroup = new THREE.Group();
        plantGroup.position.copy(position);

        switch (type) {
            case 'pothos': {
                const pot = new THREE.Mesh(plantPotGeo, plantPotMat);
                pot.castShadow = true; pot.receiveShadow = true; plantGroup.add(pot);

                const soil = new THREE.Mesh(plantSoilGeo, plantSoilMat);
                soil.position.y = 0.05; soil.receiveShadow = true; plantGroup.add(soil);

                for (let i = 0; i < 5; i++) {
                    const stem = new THREE.Mesh(plantStemGeo, plantStemMat);
                    const angle = (i / 5) * Math.PI * 2;
                    stem.position.set(Math.cos(angle) * 0.03, 0.1, Math.sin(angle) * 0.03);
                    stem.rotation.z = (Math.random() - 0.5) * 0.3;
                    stem.castShadow = true;
                    plantGroup.add(stem);

                    for (let j = 0; j < 4; j++) {
                        const leaf = new THREE.Mesh(plantLeafGeo, Math.random() > 0.5 ? plantLeafMat : plantLeafMat2);
                        leaf.position.set(
                            Math.cos(angle) * 0.03 + (Math.random() - 0.5) * 0.08,
                            0.1 + j * 0.04 + Math.random() * 0.02,
                            Math.sin(angle) * 0.03 + (Math.random() - 0.5) * 0.08
                        );
                        leaf.scale.set(
                            0.8 + Math.random() * 0.4,
                            0.8 + Math.random() * 0.4,
                            0.8 + Math.random() * 0.4
                        );
                        leaf.castShadow = true;
                        plantGroup.add(leaf);
                    }
                }
                break;
            }
            case 'succulent': {
                const succulentPot = new THREE.Mesh(plantPotGeo, plantPotMat);
                succulentPot.castShadow = true; succulentPot.receiveShadow = true; plantGroup.add(succulentPot);

                const succulentSoil = new THREE.Mesh(plantSoilGeo, plantSoilMat);
                succulentSoil.position.y = 0.05; plantGroup.add(succulentSoil);

                const base = new THREE.Mesh(succulentBaseGeo, succulentMat);
                base.position.y = 0.1; base.castShadow = true; plantGroup.add(base);

                for (let i = 0; i < 12; i++) {
                    const leaf = new THREE.Mesh(succulentLeafGeo, i < 8 ? succulentMat : succulentAccentMat);
                    const angle = (i / 12) * Math.PI * 2 + (i * 0.5);
                    const radius = 0.04 + (i % 3) * 0.01;
                    leaf.position.set(Math.cos(angle) * radius, 0.12 + (i % 4) * 0.02, Math.sin(angle) * radius);
                    leaf.rotation.set(Math.PI, angle + Math.PI / 2, Math.PI / 6);
                    leaf.castShadow = true;
                    plantGroup.add(leaf);
                }
                break;
            }
            case 'fern': {
                const fernPot = new THREE.Mesh(plantPotGeo, plantPotMat);
                fernPot.castShadow = true; fernPot.receiveShadow = true; plantGroup.add(fernPot);

                const fernSoil = new THREE.Mesh(plantSoilGeo, plantSoilMat);
                fernSoil.position.y = 0.05; plantGroup.add(fernSoil);

                for (let i = 0; i < 8; i++) {
                    const frond = new THREE.Mesh(fernFrondGeo, fernMat);
                    const angle = (i / 8) * Math.PI * 2;
                    frond.position.set(Math.cos(angle) * 0.02, 0.1, Math.sin(angle) * 0.02);
                    frond.rotation.set(Math.PI / 6 + (Math.random() - 0.5) * 0.2, angle, (Math.random() - 0.5) * 0.3);
                    frond.scale.set(0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.4, 1);
                    frond.castShadow = true;
                    plantGroup.add(frond);

                    const stem = new THREE.Mesh(plantStemGeo, fernStemMat);
                    stem.position.copy(frond.position);
                    stem.position.y -= 0.05;
                    stem.rotation.z = (Math.random() - 0.5) * 0.2;
                    stem.scale.y = 0.6;
                    plantGroup.add(stem);
                }
                break;
            }
        }

        return plantGroup;
    };

    return {
        topGeo, legGeo, chairGeo, monitorGeo, kbGeo, mouseGeo, mugGeo,

        // Plant geometries
        plantPotGeo, plantStemGeo, plantLeafGeo, plantSoilGeo,
        succulentBaseGeo, succulentLeafGeo, fernFrondGeo,

        // Baked plant geometry for instancing
        plantGeo,

        // Materials
        topMat, legMat, chairMat, darkMat, subtleMat,

        // Plant materials
        plantPotMat, plantStemMat, plantLeafMat, plantLeafMat2, plantSoilMat,
        succulentMat, succulentAccentMat, fernMat, fernStemMat,

        deskW, deskD, deskH, monitorW, monitorH,

        createPlant,

        dispose() {
            // Dispose geometries
            [
                topGeo, legGeo, chairGeo, monitorGeo, kbGeo, mouseGeo, mugGeo,
                plantPotGeo, plantStemGeo, plantLeafGeo, plantSoilGeo,
                succulentBaseGeo, succulentLeafGeo, fernFrondGeo, plantGeo
            ].forEach((g) => g.dispose());

            // Dispose materials
            [
                topMat, legMat, chairMat, darkMat, subtleMat,
                plantPotMat, plantStemMat, plantLeafMat, plantLeafMat2, plantSoilMat,
                succulentMat, succulentAccentMat, fernMat, fernStemMat
            ].forEach((m: any) => m.dispose?.());
        }
    };
}
