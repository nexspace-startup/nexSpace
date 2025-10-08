// sofa.ts
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export function createSofa(opts: {
    width?: number;
    depth?: number;
    height?: number;
    fabricColor?: number | string;
    legColor?: number | string;
} = {}) {
    const {
        width = 2.6,
        depth = 1.5,
        height = 1.5,
        fabricColor = "#7f7f83",
        legColor = "#b8bcc2",
    } = opts;

    const sofa = new THREE.Group();
    
    const fabric = new THREE.MeshStandardMaterial({
        color: fabricColor,
        roughness: 0.9,
        metalness: 0.0,
    });
    fabric.userData.furnitureKey = 'sofaFabric';

    // base
    const baseH = 0.15;
    const legH = 0.12;
    const base = new THREE.Mesh(
        new RoundedBoxGeometry(width - 0.04, baseH, depth - 0.04, 3, 0.03),
        fabric
    );
    base.position.set(0, legH + baseH / 2, 0);
    base.castShadow = base.receiveShadow = true;
    sofa.add(base);

    // seat cushions
    const cushionH = 0.20;
    const seatGap = 0.02;
    const seatW = (width - 0.06 - seatGap) / 2;
    const seatD = depth - 0.14;
    [-1, 1].forEach((side) => {
        const c = new THREE.Mesh(
            new RoundedBoxGeometry(seatW, cushionH, seatD, 4, 0.045),
            fabric
        );
        c.position.set(side * (seatW / 2 + seatGap / 2), legH + baseH + cushionH / 2 + 0.01, 0);
        c.castShadow = c.receiveShadow = true;
        sofa.add(c);
    });

    // back
    const backH = height - 0.44;
    const back = new THREE.Mesh(
        new RoundedBoxGeometry(width - 0.02, backH - 0.08, 0.2, 4, 0.035),
        fabric
    );
    back.position.set(0, legH + 0.44 + (backH - 0.08) / 2, -(seatD / 2) + 0.03);
    back.castShadow = back.receiveShadow = true;
    sofa.add(back);

    // arms
    const armW = 0.18;
    [-1, 1].forEach((side) => {
        const arm = new THREE.Mesh(
            new RoundedBoxGeometry(armW, 0.44 + backH * 0.25, depth - 0.06, 3, 0.035),
            fabric
        );
        arm.position.set(side * (width / 2 - armW / 2), legH + (0.44 + backH * 0.25) / 2, 0);
        arm.castShadow = arm.receiveShadow = true;
        sofa.add(arm);
    });

    // legs
    const metal = new THREE.MeshStandardMaterial({ color: legColor, metalness: 0.85, roughness: 0.35 });
    metal.userData.furnitureKey = 'sofaLegs';
    const legGeo = new THREE.CylinderGeometry(0.012, 0.012, legH, 16);
    const legOffsetX = width / 2 - 0.08;
    const legOffsetZ = depth / 2 - 0.08;
    [
        [-legOffsetX, legH / 2, -legOffsetZ],
        [legOffsetX, legH / 2, -legOffsetZ],
        [-legOffsetX, legH / 2, legOffsetZ],
        [legOffsetX, legH / 2, legOffsetZ],
    ].forEach(([x, y, z]) => {
        const leg = new THREE.Mesh(legGeo, metal);
        leg.position.set(x, y, z);
        leg.castShadow = leg.receiveShadow = true;
        sofa.add(leg);
    });

    return sofa;
}
