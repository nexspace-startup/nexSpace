# Meeting3D Asset Pipeline

This pipeline keeps Meeting3D assets performant on mid-range laptops. All 3D contributors should follow the steps below when adding or updating props.

## Authoring guidelines

- Model in meters and freeze transforms before export. The world origin (`0,0,0`) aligns with the lobby spawn.
- Keep pivot at the floor for furniture so placement + seat offsets stay predictable.
- Use 1 unit = 1 meter scale to match our physics + navigation helpers.

## Geometry compression

1. Export meshes to `glb` from your DCC (Blender/Maya/C4D).
2. Run `gltf-pipeline` with Meshopt compression:
   ```bash
   npx gltf-pipeline -i source.glb -o optimized.glb --draco.compressionLevel 7 --meshopt
   ```
3. Verify vertex count and normals inside Babylon Sandbox before committing.
4. For instanced props (desks, chairs, lamps) keep vertex count under ~2.5k.

## Textures

- Author PBR textures (baseColor, normal, roughness, metalness, ao) at 1K or below.
- Convert to `.ktx2` using Basis Universal:
  ```bash
  npx @gltf-transform/cli etc1s in.glb out.glb --slots "baseColor" --slots "emissive" --quality 128
  ```
- Ensure textures include mipmaps. We rely on anisotropic filtering for floor tiles.

## Lightmaps

- Bake lightmaps for static architecture; keep them in a separate UV set (`UV2`).
- Clamp lightmap resolution to 512–1024 px per room chunk to avoid memory spikes.
- Store lightmaps as `.ktx2` (BC7 fallback for Safari).

## Validation checklist

- [ ] Geometry uses instancing where possible (desks, chairs, plants)
- [ ] Draw calls per room stay under 150
- [ ] Total texture memory < 250 MB
- [ ] FPS stays above 55 on an M1 Air / GTX 1060 class GPU
- [ ] No warnings from `yarn lint` or `yarn build`

## Where to put assets

- Place raw source files under `assets/meeting3d/source/`
- Optimised `.glb` and `.ktx2` variants go into `public/meeting3d/`
- Update the loader registry in `lib3d/Environment.ts` or room-specific modules when shipping new assets

