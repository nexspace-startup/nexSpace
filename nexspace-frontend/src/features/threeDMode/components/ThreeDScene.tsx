import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThreeDStore, type CameraMode } from '../store/threeDStore';
import { useUIStore } from '../../../stores/uiStore';
import { getThemeTokens } from '../../../constants/themeTokens';
import { useThreeDMovement } from '../hooks/useThreeDMovement';

const FLOOR_HEIGHT = 0.08;
const AVATAR_HEIGHT = 1.65;
const AVATAR_HEAD_RADIUS = 0.24;
const AVATAR_BODY_RADIUS = 0.28;

type AvatarSnapshot = ReturnType<typeof useThreeDStore.getState>['avatars'][string];
type RoomSnapshot = ReturnType<typeof useThreeDStore.getState>['rooms'][number];

const toThreeColor = (value: string): THREE.Color => {
  if (/rgba?\(/i.test(value)) {
    const match = value.match(/rgba?\(([^)]+)\)/i);
    if (match) {
      const [r, g, b] = match[1]
        .split(',')
        .slice(0, 3)
        .map((component) => Number.parseFloat(component.trim()) || 0);
      return new THREE.Color(r / 255, g / 255, b / 255);
    }
  }
  return new THREE.Color(value);
};

const createLabelTexture = (text: string, color: string, accent: string): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = `${accent}33`;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  const padding = 32;
  const radius = 28;
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;
  ctx.beginPath();
  ctx.moveTo(padding + radius, padding);
  ctx.lineTo(padding + width - radius, padding);
  ctx.quadraticCurveTo(padding + width, padding, padding + width, padding + radius);
  ctx.lineTo(padding + width, padding + height - radius);
  ctx.quadraticCurveTo(
    padding + width,
    padding + height,
    padding + width - radius,
    padding + height,
  );
  ctx.lineTo(padding + radius, padding + height);
  ctx.quadraticCurveTo(padding, padding + height, padding, padding + height - radius);
  ctx.lineTo(padding, padding + radius);
  ctx.quadraticCurveTo(padding, padding, padding + radius, padding);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = '600 72px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
};

