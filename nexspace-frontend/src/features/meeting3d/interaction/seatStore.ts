import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { RoomId } from '../rooms/types';

type SeatClaimRecord = {
  occupantId: string;
  occupantName?: string;
  roomId?: RoomId | null;
  ts: number;
};

export type SeatClaimUpdate = {
  seatIndex: number | null;
  occupantId: string;
  occupantName?: string;
  roomId?: RoomId | null;
  ts: number;
};

type SeatInteractionState = {
  seats: Record<number, SeatClaimRecord>;
  occupantToSeat: Record<string, number>;
  version: number;
  pendingSeatIndex: number | null;
  claimSeat: (seatIndex: number, occupantId: string, occupantName?: string, roomId?: RoomId | null) => SeatClaimUpdate | null;
  releaseSeat: (occupantId: string) => SeatClaimUpdate | null;
  applyRemoteEvent: (event: SeatClaimUpdate) => void;
  pruneOccupants: (validOccupantIds: string[]) => void;
  validateSeatIndices: (seatCapacity: number) => void;
  setPendingSeat: (seatIndex: number | null) => void;
};

const makeStore = () =>
  create<SeatInteractionState>()(
    devtools(
      (set, get) => ({
        seats: {},
        occupantToSeat: {},
        version: 0,
        pendingSeatIndex: null,
        claimSeat: (seatIndex, occupantId, occupantName, roomId) => {
          if (seatIndex < 0 || !Number.isFinite(seatIndex)) {
            return null;
          }
          if (!occupantId) return null;

          const state = get();
          const taken = state.seats[seatIndex];
          if (taken && taken.occupantId !== occupantId) {
            return null;
          }

          const seats = { ...state.seats };
          const occupantToSeat = { ...state.occupantToSeat };
          const ts = Date.now();

          const prevSeat = occupantToSeat[occupantId];
          if (prevSeat != null && seats[prevSeat]?.occupantId === occupantId) {
            delete seats[prevSeat];
          }

          occupantToSeat[occupantId] = seatIndex;
          seats[seatIndex] = { occupantId, occupantName, roomId, ts };

          set({ seats, occupantToSeat, version: state.version + 1, pendingSeatIndex: null });

          return { seatIndex, occupantId, occupantName, roomId, ts };
        },
        releaseSeat: (occupantId) => {
          if (!occupantId) return null;
          const state = get();
          const prevSeat = state.occupantToSeat[occupantId];
          if (prevSeat == null) return null;

          const seats = { ...state.seats };
          delete seats[prevSeat];

          const occupantToSeat = { ...state.occupantToSeat };
          delete occupantToSeat[occupantId];

          const ts = Date.now();
          set({ seats, occupantToSeat, version: state.version + 1, pendingSeatIndex: null });

          return { seatIndex: null, occupantId, occupantName: state.seats[prevSeat]?.occupantName, roomId: null, ts };
        },
        applyRemoteEvent: (event) => {
          if (!event?.occupantId) return;
          const state = get();
          const seats = { ...state.seats };
          const occupantToSeat = { ...state.occupantToSeat };

          if (event.seatIndex == null) {
            const prevSeat = occupantToSeat[event.occupantId];
            if (prevSeat != null) {
              delete seats[prevSeat];
            }
            delete occupantToSeat[event.occupantId];
          } else {
            const prevSeat = occupantToSeat[event.occupantId];
            if (prevSeat != null && prevSeat !== event.seatIndex) {
              delete seats[prevSeat];
            }
            const seatExisting = seats[event.seatIndex];
            if (seatExisting && seatExisting.occupantId !== event.occupantId) {
              // Respect the latest timestamp
              if (seatExisting.ts > (event.ts ?? 0)) {
                set({ seats, occupantToSeat, pendingSeatIndex: null });
                return;
              }
            }
            occupantToSeat[event.occupantId] = event.seatIndex;
            seats[event.seatIndex] = {
              occupantId: event.occupantId,
              occupantName: event.occupantName,
              roomId: event.roomId,
              ts: event.ts ?? Date.now(),
            };
          }

          set({ seats, occupantToSeat, version: state.version + 1, pendingSeatIndex: null });
        },
        pruneOccupants: (validOccupantIds) => {
          const valid = new Set(validOccupantIds.map((id) => String(id ?? '')));
          set((state) => {
            const seats = { ...state.seats };
            const occupantToSeat = { ...state.occupantToSeat };
            let changed = false;
            for (const [occupantId, seatIdx] of Object.entries(state.occupantToSeat)) {
              if (!valid.has(occupantId)) {
                if (seatIdx != null && seats[seatIdx]?.occupantId === occupantId) {
                  delete seats[seatIdx];
                }
                delete occupantToSeat[occupantId];
                changed = true;
              }
            }
            if (!changed) return { pendingSeatIndex: state.pendingSeatIndex };
            return { seats, occupantToSeat, version: state.version + 1, pendingSeatIndex: state.pendingSeatIndex };
          });
        },
        validateSeatIndices: (seatCapacity) => {
          if (!Number.isFinite(seatCapacity) || seatCapacity <= 0) return;
          set((state) => {
            const seats = { ...state.seats };
            const occupantToSeat = { ...state.occupantToSeat };
            let changed = false;
            for (const [idxStr, record] of Object.entries(seats)) {
              const idx = Number(idxStr);
              if (!Number.isFinite(idx) || idx < 0 || idx >= seatCapacity) {
                changed = true;
                const occupantId = record.occupantId;
                delete seats[idx];
                if (occupantId) {
                  delete occupantToSeat[occupantId];
                }
              }
            }
            if (!changed) return { pendingSeatIndex: state.pendingSeatIndex };
            return { seats, occupantToSeat, version: state.version + 1, pendingSeatIndex: state.pendingSeatIndex };
          });
        },
        setPendingSeat: (seatIndex) => {
          set({ pendingSeatIndex: seatIndex });
        },
      }),
      { name: 'meeting3d-seat-store' },
    ),
  );

export const useSeatInteractionStore = makeStore();
