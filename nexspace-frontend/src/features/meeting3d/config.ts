export const meeting3dFeatures = {
  /** Enable the overhauled minimap UI with quick room jump actions. */
  showMinimapOverlay: true,
  /** When true we enforce the nav volume budget instead of the legacy collider blocklist. */
  enforceNavVolumes: true,
  /** Keep portal metadata active so later phases can light up teleport triggers. */
  showPortalDebug: false,
  /** Toggle HDR environment map + PMREM lighting. */
  enableHdriEnvironment: true,
  /** Toggle GLB-backed room modules. */
  useRoomModules: true,
} as const;

export type Meeting3DFeatureFlags = typeof meeting3dFeatures;