const decorateRoom = (
  room: RoomSnapshot,
  tokens: ReturnType<typeof getThemeTokens>,
): THREE.Group => {
  const decoration = new THREE.Group();
  decoration.name = `decor:${room.id}`;

  const accent = toThreeColor(room.themeColor);
  const surface = toThreeColor(tokens.surface);
  const surfaceAlt = toThreeColor(tokens.surfaceAlt);

  const [centerX, centerZ] = room.boundary.center;
  decoration.position.set(centerX, 0, centerZ);
  if (room.boundary.type === 'rect' && room.boundary.rotation) {
    decoration.rotation.y = room.boundary.rotation;
  }

  const width = room.boundary.type === 'rect' ? room.boundary.size[0] : room.boundary.radius * 2;
  const depth = room.boundary.type === 'rect' ? room.boundary.size[1] : room.boundary.radius * 2;

  switch (room.id) {
    case 'open-work-area': {
      const deskGeometry = new THREE.BoxGeometry(1.8, 0.12, 1.1);
      const deskMaterial = new THREE.MeshStandardMaterial({
        color: surface.clone().lerp(accent, 0.25),
        roughness: 0.32,
        metalness: 0.18,
      });
      const chairGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.45, 18);
      const chairMaterial = new THREE.MeshStandardMaterial({
        color: surfaceAlt.clone().lerp(accent, 0.35),
        roughness: 0.55,
        metalness: 0.12,
      });

      const rows = 3;
      const cols = 3;
      const spacingX = width / (cols + 1);
      const spacingZ = depth / (rows + 1);

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const desk = new THREE.Mesh(deskGeometry.clone(), deskMaterial.clone());
          desk.position.set(
            -width / 2 + spacingX * (col + 1),
            FLOOR_HEIGHT + 0.46,
            -depth / 2 + spacingZ * (row + 1),
          );
          desk.castShadow = true;
          desk.receiveShadow = true;
          decoration.add(desk);

          const chair = new THREE.Mesh(chairGeometry.clone(), chairMaterial.clone());
          chair.position.set(desk.position.x, FLOOR_HEIGHT + 0.23, desk.position.z - 0.74);
          chair.castShadow = true;
          decoration.add(chair);
        }
      }

      const planterGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.6, 20);
      const planterMaterial = new THREE.MeshStandardMaterial({
        color: accent.clone().offsetHSL(-0.05, -0.05, 0.12),
        roughness: 0.6,
      });
      const planter = new THREE.Mesh(planterGeometry, planterMaterial);
      planter.position.set(-width / 2 + 1.4, FLOOR_HEIGHT + 0.3, depth / 2 - 1.3);
      planter.castShadow = true;
      decoration.add(planter);

      const foliageGeometry = new THREE.ConeGeometry(0.85, 1.35, 18);
      const foliageMaterial = new THREE.MeshStandardMaterial({
        color: accent.clone().offsetHSL(-0.18, 0.45, 0.15),
        roughness: 0.45,
        metalness: 0.05,
      });
      const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
      foliage.position.set(planter.position.x, FLOOR_HEIGHT + 1.32, planter.position.z);
      foliage.castShadow = true;
      decoration.add(foliage);

      const workLight = new THREE.PointLight(
        accent.clone().offsetHSL(-0.1, -0.2, 0.05).getHex(),
        0.55,
        Math.max(width, depth) * 0.9,
        2,
      );
      workLight.position.set(0, 4.2, 0);
      decoration.add(workLight);

      deskGeometry.dispose();
      chairGeometry.dispose();
      deskMaterial.dispose();
      chairMaterial.dispose();
      planterGeometry.dispose();
      planterMaterial.dispose();
      foliageGeometry.dispose();
      foliageMaterial.dispose();
      break;
    }
    case 'game-room': {
      const tableGeometry = new THREE.CylinderGeometry(1.3, 1.3, 0.12, 28);
      const tableMaterial = new THREE.MeshStandardMaterial({
        color: surfaceAlt.clone().lerp(accent, 0.18),
        roughness: 0.35,
        metalness: 0.22,
      });
      const topperMaterial = new THREE.MeshStandardMaterial({
        color: accent.clone().offsetHSL(0.08, 0.2, 0.2),
        roughness: 0.3,
        emissive: accent.clone().multiplyScalar(0.2),
      });

      const offset = 1.8;
      const tablePositions = [
        [-offset, 0],
        [offset, 0],
      ];

      tablePositions.forEach(([x, z]) => {
        const table = new THREE.Mesh(tableGeometry.clone(), tableMaterial.clone());
        table.position.set(x, FLOOR_HEIGHT + 0.3, z);
        table.castShadow = true;
        decoration.add(table);

        const topper = new THREE.Mesh(new THREE.CircleGeometry(1.05, 28), topperMaterial.clone());
        topper.rotation.x = -Math.PI / 2;
        topper.position.set(x, FLOOR_HEIGHT + 0.36, z);
        decoration.add(topper);
      });

      const arcadeGeometry = new THREE.BoxGeometry(0.9, 1.6, 0.8);
      const arcadeMaterial = new THREE.MeshStandardMaterial({
        color: accent.clone().offsetHSL(0.02, 0.12, 0.05),
        roughness: 0.4,
        metalness: 0.2,
        emissive: accent.clone().multiplyScalar(0.15),
      });
      const arcade = new THREE.Mesh(arcadeGeometry, arcadeMaterial);
      arcade.position.set(0, FLOOR_HEIGHT + 0.8, depth / 2 - 1.2);
      arcade.castShadow = true;
      decoration.add(arcade);

      const overhead = new THREE.PointLight(accent.clone().offsetHSL(0.12, 0.1, 0.25).getHex(), 0.65, 8, 2);
      overhead.position.set(0, 3.4, 0);
      decoration.add(overhead);

      tableGeometry.dispose();
      tableMaterial.dispose();
      topperMaterial.dispose();
      arcadeGeometry.dispose();
      arcadeMaterial.dispose();
      break;
    }
    case 'lounge-zone': {
      const radius = room.boundary.type === 'circle' ? room.boundary.radius : Math.min(width, depth) / 2;
      const rugGeometry = new THREE.CircleGeometry(radius * 0.82, 48);
      const rugMaterial = new THREE.MeshStandardMaterial({
        color: surface.clone().lerp(accent, 0.2),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        roughness: 0.45,
      });
      const rug = new THREE.Mesh(rugGeometry, rugMaterial);
      rug.rotation.x = -Math.PI / 2;
      rug.position.y = FLOOR_HEIGHT + 0.01;
      rug.receiveShadow = true;
      decoration.add(rug);

      const couchGeometry = new THREE.BoxGeometry(2.4, 0.78, 0.6);
      const couchMaterial = new THREE.MeshStandardMaterial({
        color: accent.clone().offsetHSL(-0.02, -0.15, 0.18),
        roughness: 0.55,
      });
      const couchPositions: Array<[number, number, number]> = [
        [-2.1, 0, Math.PI / 2],
        [2.1, 0, -Math.PI / 2],
        [0, -2.1, 0],
      ];
      couchPositions.forEach(([x, z, rotation]) => {
        const couch = new THREE.Mesh(couchGeometry.clone(), couchMaterial.clone());
        couch.position.set(x, FLOOR_HEIGHT + 0.4, z);
        couch.rotation.y = rotation;
        couch.castShadow = true;
        decoration.add(couch);
      });

      const tableGeometry = new THREE.CylinderGeometry(0.9, 0.9, 0.22, 24);
      const tableMaterial = new THREE.MeshStandardMaterial({
        color: surface.clone().lerp(accent, 0.12),
        roughness: 0.38,
        metalness: 0.12,
      });
      const table = new THREE.Mesh(tableGeometry, tableMaterial);
      table.position.set(0, FLOOR_HEIGHT + 0.32, 0);
      table.castShadow = true;
      decoration.add(table);

      const loungeLight = new THREE.PointLight(accent.clone().offsetHSL(-0.18, 0.3, 0.25).getHex(), 0.6, radius * 2.4, 2);
      loungeLight.position.set(0, 3.1, 0);
      decoration.add(loungeLight);

      rugGeometry.dispose();
      rugMaterial.dispose();
      couchGeometry.dispose();
      couchMaterial.dispose();
      tableGeometry.dispose();
      tableMaterial.dispose();
      break;
    }
    case 'conference-room': {
      const tableGeometry = new THREE.BoxGeometry(4.2, 0.12, 1.6);
      const tableMaterial = new THREE.MeshStandardMaterial({
        color: surface.clone().lerp(accent, 0.22),
        roughness: 0.28,
        metalness: 0.28,
      });
      const table = new THREE.Mesh(tableGeometry, tableMaterial);
      table.position.set(0, FLOOR_HEIGHT + 0.44, 0);
      table.castShadow = true;
      table.receiveShadow = true;
      decoration.add(table);

      const chairGeometry = new THREE.CapsuleGeometry(0.28, 0.68, 6, 12);
      const chairMaterial = new THREE.MeshStandardMaterial({
        color: surfaceAlt.clone().lerp(accent, 0.28),
        roughness: 0.42,
        metalness: 0.2,
      });
      const seats = 6;
      for (let i = 0; i < seats; i += 1) {
        const ratio = (i / seats) * Math.PI * 2;
        const radius = 2.2;
        const chair = new THREE.Mesh(chairGeometry.clone(), chairMaterial.clone());
        chair.position.set(Math.cos(ratio) * radius, FLOOR_HEIGHT + 0.6, Math.sin(ratio) * radius);
        chair.lookAt(new THREE.Vector3(0, chair.position.y, 0));
        chair.castShadow = true;
        decoration.add(chair);
      }

      const screenGeometry = new THREE.PlaneGeometry(3.6, 2.2);
      const screenMaterial = new THREE.MeshStandardMaterial({
        color: accent.clone().offsetHSL(0.2, -0.3, 0.25),
        emissive: accent.clone().multiplyScalar(0.4),
        roughness: 0.15,
      });
      const screen = new THREE.Mesh(screenGeometry, screenMaterial);
      screen.position.set(0, FLOOR_HEIGHT + 2.1, -depth / 2 + 0.2);
      decoration.add(screen);

      const spot = new THREE.SpotLight(accent.clone().offsetHSL(-0.1, -0.2, 0.25).getHex(), 0.8, 10, Math.PI / 4, 0.3, 1.5);
      spot.position.set(0, 4.5, depth / 2 - 1.4);
      spot.target.position.set(0, FLOOR_HEIGHT + 0.6, 0);
      decoration.add(spot);
      decoration.add(spot.target);

      tableGeometry.dispose();
      tableMaterial.dispose();
      chairGeometry.dispose();
      chairMaterial.dispose();
      screenGeometry.dispose();
      screenMaterial.dispose();
      break;
    }
    case 'event-hall': {
      const stageGeometry = new THREE.BoxGeometry(width * 0.55, 0.36, 3.4);
      const stageMaterial = new THREE.MeshStandardMaterial({
        color: surface.clone().lerp(accent, 0.3),
        roughness: 0.35,
        metalness: 0.15,
      });
      const stage = new THREE.Mesh(stageGeometry, stageMaterial);
      stage.position.set(0, FLOOR_HEIGHT + 0.18, -depth / 2 + 1.7);
      stage.receiveShadow = true;
      stage.castShadow = true;
      decoration.add(stage);

      const screenGeometry = new THREE.PlaneGeometry(width * 0.45, 3.2);
      const screenMaterial = new THREE.MeshStandardMaterial({
        color: accent.clone().offsetHSL(0.12, -0.22, 0.32),
        emissive: accent.clone().multiplyScalar(0.5),
        roughness: 0.18,
      });
      const screen = new THREE.Mesh(screenGeometry, screenMaterial);
      screen.position.set(0, FLOOR_HEIGHT + 3.2, -depth / 2 + 0.2);
      decoration.add(screen);

      const rowGeometry = new THREE.BoxGeometry(width * 0.6, 0.18, 1.2);
      const rowMaterial = new THREE.MeshStandardMaterial({
        color: surfaceAlt.clone().lerp(accent, 0.12),
        roughness: 0.48,
      });
      const rows = 3;
      for (let i = 0; i < rows; i += 1) {
        const bench = new THREE.Mesh(rowGeometry.clone(), rowMaterial.clone());
        bench.position.set(0, FLOOR_HEIGHT + 0.18, -0.5 + i * 2.2);
        bench.receiveShadow = true;
        decoration.add(bench);
      }

      const hallLight = new THREE.SpotLight(accent.clone().offsetHSL(-0.22, -0.2, 0.4).getHex(), 1.2, 30, Math.PI / 3.5, 0.35, 1.4);
      hallLight.position.set(0, 8, depth / 2 - 2.4);
      hallLight.target.position.set(0, FLOOR_HEIGHT + 1.2, -depth / 2 + 1.2);
      hallLight.castShadow = true;
      decoration.add(hallLight);
      decoration.add(hallLight.target);

      stageGeometry.dispose();
      stageMaterial.dispose();
      screenGeometry.dispose();
      screenMaterial.dispose();
      rowGeometry.dispose();
      rowMaterial.dispose();
      break;
    }
    default:
      break;
  }

  return decoration;
};

