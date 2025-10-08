import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { ModePalette } from './themeConfig';

export type RoomModuleId =
  | 'lobby'
  | 'open-desk'
  | 'conference'
  | 'focus'
  | 'cafe';

export type RoomModuleHandle = {
  id: RoomModuleId;
  group: THREE.Group;
  dispose: () => void;
};

const loader = new GLTFLoader();
let dracoLoader: DRACOLoader | null = null;

function ensureDraco() {
  if (dracoLoader) return;
  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderConfig({ type: 'js' });
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
  loader.setDRACOLoader(dracoLoader);
}

loader.setMeshoptDecoder(MeshoptDecoder);

const MODULE_PATH: Record<RoomModuleId, string> = {
  lobby: '/meeting3d/rooms/lobby.glb',
  'open-desk': '/meeting3d/rooms/open-desk.glb',
  conference: '/meeting3d/rooms/conference.glb',
  focus: '/meeting3d/rooms/focus.glb',
  cafe: '/meeting3d/rooms/cafe.glb',
};

function applySharedMaterialSettings(material: THREE.Material, palette: ModePalette) {
  const mat = material as THREE.MeshStandardMaterial;
  if (!('roughness' in mat)) return;
  mat.roughness = mat.roughness ?? 0.65;
  mat.metalness = mat.metalness ?? 0.1;
  mat.envMapIntensity = 1.2;
  if (mat.color && (mat as any).userData?.roomToken) {
    const token = (mat as any).userData.roomToken;
    if (token === 'wall') {
      mat.color.set(palette.surroundWalls);
    }
  }
  mat.needsUpdate = true;
}

function applyModulePalette(group: THREE.Group, palette: ModePalette) {
  group.traverse((obj) => {
    if (!(obj as any).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((mat) => applySharedMaterialSettings(mat, palette));
    } else if (material) {
      applySharedMaterialSettings(material, palette);
    }
  });
}

function buildFallbackModule(id: RoomModuleId, palette: ModePalette): RoomModuleHandle {
  const group = new THREE.Group();
  group.name = `fallback-${id}`;
  const makePanel = (w: number, h: number, d: number, color: number, y = h / 2, z = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  const wall = makePanel(6, 3, 0.12, palette.surroundWalls, 1.5, -2.2);
  group.add(wall);
  const counter = makePanel(3.2, 1.0, 0.8, palette.furniture.coffeeCounter, 0.5, 0.6);
  group.add(counter);
  return {
    id,
    group,
    dispose: () => {
      group.traverse((obj) => {
        if ((obj as any).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      });
    },
  };
}

export async function loadRoomModule(
  id: RoomModuleId,
  palette: ModePalette,
  signal?: AbortSignal,
): Promise<RoomModuleHandle> {
  ensureDraco();
  const url = MODULE_PATH[id];
  try {
    const gltf = await loader.loadAsync(url, (evt) => {
      if (signal?.aborted) {
        loader.manager.itemEnd(url);
      }
    });
    const root = (gltf.scene || gltf.scenes?.[0])?.clone(true) ?? new THREE.Group();
    root.name = `module-${id}`;
    applyModulePalette(root, palette);
    const dispose = () => {
      root.traverse((obj) => {
        if ((obj as any).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      });
    };
    return { id, group: root, dispose };
  } catch (error) {
    console.warn(`[meeting3d] Failed to load room module ${id}`, error);
    return buildFallbackModule(id, palette);
  }
}

export async function mountRoomModules(
  scene: THREE.Scene,
  palette: ModePalette,
  signal?: AbortSignal,
): Promise<RoomModuleHandle[]> {
  const handles: RoomModuleHandle[] = [];
  const root = new THREE.Group();
  root.name = 'room-modules-root';
  scene.add(root);

  const ids: RoomModuleId[] = ['lobby', 'open-desk', 'conference', 'focus', 'cafe'];
  await Promise.all(ids.map(async (id, index) => {
    if (signal?.aborted) {
      return;
    }
    const handle = await loadRoomModule(id, palette, signal);
    if (signal?.aborted) {
      handle.dispose();
      return;
    }
    const offsetX = index * 0.02;
    handle.group.position.x += offsetX;
    root.add(handle.group);
    handles.push(handle);
  }));

  return handles;
}
