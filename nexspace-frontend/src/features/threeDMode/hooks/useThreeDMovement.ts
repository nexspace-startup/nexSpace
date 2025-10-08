import { useEffect, useRef } from 'react';
import { useThreeDStore } from '../store/threeDStore';

const MOVEMENT_SPEED = 3.6; // units per second
const ACCELERATION = 12;
const DAMPING = 8;

const KEY_TO_VECTOR: Record<string, { x: number; y: number }> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export const useThreeDMovement = (): void => {
  const localAvatarId = useThreeDStore((s) => s.localAvatarId);
  const setAvatarPosition = useThreeDStore((s) => s.setAvatarPosition);

  const pressedKeysRef = useRef<Set<string>>(new Set());
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!localAvatarId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (KEY_TO_VECTOR[event.code]) {
        pressedKeysRef.current.add(event.code);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (KEY_TO_VECTOR[event.code]) {
        pressedKeysRef.current.delete(event.code);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationFrame: number;

    const step = (time: number) => {
      if (!localAvatarId) return;
      const store = useThreeDStore.getState();
      const avatar = store.avatars[localAvatarId];
      if (!avatar) {
        animationFrame = requestAnimationFrame(step);
        return;
      }

      const last = lastFrameRef.current ?? time;
      const delta = Math.min((time - last) / 1000, 1 / 24);
      lastFrameRef.current = time;

      let inputX = 0;
      let inputY = 0;
      pressedKeysRef.current.forEach((code) => {
        const vector = KEY_TO_VECTOR[code];
        if (vector) {
          inputX += vector.x;
          inputY += vector.y;
        }
      });

      let worldX = 0;
      let worldY = 0;

      if (inputX !== 0 || inputY !== 0) {
        const length = Math.hypot(inputX, inputY) || 1;
        const normalizedX = inputX / length;
        const normalizedY = inputY / length;

        const state = useThreeDStore.getState();
        const useRelative = state.cameraMode === 'first-person' || state.cameraMode === 'third-person';

        if (useRelative) {
          const heading = avatar.heading ?? 0;
          const forwardX = Math.sin(heading);
          const forwardY = Math.cos(heading);
          const rightX = Math.cos(heading);
          const rightY = -Math.sin(heading);
          const forwardInput = -normalizedY;
          const strafeInput = normalizedX;
          worldX = forwardX * forwardInput + rightX * strafeInput;
          worldY = forwardY * forwardInput + rightY * strafeInput;
        } else {
          worldX = normalizedX;
          worldY = normalizedY;
        }

        velocityRef.current.x = velocityRef.current.x + (worldX * MOVEMENT_SPEED - velocityRef.current.x) * Math.min(1, ACCELERATION * delta);
        velocityRef.current.y = velocityRef.current.y + (worldY * MOVEMENT_SPEED - velocityRef.current.y) * Math.min(1, ACCELERATION * delta);
      } else {
        velocityRef.current.x = velocityRef.current.x * Math.max(0, 1 - DAMPING * delta);
        velocityRef.current.y = velocityRef.current.y * Math.max(0, 1 - DAMPING * delta);
      }

      const nextX = avatar.position.x + velocityRef.current.x * delta;
      const nextY = avatar.position.y + velocityRef.current.y * delta;

      if (Number.isFinite(nextX) && Number.isFinite(nextY)) {
        const state = useThreeDStore.getState();
        const isFirstPerson = state.cameraMode === 'first-person';
        setAvatarPosition(
          localAvatarId,
          { x: nextX, y: nextY },
          isFirstPerson
            ? {
                heading: avatar.heading,
                preserveHeading: true,
              }
            : undefined,
        );
      }

      animationFrame = requestAnimationFrame(step);
    };

    animationFrame = requestAnimationFrame(step);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      pressedKeysRef.current.clear();
      velocityRef.current = { x: 0, y: 0 };
      lastFrameRef.current = null;
    };
  }, [localAvatarId, setAvatarPosition]);
};
