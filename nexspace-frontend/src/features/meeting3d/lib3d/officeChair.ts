// officeChair.ts
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type ChairOptions = {
    seatHeight?: number;         // world Y for seat top (~0.48 default)
    seatWidth?: number;          // left-right
    seatDepth?: number;          // front-back
    seatColor?: string | number; // fabric color
    frameColor?: string | number;// metal/plastic frame
    plasticColor?: string | number;// neutral plastic pieces
    hasArms?: boolean;           // toggle armrests
    wheelCount?: number;         // 5 by default (star base)
    castShadows?: boolean;
};

export type OfficeChairAPI = Readonly<{
    /** Root object you add to the scene */
    group: THREE.Group;

    /** Move seat/back up/down; adjusts gas lift */
    setSeatHeight: (y: number) => void;

    /** Recline/tilt backrest (radians) */
    setTilt: (radians: number) => void;

    /** Swivel entire chair (radians around Y) */
    swivel: (radians: number) => void;
    dispose: () => void;
}>;

function disposeMaterial(m?: THREE.Material | null) {
    if (!m) return;
    const mm = m as any;
    mm.map?.dispose?.();
    mm.normalMap?.dispose?.();
    mm.roughnessMap?.dispose?.();
    mm.metalnessMap?.dispose?.();
    mm.aoMap?.dispose?.();
    mm.emissiveMap?.dispose?.();
    mm.envMap?.dispose?.();
    m.dispose?.();
}

function disposeObject3D(root: THREE.Object3D) {
    root.traverse((o: any) => {
        if (o.isMesh) {
            o.geometry?.dispose?.();
            const mat = o.material;
            if (Array.isArray(mat)) mat.forEach(disposeMaterial);
            else disposeMaterial(mat);
        }
    });
}


