import { describe, expect, it } from 'vitest';
import {
  clampToCampusBounds,
  computeCampusBounds,
  pointInCircle,
  pointInRect,
  resolveRoomForPosition,
} from '../utils/spatial';
import { defaultRooms } from '../config/rooms';

const fallbackRoomId = defaultRooms[0]?.id ?? 'open-work-area';

describe('spatial utils', () => {
  it('checks rectangles with rotation', () => {
    const inside = pointInRect({ x: 1, y: 1 }, [1, 1], [4, 2]);
    expect(inside).toBe(true);

    const outside = pointInRect({ x: 5, y: 1 }, [1, 1], [4, 2]);
    expect(outside).toBe(false);

    const rotatedInside = pointInRect({ x: 2, y: 2 }, [2, 2], [4, 2], Math.PI / 4);
    expect(rotatedInside).toBe(true);
  });

  it('checks circles', () => {
    expect(pointInCircle({ x: 0, y: 0 }, [0, 0], 3)).toBe(true);
    expect(pointInCircle({ x: 4, y: 0 }, [0, 0], 3)).toBe(false);
  });

  it('resolves room for given position', () => {
    const openArea = resolveRoomForPosition({ x: 0, y: 0 }, defaultRooms, fallbackRoomId);
    expect(openArea).toBe('open-work-area');

    const lounge = resolveRoomForPosition({ x: 6, y: -12 }, defaultRooms, fallbackRoomId);
    expect(lounge).toBe('lounge-zone');

    const fallback = resolveRoomForPosition({ x: 100, y: 100 }, defaultRooms, fallbackRoomId);
    expect(fallback).toBe(fallbackRoomId);
  });

  it('clamps positions to campus bounds with padding', () => {
    const clamped = clampToCampusBounds({ x: 999, y: -999 }, defaultRooms);
    expect(clamped.x).toBeLessThan(40);
    expect(clamped.y).toBeGreaterThan(-40);
  });

  it('computes campus bounds extents', () => {
    const bounds = computeCampusBounds(defaultRooms);
    expect(bounds).not.toBeNull();
    if (!bounds) return;
    expect(bounds.minX).toBeLessThan(bounds.maxX);
    expect(bounds.width).toBeCloseTo(bounds.maxX - bounds.minX);
    expect(bounds.height).toBeCloseTo(bounds.maxY - bounds.minY);
  });

  it('returns null bounds when rooms are empty', () => {
    const bounds = computeCampusBounds([]);
    expect(bounds).toBeNull();
  });
});
