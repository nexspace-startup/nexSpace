import React, { useCallback, useMemo, useRef } from 'react';
import { useThreeDStore } from '../store/threeDStore';
import { useUIStore } from '../../../stores/uiStore';
import { getThemeTokens } from '../../../constants/themeTokens';
import { computeCampusBounds } from '../utils/spatial';
import type { RoomDefinition } from '../config/rooms';

const MAX_NAME_TAGS = 4;

const roomColorFor = (rooms: RoomDefinition[], roomId: string | undefined, fallback: string): string => {
  if (!roomId) return fallback;
  return rooms.find((room) => room.id === roomId)?.themeColor ?? fallback;
};

type ThreeDMinimapProps = {
  showHeader?: boolean;
};

const ThreeDMinimap: React.FC<ThreeDMinimapProps> = ({ showHeader = true }) => {
  const rooms = useThreeDStore((s) => s.rooms);
  const avatars = useThreeDStore((s) => s.avatars);
  const localAvatarId = useThreeDStore((s) => s.localAvatarId);
  const waypoints = useThreeDStore((s) => s.minimapWaypoints);
  const markWaypoint = useThreeDStore((s) => s.markWaypoint);
  const theme = useUIStore((s) => s.theme);
  const tokens = getThemeTokens(theme);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const campusBounds = useMemo(() => computeCampusBounds(rooms), [rooms]);

  const viewBox = useMemo(() => {
    if (!campusBounds) return '-10 -10 20 20';
    const margin = 4;
    return `${campusBounds.minX - margin} ${campusBounds.minY - margin} ${
      campusBounds.width + margin * 2
    } ${campusBounds.height + margin * 2}`;
  }, [campusBounds]);

  const projectedAvatars = useMemo(
    () =>
      Object.values(avatars).map((avatar) => ({
        ...avatar,
        waypoint: waypoints[avatar.id] ?? null,
      })),
    [avatars, waypoints],
  );

  const localRoomId = useMemo(() => {
    const localAvatar = projectedAvatars.find((avatar) => avatar.id === localAvatarId);
    return localAvatar?.roomId;
  }, [localAvatarId, projectedAvatars]);

  const summary = useMemo(
    () =>
      rooms.map((room) => {
        const occupants = Object.values(avatars).filter((avatar) => avatar.roomId === room.id);
        const localInside = occupants.some((avatar) => avatar.isLocal);
        return {
          room,
          occupants,
          localInside,
        };
      }),
    [rooms, avatars]
  );

  const totalAvatars = useMemo(() => Object.keys(avatars).length, [avatars]);

  const handleMapClick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!localAvatarId) return;
      const svg = svgRef.current;
      if (!svg) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const screenCTM = svg.getScreenCTM();
      if (!screenCTM) return;
      const cursor = point.matrixTransform(screenCTM.inverse());
      if (event.altKey) {
        markWaypoint(localAvatarId, null);
        return;
      }
      markWaypoint(localAvatarId, { x: cursor.x, y: cursor.y });
    },
    [localAvatarId, markWaypoint],
  );

  return (
    <div
      className="w-full rounded-3xl border shadow-2xl backdrop-blur-xl"
      style={{
        borderColor: tokens.borderSoft,
        background: tokens.surface,
      }}
    >
      {showHeader && (
        <div className="flex items-center justify-between px-4 pt-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em]" style={{ color: tokens.textMuted }}>
              Minimap
            </p>
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
              Live campus overview
            </p>
          </div>
          <span className="text-xs font-medium" style={{ color: tokens.textSecondary }}>
            {totalAvatars} online
          </span>
        </div>
      )}
      <div
        className={`mx-4 ${showHeader ? 'mt-3' : 'mt-4'} rounded-2xl border`}
        style={{
          borderColor: tokens.borderSoft,
          background: tokens.surfaceAlt,
        }}
      >
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="h-48 w-full cursor-pointer"
          role="img"
          aria-label="Campus minimap"
          onClick={handleMapClick}
        >
          <defs>
            <radialGradient id="minimap-glow" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor={tokens.surfaceAlpha} stopOpacity={0.8} />
              <stop offset="100%" stopColor={tokens.surface} stopOpacity={0} />
            </radialGradient>
          </defs>
          <rect
            x={campusBounds ? campusBounds.minX - 6 : -12}
            y={campusBounds ? campusBounds.minY - 6 : -12}
            width={campusBounds ? campusBounds.width + 12 : 24}
            height={campusBounds ? campusBounds.height + 12 : 24}
            fill="url(#minimap-glow)"
          />
          {rooms.map((room) => {
            const boundary = room.boundary;
            const stroke = room.id === localRoomId ? tokens.accent : tokens.borderSoft;
            if (boundary.type === 'rect') {
              const [cx, cy] = boundary.center;
              const [w, h] = boundary.size;
              const rotation = ((boundary.rotation ?? 0) * 180) / Math.PI;
              return (
                <rect
                  key={room.id}
                  x={cx - w / 2}
                  y={cy - h / 2}
                  width={w}
                  height={h}
                  rx={1.2}
                  ry={1.2}
                  fill={room.id === localRoomId ? tokens.accentSoft : tokens.surface}
                  stroke={stroke}
                  strokeWidth={0.3}
                  opacity={0.9}
                  transform={rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined}
                />
              );
            }
            return (
              <circle
                key={room.id}
                cx={boundary.center[0]}
                cy={boundary.center[1]}
                r={boundary.radius}
                fill={room.id === localRoomId ? tokens.accentSoft : tokens.surface}
                stroke={stroke}
                strokeWidth={0.4}
                opacity={0.92}
              />
            );
          })}
          {projectedAvatars.map((avatar) => {
            const radius = avatar.isLocal ? 0.65 : 0.45;
            return (
              <g key={avatar.id}>
                <circle
                  cx={avatar.position.x}
                  cy={avatar.position.y}
                  r={radius}
                  fill={avatar.isLocal ? tokens.accent : roomColorFor(rooms, avatar.roomId, tokens.textSecondary)}
                  stroke={avatar.isLocal ? tokens.surface : tokens.surfaceAlpha}
                  strokeWidth={avatar.isLocal ? 0.2 : 0.1}
                  opacity={0.95}
                />
                {avatar.waypoint && (
                  <line
                    x1={avatar.position.x}
                    y1={avatar.position.y}
                    x2={avatar.waypoint.x}
                    y2={avatar.waypoint.y}
                    stroke={avatar.isLocal ? tokens.accent : tokens.textMuted}
                    strokeOpacity={avatar.isLocal ? 0.7 : 0.4}
                    strokeWidth={avatar.isLocal ? 0.25 : 0.18}
                    strokeDasharray={avatar.isLocal ? '1 0.6' : '0.4 0.6'}
                  />
                )}
                {avatar.waypoint && (
                  <circle
                    cx={avatar.waypoint.x}
                    cy={avatar.waypoint.y}
                    r={avatar.isLocal ? 0.55 : 0.4}
                    fill="none"
                    stroke={avatar.isLocal ? tokens.accent : tokens.textSecondary}
                    strokeWidth={avatar.isLocal ? 0.25 : 0.18}
                    strokeOpacity={avatar.isLocal ? 0.8 : 0.55}
                  />
                )}
              </g>
            );
          })}
        </svg>
        <div className="flex items-center justify-between px-3 py-2 text-[11px]" style={{ color: tokens.textSecondary }}>
          <span>Click to set a waypoint</span>
          <span className="text-[10px]" style={{ color: tokens.textMuted }}>
            Alt+Click to clear
          </span>
        </div>
      </div>
      <ul className="mt-3 space-y-2 px-4 pb-4">
        {summary.map(({ room, occupants, localInside }) => {
          const highlightColor = localInside ? tokens.accent : room.themeColor;
          const occupantNames = occupants.slice(0, MAX_NAME_TAGS);
          const overflow = occupants.length - occupantNames.length;
          return (
            <li
              key={room.id}
              className="cursor-pointer rounded-2xl border px-3 py-2 transition-colors"
              onClick={(event) => {
                if (!localAvatarId) return;
                if (event.altKey) {
                  markWaypoint(localAvatarId, null);
                  return;
                }
                const boundary = room.boundary;
                const target =
                  boundary.type === 'rect'
                    ? { x: boundary.center[0], y: boundary.center[1] }
                    : { x: boundary.center[0], y: boundary.center[1] };
                markWaypoint(localAvatarId, target);
              }}
              style={{
                borderColor: localInside ? tokens.accent : tokens.borderSoft,
                background: localInside ? tokens.accentSoft : tokens.surfaceAlt,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: highlightColor }}
                  />
                  <span className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
                    {room.name}
                  </span>
                </div>
                <span className="text-xs" style={{ color: tokens.textSecondary }}>
                  {occupants.length} inside
                </span>
              </div>
              {occupantNames.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  {occupantNames.map((avatar) => (
                    <span
                      key={avatar.id}
                      className="rounded-full px-2 py-0.5"
                      style={{
                        background: localInside ? tokens.surface : tokens.surfaceAlpha,
                        color: tokens.textSecondary,
                      }}
                    >
                      {avatar.displayName}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{ background: tokens.surfaceAlpha, color: tokens.textSecondary }}
                    >
                      +{overflow}
                    </span>
                  )}
                </div>
              )}
              {room.signage && (
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: tokens.textMuted }}>
                  {room.signage}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ThreeDMinimap;