export function createOfficeChair(opts: ChairOptions = {}) {
    const {
        seatHeight = 0.48,
        seatWidth = 0.52,
        seatDepth = 0.50,
        seatColor = "#3c3f46",
        frameColor = "#b8bcc2",
        plasticColor = "#1b1e22",
        hasArms = true,
        wheelCount = 0,
        castShadows = true,
    } = opts;

    const g = new THREE.Group();
    g.name = "OfficeChair";

    const cast = (m: THREE.Mesh) => {
        m.castShadow = castShadows;
        m.receiveShadow = castShadows;
        return m;
    };

    // Materials
    const fabricMat = new THREE.MeshStandardMaterial({
        color: seatColor, roughness: 0.9, metalness: 0.0,
    });
    fabricMat.userData.furnitureKey = 'chairSeat';
    const frameMat = new THREE.MeshStandardMaterial({
        color: frameColor, roughness: 0.35, metalness: 0.8,
    });
    frameMat.userData.furnitureKey = 'chairFrame';
    const plasticMat = new THREE.MeshStandardMaterial({
        color: plasticColor, roughness: 0.6, metalness: 0.1,
    });
    plasticMat.userData.furnitureKey = 'chairPlastic';

    // ===== Seat cushion =====
    const seatH = 0.08; // cushion thickness
    const seat = cast(new THREE.Mesh(
        new RoundedBoxGeometry(seatWidth, seatH, seatDepth, 4, 0.035),
        fabricMat
    ));
    seat.position.set(0, seatHeight, 0);
    seat.name = "Seat";
    g.add(seat);

    // ===== Backrest =====
    const backW = seatWidth * 0.9;
    const backH = 0.55;
    const backT = 0.06; // thickness
    const back = cast(new THREE.Mesh(
        new RoundedBoxGeometry(backW, backH, backT, 4, 0.03),
        fabricMat
    ));
    back.position.set(0, seatHeight + backH / 2 + 0.02, -seatDepth * 0.43);
    back.rotation.x = -0.08; // slight recline
    back.name = "Backrest";
    g.add(back);

    // Back support spine
    const spine = cast(new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.022, backH * 0.9, 16),
        frameMat
    ));
    spine.position.set(0, seatHeight + backH * 0.45, -seatDepth * 0.38);
    spine.rotation.x = -0.08;
    g.add(spine);

    // ===== Armrests (optional) =====
    if (hasArms) {
        const armH = 0.24;
        const armOffX = seatWidth * 0.5 - 0.03;
        const armY = seatHeight + 0.08;
        const railZ = -0.02;

        const mkArm = (side: 1 | -1) => {
            // vertical post
            const post = cast(new THREE.Mesh(
                new THREE.CylinderGeometry(0.015, 0.015, armH, 12),
                frameMat
            ));
            post.position.set(side * armOffX, armY + armH / 2, railZ);
            g.add(post);

            // pad
            const pad = cast(new THREE.Mesh(
                new RoundedBoxGeometry(0.26, 0.04, 0.08, 3, 0.02),
                plasticMat
            ));
            pad.position.set(side * armOffX, armY + armH + 0.02, seatDepth * 0.04);
            pad.rotateY(Math.PI / 2);
            g.add(pad);
        };
        mkArm(1); mkArm(-1);
    }

    // ===== Gas lift (height adjust cylinder) =====
    const liftH = seatHeight - 0.10; // down to hub
    const lift = cast(new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.03, Math.max(liftH, 0.15), 16),
        frameMat
    ));
    lift.position.set(0, liftH / 2, 0);
    g.add(lift);

    // Hub
    const hub = cast(new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.065, 0.05, 24),
        frameMat
    ));
    hub.position.set(0, 0.05 / 2, 0);
    g.add(hub);

    // ===== Star base + casters =====
    const baseRadius = 0.34;
    const legLen = baseRadius * 0.9;
    const legThick = 0.035;

    for (let i = 0; i < wheelCount; i++) {
        const angle = (i / wheelCount) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));

        // leg (slightly tapered box)
        const leg = cast(new THREE.Mesh(
            new RoundedBoxGeometry(legLen, legThick, 0.06, 2, 0.015),
            frameMat
        ));
        leg.position.set(dir.x * legLen / 2, 0.05, dir.z * legLen / 2);
        leg.rotation.y = angle;
        g.add(leg);

        // wheel (caster): two small cylinders + axle
        const wheelRad = 0.04;
        const wheelWidth = 0.016;
        const wheelY = 0.02;
        const wheelCenter = new THREE.Vector3(
            dir.x * legLen, wheelY, dir.z * legLen
        );

        const wheelL = cast(new THREE.Mesh(
            new THREE.CylinderGeometry(wheelRad, wheelRad, wheelWidth, 18),
            plasticMat
        ));
        wheelL.rotation.z = Math.PI / 2;
        wheelL.position.copy(wheelCenter).addScaledVector(dir, 0.01);
        g.add(wheelL);

        const wheelR = wheelL.clone();
        (wheelR.material as THREE.Material) = plasticMat;
        wheelR.position.copy(wheelCenter).addScaledVector(dir, -0.01);
        g.add(wheelR);

        // axle
        const axle = cast(new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8),
            frameMat
        ));
        axle.rotation.z = Math.PI / 2;
        axle.position.copy(wheelCenter);
        g.add(axle);
    }

    // ===== Under-seat plate & tilt hinge =====
    const plate = cast(new THREE.Mesh(
        new RoundedBoxGeometry(seatWidth * 0.7, 0.025, seatDepth * 0.6, 2, 0.01),
        frameMat
    ));
    plate.position.set(0, seatHeight - seatH / 2 - 0.015, 0);
    g.add(plate);

    const hinge = cast(new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.11, 14),
        frameMat
    ));
    hinge.rotation.z = Math.PI / 2;
    hinge.position.set(0, plate.position.y + 0.015, -seatDepth * 0.12);
    g.add(hinge);

    // ===== Simple API for interaction =====
    const api = {
        setSeatHeight(y: number) {
            const delta = y - seat.position.y;
            seat.position.y = y;
            back.position.y += delta;
            spine.position.y += delta;
            plate.position.y += delta;
            hinge.position.y += delta;
            // move arms too
            g.traverse((o) => {
                if (o !== seat && (o as THREE.Mesh).geometry) {
                    if (o.name.startsWith("Arm") || o === undefined) { /* noop */ }
                }
            });
            // stretch gas lift
            const newLiftH = y - 0.10;
            lift.scale.y = Math.max(newLiftH / Math.max(liftH, 0.15), 0.4);
            lift.position.y = (Math.max(newLiftH, 0.15)) / 2;
        },
        setTilt(radians: number) {
            // rotate backrest about its bottom edge (approx)
            back.rotation.x = -0.08 + radians;
            spine.rotation.x = -0.08 + radians * 0.9;
        },
        swivel(radians: number) {
            g.rotation.y = radians;
        },
        dispose() {                      // ← new
            g.removeFromParent();          // optional but nice
            disposeObject3D(g);
        },

        group: g,
    } as const;

    // Tag for picking
    g.userData.type = "office-chair";
    (g as any).api = api;
    return api;
}
