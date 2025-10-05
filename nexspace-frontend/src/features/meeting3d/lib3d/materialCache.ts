import * as THREE from 'three';
import type { ModePalette } from './themeConfig';

export type MaterialToken =
  | 'floor-base'
  | 'floor-tile-a'
  | 'floor-tile-b'
  | 'floor-tile-c'
  | 'floor-grout'
  | 'wall-base'
  | 'glass'
  | 'screen'
  | 'metal-accent'
  | 'wood-accent';

type MaterialWithMeta = THREE.Material & { userData: Record<string, unknown> };

const materialCache = new Map<string, THREE.Material>();

function createBasicMaterial(token: MaterialToken, palette: ModePalette): THREE.Material {
  switch (token) {
    case 'floor-base':
      return new THREE.MeshStandardMaterial({
        color: palette.floorBase,
        roughness: 0.85,
        metalness: 0.05,
      });
    case 'floor-tile-a':
      return new THREE.MeshStandardMaterial({
        color: palette.floorTiles[0] ?? palette.floorBase,
        roughness: 0.78,
        metalness: 0.06,
      });
    case 'floor-tile-b':
      return new THREE.MeshStandardMaterial({
        color: palette.floorTiles[1] ?? palette.floorBase,
        roughness: 0.8,
        metalness: 0.05,
      });
    case 'floor-tile-c':
      return new THREE.MeshStandardMaterial({
        color: palette.floorTiles[2] ?? palette.floorBase,
        roughness: 0.82,
        metalness: 0.05,
      });
    case 'floor-grout':
      return new THREE.MeshStandardMaterial({
        color: palette.floorGrout,
        roughness: 0.9,
        metalness: 0,
      });
    case 'wall-base':
      return new THREE.MeshStandardMaterial({
        color: palette.surroundWalls,
        roughness: 0.92,
        metalness: 0.02,
      });
    case 'glass':
      return new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.9,
        opacity: 0.85,
        transparent: true,
        roughness: 0.02,
        metalness: 0,
        thickness: 0.08,
      });
    case 'screen':
      return new THREE.MeshBasicMaterial({
        color: 0x0d1117,
        toneMapped: false,
      });
    case 'metal-accent':
      return new THREE.MeshStandardMaterial({
        color: palette.furniture.chairFrame,
        roughness: 0.32,
        metalness: 0.85,
      });
    case 'wood-accent':
      return new THREE.MeshStandardMaterial({
        color: palette.furniture.conferenceTableTop,
        roughness: 0.5,
        metalness: 0.12,
      });
    default:
      return new THREE.MeshStandardMaterial({ color: 0xffffff });
  }
}

export function getMaterial(token: MaterialToken, palette: ModePalette): THREE.Material {
  const key = `${token}:${palette === undefined ? 'default' : palette.accent}`;
  let material = materialCache.get(key);
  if (!material) {
    material = createBasicMaterial(token, palette);
    const withMeta = material as MaterialWithMeta;
    withMeta.userData = { ...(withMeta.userData ?? {}), token };
    materialCache.set(key, material);
  }
  return material;
}

export function disposeMaterials() {
  for (const mat of materialCache.values()) {
    try { mat.dispose(); } catch { /* noop */ }
  }
  materialCache.clear();
}