const buildRoomMesh = (
  room: ReturnType<typeof useThreeDStore.getState>['rooms'][number],
  tokens: ReturnType<typeof getThemeTokens>,
): THREE.Group => {
  const group = new THREE.Group();

  if (room.boundary.type === 'rect') {
    const geometry = new THREE.BoxGeometry(room.boundary.size[0], FLOOR_HEIGHT, room.boundary.size[1]);
    const material = new THREE.MeshStandardMaterial({
      color: toThreeColor(room.themeColor).clone().lerp(toThreeColor(tokens.surfaceAlt), 0.35),
      transparent: true,
      opacity: 0.85,
    });
    const floor = new THREE.Mesh(geometry, material);
    floor.position.set(room.boundary.center[0], FLOOR_HEIGHT / 2, room.boundary.center[1]);
    if (room.boundary.rotation) {
      floor.rotation.y = room.boundary.rotation;
    }
    floor.receiveShadow = true;
    group.add(floor);

    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: toThreeColor(room.themeColor).clone().lerp(toThreeColor(tokens.textMuted), 0.2),
      linewidth: 1,
    });
    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    edgeLines.position.copy(floor.position);
    if (room.boundary.rotation) {
      edgeLines.rotation.y = room.boundary.rotation;
    }
    group.add(edgeLines);
  } else if (room.boundary.type === 'circle') {
    const geometry = new THREE.CylinderGeometry(
      room.boundary.radius,
      room.boundary.radius,
      FLOOR_HEIGHT,
      48,
      1,
      false,
    );
    const material = new THREE.MeshStandardMaterial({
      color: toThreeColor(room.themeColor).clone().lerp(toThreeColor(tokens.surfaceAlt), 0.25),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(geometry, material);
    floor.position.set(room.boundary.center[0], FLOOR_HEIGHT / 2, room.boundary.center[1]);
    floor.receiveShadow = true;
    group.add(floor);

    const rimGeometry = new THREE.RingGeometry(
      room.boundary.radius * 0.98,
      room.boundary.radius,
      64,
    );
    const rimMaterial = new THREE.MeshBasicMaterial({
      color: toThreeColor(room.themeColor),
      side: THREE.DoubleSide,
    });
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(room.boundary.center[0], FLOOR_HEIGHT + 0.002, room.boundary.center[1]);
    group.add(rim);
  }

  const labelTexture = createLabelTexture(room.name, tokens.textPrimary, room.themeColor);
  const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true });
  const label = new THREE.Sprite(labelMaterial);
  label.scale.set(6, 2.4, 1);
  label.position.set(room.boundary.center[0], FLOOR_HEIGHT + 1.8, room.boundary.center[1]);
  label.renderOrder = 10;
  group.add(label);

  const decor = decorateRoom(room, tokens);
  group.add(decor);

  group.name = `room:${room.id}`;

  return group;
};

