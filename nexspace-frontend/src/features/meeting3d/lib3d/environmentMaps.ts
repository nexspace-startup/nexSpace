import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export type EnvironmentVariant = 'day' | 'night';

export type EnvironmentMapHandle = {
  target: THREE.Texture;
  dispose: () => void;
};

const HDRI_PATHS: Record<EnvironmentVariant, string> = {
  day: '/meeting3d/env/day.hdr',
  night: '/meeting3d/env/night.hdr',
};

const FALLBACK_COLORS: Record<EnvironmentVariant, number> = {
  day: 0xf5f7fa,
  night: 0x06080d,
};

type CacheKey = `${EnvironmentVariant}`;
const cache = new Map<CacheKey, Promise<EnvironmentMapHandle>>();

function buildFallbackTexture(color: number): EnvironmentMapHandle {
  const data = new Uint8Array([
    ((color >> 16) & 0xff),
    ((color >> 8) & 0xff),
    (color & 0xff),
    255,
  ]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return {
    target: tex,
    dispose: () => {
      tex.dispose();
    },
  };
}

async function createEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  variant: EnvironmentVariant,
): Promise<EnvironmentMapHandle> {
  try {
    const loader = new RGBELoader();
    loader.setDataType(THREE.FloatType);

    const texture = await loader.loadAsync(HDRI_PATHS[variant]);
    if (!texture || !(texture as THREE.Texture).isTexture || !(texture as THREE.Texture).image) {
      throw new Error('HDRI texture missing image data');
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromEquirectangular(texture);

    texture.dispose();
    pmrem.dispose();

    return {
      target: envRT.texture,
      dispose: () => {
        envRT.texture.dispose();
        envRT.dispose();
      },
    };
  } catch (error) {
    console.warn('[meeting3d] Failed to load HDRI environment', error);
    return buildFallbackTexture(FALLBACK_COLORS[variant]);
  }
}

export function preloadEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  variant: EnvironmentVariant,
): Promise<EnvironmentMapHandle> {
  const key: CacheKey = variant;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const promise = createEnvironmentMap(renderer, variant);
  cache.set(key, promise);
  return promise;
}

export function clearEnvironmentCache() {
  for (const entry of cache.values()) {
    void entry.then((handle) => handle.dispose()).catch(() => {});
  }
  cache.clear();
}
