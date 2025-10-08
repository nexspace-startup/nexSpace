import React from 'react';
import type { RoomId } from '../rooms/types';

export type MinimapRoomSummary = {
  id: RoomId;
  title: string;
  label: string;
  description?: string;
  accentColor: string;
  occupancy: number;
  connections: string[];
};

type MinimapOverlayProps = {
  containerStyle: React.CSSProperties;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  size: number;
  rooms: MinimapRoomSummary[];
  currentRoomId: RoomId | null;
  suggestedRoomId?: RoomId | null;
  onJump: (roomId: RoomId) => void;
};

const MinimapOverlay: React.FC<MinimapOverlayProps> = ({
  containerStyle,
  canvasRef,
  size,
  rooms,
  currentRoomId,
  suggestedRoomId,
  onJump,
}) => {
  if (!rooms.length) {
    return (
      <div className="absolute" style={containerStyle}>
        <div
          className="pointer-events-none flex items-center justify-center rounded-2xl border"
          style={{
            width: size,
            height: size,
            borderColor: 'var(--panel-border)',
            background: 'var(--surface-1)',
            color: 'var(--text-3, #9ca3af)',
          }}
        >
          Loading map…
        </div>
      </div>
    );
  }

  return (
    <div className="absolute flex flex-col gap-3 pointer-events-none" style={containerStyle}>
      <div
        className="pointer-events-auto overflow-hidden rounded-2xl border"
        style={{
          width: size,
          borderColor: 'var(--minimap-border, var(--panel-border))',
          background: 'var(--minimap-bg, var(--surface-1))',
          boxShadow: '0 18px 42px rgba(0,0,0,0.3)',
        }}
      >
        <canvas ref={canvasRef} width={size} height={size} className="block h-full w-full" />
      </div>
      <div
        className="pointer-events-auto w-full rounded-2xl border px-4 py-3 text-xs shadow-xl"
        style={{
          borderColor: 'var(--minimap-border, var(--panel-border))',
          background: 'var(--minimap-bg, var(--surface-1))',
          color: 'var(--text-2, #d1d5db)',
          backdropFilter: 'blur(14px)',
          opacity: 0.96,
        }}
      >
        <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.14em] text-[color:var(--text-3,#9ca3af)]">
          <span>Rooms</span>
          <span className="text-[color:var(--text-4,#6b7280)]">Jump</span>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {rooms.map((room) => {
            const active = room.id === currentRoomId;
            const suggested = !!suggestedRoomId && room.id === suggestedRoomId;
            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => onJump(room.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    borderColor: active || suggested ? room.accentColor : 'var(--minimap-border, var(--panel-border))',
                    background: active
                      ? 'var(--minimap-active-bg, rgba(255,255,255,0.08))'
                      : suggested
                        ? 'var(--minimap-suggested-bg, rgba(255,255,255,0.04))'
                        : 'transparent',
                    color: 'var(--text-1, #f1f5f9)',
                    boxShadow: active ? `0 0 0 1px ${room.accentColor}` : undefined,
                  }}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ background: room.accentColor }}
                      />
                      <span className="truncate text-[13px] font-semibold leading-tight">{room.title}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-[color:var(--text-3,#9ca3af)]">
                      <span>{room.occupancy} {room.occupancy === 1 ? 'person' : 'people'}</span>
                      {room.connections.length > 0 && (
                        <span className="hidden min-[420px]:inline" aria-hidden>
                          • {room.connections.join(', ')}
                        </span>
                      )}
                      {suggested && (
                        <span className="ml-1 rounded-full border border-[color:var(--panel-border)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em]">Portal</span>
                      )}
                    </div>
                    {room.description ? (
                      <p className="truncate text-[11px] text-[color:var(--text-4,#6b7280)]">{room.description}</p>
                    ) : null}
                  </div>
                  <span
                    aria-hidden
                    className="text-[11px] font-semibold tracking-wide text-[color:var(--text-3,#9ca3af)]"
                  >
                    Go
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default MinimapOverlay;