const buildAvatarMesh = (
  avatar: AvatarSnapshot,
  tokens: ReturnType<typeof getThemeTokens>,
): THREE.Group => {
  const group = new THREE.Group();
  group.name = avatar.id;

  const baseColor = avatar.isLocal
    ? toThreeColor(tokens.accent)
    : toThreeColor(tokens.textSecondary)
        .clone()
        .lerp(toThreeColor(avatar.avatarUrl ? '#ffffff' : tokens.textPrimary), 0.25);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    metalness: 0.1,
    roughness: 0.45,
  });

  const bodyGeometry = new THREE.CapsuleGeometry(AVATAR_BODY_RADIUS, AVATAR_HEIGHT - AVATAR_HEAD_RADIUS * 2, 8, 16);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.position.y = AVATAR_HEIGHT / 2;
  group.add(body);

  const headMaterial = new THREE.MeshStandardMaterial({
    color: avatar.isLocal ? toThreeColor(tokens.surface) : baseColor.clone().offsetHSL(0, 0, 0.1),
    metalness: 0.05,
    roughness: 0.4,
  });
  const headGeometry = new THREE.SphereGeometry(AVATAR_HEAD_RADIUS, 32, 16);
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.castShadow = true;
  head.position.y = AVATAR_HEIGHT + AVATAR_HEAD_RADIUS * 0.6;
  group.add(head);

  const nameCanvas = document.createElement('canvas');
  nameCanvas.width = 256;
  nameCanvas.height = 128;
  const nameCtx = nameCanvas.getContext('2d');
  if (nameCtx) {
    nameCtx.clearRect(0, 0, nameCanvas.width, nameCanvas.height);
    nameCtx.fillStyle = avatar.isLocal ? tokens.accent : tokens.surface;
    nameCtx.globalAlpha = 0.92;
    nameCtx.fillRect(0, 0, nameCanvas.width, nameCanvas.height);
    nameCtx.globalAlpha = 1;
    nameCtx.fillStyle = avatar.isLocal ? tokens.surface : tokens.textPrimary;
    nameCtx.font = '600 42px "Inter", sans-serif';
    nameCtx.textAlign = 'center';
    nameCtx.textBaseline = 'middle';
    nameCtx.fillText(avatar.displayName ?? 'Guest', nameCanvas.width / 2, nameCanvas.height / 2);
  }
  const nameTexture = new THREE.CanvasTexture(nameCanvas);
  nameTexture.anisotropy = 2;
  const nameMaterial = new THREE.SpriteMaterial({ map: nameTexture, transparent: true });
  const nameplate = new THREE.Sprite(nameMaterial);
  nameplate.position.set(0, AVATAR_HEIGHT + AVATAR_HEAD_RADIUS * 2.6, 0);
  nameplate.scale.set(2.7, 0.9, 1);
  nameplate.renderOrder = 20;
  group.add(nameplate);

  group.userData = {
    bobOffset: Math.random() * Math.PI * 2,
  };

  return group;
};

const updateAvatarMesh = (group: THREE.Group, avatar: AvatarSnapshot, now: number): void => {
  group.position.set(avatar.position.x, 0, avatar.position.y);
  group.rotation.y = avatar.heading ?? 0;

  const bob = Math.sin(now * 0.9 + (group.userData?.bobOffset ?? 0)) * 0.08;
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry instanceof THREE.SphereGeometry) {
        child.position.y = AVATAR_HEIGHT + AVATAR_HEAD_RADIUS * 0.6 + bob;
      }
    }
    if (child instanceof THREE.Sprite && child.renderOrder === 20) {
      child.position.y = AVATAR_HEIGHT + AVATAR_HEAD_RADIUS * 2.6 + bob;
    }
  });
  group.userData.lastAvatar = avatar;
};

const ThreeDScene: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const roomsGroupRef = useRef<THREE.Group | null>(null);
  const clockRef = useRef(new THREE.Clock());

  useThreeDMovement();

  const theme = useUIStore((state) => state.theme);
  const tokens = useMemo(() => getThemeTokens(theme), [theme]);
  const quality = useThreeDStore((state) => state.quality);
  const rooms = useThreeDStore((state) => state.rooms);
  const avatarsRecord = useThreeDStore((state) => state.avatars);
  const avatars = useMemo(() => Object.values(avatarsRecord), [avatarsRecord]);
  const waypoints = useThreeDStore((state) => state.minimapWaypoints);
  const localAvatarId = useThreeDStore((state) => state.localAvatarId);
  const cameraMode = useThreeDStore((state) => state.cameraMode);

  const sortedAvatars = useMemo(
    () =>
      [...avatars].sort((a, b) => (a.isLocal === b.isLocal ? a.id.localeCompare(b.id) : a.isLocal ? -1 : 1)),
    [avatars],
  );

  const avatarsById = useMemo(
    () =>
      sortedAvatars.reduce<Record<string, AvatarSnapshot>>((acc, avatar) => {
        acc[avatar.id] = avatar;
        return acc;
      }, {}),
    [sortedAvatars],
  );

  const latestCameraStateRef = useRef<{
    localAvatarId: string | null;
    avatars: Record<string, AvatarSnapshot>;
    mode: CameraMode;
  }>({ localAvatarId: null, avatars: {}, mode: cameraMode });

  useEffect(() => {
    latestCameraStateRef.current.localAvatarId = localAvatarId;
    latestCameraStateRef.current.avatars = avatarsById;
    latestCameraStateRef.current.mode = cameraMode;
  }, [avatarsById, cameraMode, localAvatarId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    clockRef.current.start();
    const renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', alpha: true });
    renderer.setPixelRatio(quality === 'high' ? pixelRatio : Math.min(pixelRatio, 1.5));
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      48,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      200,
    );
    camera.position.set(24, 20, 26);
    camera.lookAt(new THREE.Vector3(4, 0, 4));
    cameraRef.current = camera;

    const ambient = new THREE.HemisphereLight(0xffffff, 0x111111, 0.92);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.name = 'key-light';
    directional.position.set(20, 30, 16);
    directional.castShadow = quality !== 'low';
    directional.shadow.camera.top = 40;
    directional.shadow.camera.bottom = -40;
    directional.shadow.camera.left = -40;
    directional.shadow.camera.right = 40;
    directional.shadow.mapSize.width = 1024;
    directional.shadow.mapSize.height = 1024;
    scene.add(directional);

    const groundGeometry = new THREE.PlaneGeometry(120, 120, 1, 1);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: toThreeColor(tokens.background).clone().lerp(toThreeColor(tokens.surfaceAlt), 0.2),
      roughness: 0.9,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const roomsGroup = new THREE.Group();
    roomsGroupRef.current = roomsGroup;
    scene.add(roomsGroup);

    const avatarGroup = new THREE.Group();
    avatarGroupRef.current = avatarGroup;
    scene.add(avatarGroup);

    const waypointGroup = new THREE.Group();
    waypointGroup.name = 'waypoints';
    scene.add(waypointGroup);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target !== containerRef.current) continue;
        const { width, height } = entry.contentRect;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(containerRef.current);

    let frameId: number;
    const renderLoop = () => {
      const elapsed = clockRef.current.getElapsedTime();
      const cameraState = latestCameraStateRef.current;

      avatarGroup.children.forEach((child) => {
        if (child instanceof THREE.Group) {
          const snapshot = cameraState.avatars[child.name] ?? (child.userData?.lastAvatar as AvatarSnapshot | undefined);
          child.visible = !(
            cameraState.mode === 'first-person' &&
            cameraState.localAvatarId &&
            child.name === cameraState.localAvatarId
          );
          if (snapshot) {
            updateAvatarMesh(child, snapshot, elapsed);
          }
        }
      });

      const trackedCamera = cameraRef.current;
      if (trackedCamera && cameraState.localAvatarId) {
        const focusAvatar = cameraState.avatars[cameraState.localAvatarId];
        if (focusAvatar) {
          const heading = focusAvatar.heading ?? 0;
          const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
          const baseTarget = new THREE.Vector3(
            focusAvatar.position.x,
            AVATAR_HEIGHT * 0.85,
            focusAvatar.position.y,
          );

          if (cameraState.mode === 'first-person') {
            const eye = new THREE.Vector3(focusAvatar.position.x, AVATAR_HEIGHT * 0.92, focusAvatar.position.y);
            const lookTarget = eye.clone().add(forward.clone().multiplyScalar(6));
            const desired = eye
              .clone()
              .sub(forward.clone().multiplyScalar(0.18))
              .add(new THREE.Vector3(0, 0.04, 0));
            trackedCamera.position.lerp(desired, 0.22);
            trackedCamera.lookAt(lookTarget);
          } else {
            const side = new THREE.Vector3(-forward.z, 0, forward.x);
            const desired = new THREE.Vector3(
              focusAvatar.position.x,
              AVATAR_HEIGHT * 0.9 + 4.6,
              focusAvatar.position.y,
            )
              .add(forward.clone().multiplyScalar(-7.2))
              .add(side.multiplyScalar(1.8));
            trackedCamera.position.lerp(desired, 0.12);
            trackedCamera.lookAt(baseTarget.clone().add(new THREE.Vector3(0, 0.4, 0)));
          }
        }
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(renderLoop);
    };
    frameId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentElement === containerRef.current) {
        containerRef.current?.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      avatarGroupRef.current = null;
      roomsGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const background = toThreeColor(tokens.background)
      .clone()
      .lerp(toThreeColor(theme === 'dark' ? '#080912' : '#f1f5ff'), 0.35);
    scene.background = background;
    scene.fog = new THREE.Fog(background.getHex(), 40, 120);

    const ground = scene.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry,
    );
    if (ground && ground.material instanceof THREE.MeshStandardMaterial) {
      ground.material.color = toThreeColor(tokens.background)
        .clone()
        .lerp(toThreeColor(tokens.surfaceAlt), 0.2);
    }
  }, [tokens, theme]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer) {
      const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
      renderer.shadowMap.enabled = quality !== 'low';
      renderer.setPixelRatio(quality === 'high' ? pixelRatio : Math.min(pixelRatio, 1.5));
    }

    const scene = sceneRef.current;
    const keyLight = scene?.getObjectByName('key-light') as THREE.DirectionalLight | undefined;
    if (keyLight) {
      keyLight.castShadow = quality !== 'low';
      keyLight.intensity = quality === 'low' ? 0.65 : 0.85;
    }
  }, [quality]);

  useEffect(() => {
    const roomsGroup = roomsGroupRef.current;
    const scene = sceneRef.current;
    if (!roomsGroup || !scene) return;

    while (roomsGroup.children.length) {
      const child = roomsGroup.children.pop();
      if (child) {
        child.traverse((node) => {
          if (node instanceof THREE.Sprite) {
            (node.material as THREE.SpriteMaterial).map?.dispose();
            node.material.dispose();
          }
          if (node instanceof THREE.Mesh) {
            node.geometry.dispose();
            if (Array.isArray(node.material)) {
              node.material.forEach((material) => material.dispose());
            } else {
              node.material.dispose();
            }
          }
          if (node instanceof THREE.LineSegments) {
            node.geometry.dispose();
            if (Array.isArray(node.material)) {
              node.material.forEach((material) => material.dispose());
            } else {
              node.material.dispose();
            }
          }
        });
      }
    }

    rooms.forEach((room) => {
      const mesh = buildRoomMesh(room, tokens);
      roomsGroup.add(mesh);
    });
  }, [rooms, tokens]);

  useEffect(() => {
    const avatarGroup = avatarGroupRef.current;
    if (!avatarGroup) return;

    const now = clockRef.current.getElapsedTime();
    const existingIds = new Set(sortedAvatars.map((avatar) => avatar.id));

    avatarGroup.children.slice().forEach((child) => {
      if (!(child instanceof THREE.Group)) return;
      if (!existingIds.has(child.name)) {
        avatarGroup.remove(child);
        child.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.geometry.dispose();
            if (Array.isArray(node.material)) {
              node.material.forEach((material) => material.dispose());
            } else {
              node.material.dispose();
            }
          }
          if (node instanceof THREE.Sprite) {
            (node.material as THREE.SpriteMaterial).map?.dispose();
            node.material.dispose();
          }
        });
      }
    });

    sortedAvatars.forEach((avatar) => {
      let avatarMesh = avatarGroup.getObjectByName(avatar.id) as THREE.Group | null;
      if (!avatarMesh) {
        avatarMesh = buildAvatarMesh(avatar, tokens);
        avatarGroup.add(avatarMesh);
      }
      updateAvatarMesh(avatarMesh, avatar, now);
    });
  }, [sortedAvatars, tokens]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const waypointGroup = scene.getObjectByName('waypoints') as THREE.Group | undefined;
    if (!waypointGroup) return;

    while (waypointGroup.children.length) {
      const child = waypointGroup.children.pop();
      if (child) {
        child.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.geometry.dispose();
            if (!Array.isArray(node.material)) {
              node.material.dispose();
            }
          }
        });
      }
    }

    Object.entries(waypoints).forEach(([avatarId, waypoint]) => {
      if (!waypoint) return;

      const avatar = avatarsById[avatarId];
      const accent = avatar?.isLocal ? tokens.accent : tokens.textSecondary;
      const container = new THREE.Group();
      container.name = `waypoint:${avatarId}`;

      const coneMaterial = new THREE.MeshBasicMaterial({
        color: toThreeColor(accent),
        transparent: true,
        opacity: avatar?.isLocal ? 0.85 : 0.65,
      });
      const coneGeometry = new THREE.ConeGeometry(0.45, 1.1, 16);
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      cone.position.set(waypoint.x, 0.55, waypoint.y);
      cone.rotation.x = Math.PI;
      container.add(cone);

      if (avatar?.isLocal) {
        const dx = waypoint.x - avatar.position.x;
        const dy = waypoint.y - avatar.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0.1) {
          const steps = Math.min(7, Math.max(3, Math.ceil(distance / 2)));
          const arrowMaterial = new THREE.MeshBasicMaterial({
            color: toThreeColor(tokens.accent),
            transparent: true,
            opacity: 0.55,
          });
          const arrowGeometry = new THREE.ConeGeometry(0.22, 0.7, 12);
          const heading = Math.atan2(dx, dy);

          for (let i = 1; i <= steps; i += 1) {
            const t = i / (steps + 1);
            const arrow = new THREE.Mesh(arrowGeometry.clone(), arrowMaterial.clone());
            arrow.position.set(
              avatar.position.x + dx * t,
              0.18 + (i % 2 === 0 ? 0.06 : 0),
              avatar.position.y + dy * t,
            );
            arrow.rotation.x = Math.PI;
            arrow.rotation.y = heading;
            container.add(arrow);
          }

          arrowGeometry.dispose();
          arrowMaterial.dispose();
        }
      } else if (localAvatarId) {
        const localAvatar = avatarsById[localAvatarId];
        if (localAvatar) {
          const dx = waypoint.x - localAvatar.position.x;
          const dy = waypoint.y - localAvatar.position.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0.1) {
            const guideMaterial = new THREE.MeshBasicMaterial({
              color: toThreeColor(tokens.textSecondary),
              transparent: true,
              opacity: 0.35,
            });
            const guideGeometry = new THREE.CylinderGeometry(0.04, 0.04, distance, 6);
            const guide = new THREE.Mesh(guideGeometry, guideMaterial);
            guide.position.set(
              (waypoint.x + localAvatar.position.x) / 2,
              0.02,
              (waypoint.y + localAvatar.position.y) / 2,
            );
            const direction = new THREE.Vector3(dx, 0, dy);
            if (direction.lengthSq() > 0) {
              direction.normalize();
              guide.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
            }
            container.add(guide);
          }
        }
      }

      waypointGroup.add(container);
    });
  }, [avatarsById, localAvatarId, tokens, waypoints]);

  return <div ref={containerRef} className="absolute inset-0" />;
};

export default ThreeDScene;
