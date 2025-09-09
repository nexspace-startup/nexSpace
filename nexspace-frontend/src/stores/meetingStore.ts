import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Room, Participant } from "livekit-client";
import { RoomEvent } from "livekit-client";
import { useWorkspaceStore } from "./workspaceStore";
import { api } from "../services/httpService";

type JoinResponse =
  | { success: true; data: { url: string; token: string } }
  | { success: false; errors: Array<{ message: string }> };

export type MeetingAvatar = { id: string; name?: string };

export type MeetingState = {          // 👈 export the type so consumers can annotate selectors
  joining: boolean;
  connected: boolean;
  error: string | null;

  url: string | null;
  token: string | null;
  room: Room | null;

  participants: MeetingAvatar[];

  startedAt: number | null;
  micEnabled: boolean;
  camEnabled: boolean;

  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  joinActiveWorkspace: () => Promise<void>;
  setRoom: (room: Room | null) => void;
  leave: () => void;
};

function computeParticipants(room: Room | null) {
  if (!room) return [];
  const remote = Array.from(room.remoteParticipants?.values?.() ?? []);
  const list: Participant[] = [room.localParticipant, ...remote].filter(Boolean) as Participant[];
  return list.map((p) => ({
    id: (p as any)?.sid ?? p.identity,
    name: (p as any)?.name ?? p.identity,
  }));
}

export const useMeetingStore = create<MeetingState>()(
  devtools((set, get) => {
    const syncAV = (room: Room | null) => {
      const lp = room?.localParticipant;
      set({
        micEnabled: !!lp?.isMicrophoneEnabled,
        camEnabled: !!lp?.isCameraEnabled,
      });
    };

    let detachEvents: (() => void) | null = null;

    const attachRoomListeners = (room: Room | null) => {
      detachEvents?.();
      detachEvents = null;
      if (!room) return;

      const updateParticipants = () => set({ participants: computeParticipants(room) });

      // initial seed + A/V sync
      updateParticipants();
      syncAV(room);

      // settle device state shortly after connect
      const t1 = setTimeout(() => syncAV(room), 250);
      const t2 = setTimeout(() => syncAV(room), 1200);

      const onConn = () => {
        updateParticipants();
        syncAV(room);
      };
      const onAnyTrackChange = () => {
        updateParticipants();
        syncAV(room);
      };

      room
        .on?.(RoomEvent.ParticipantConnected, updateParticipants)
        .on?.(RoomEvent.ParticipantDisconnected, updateParticipants)
        .on?.(RoomEvent.TrackSubscribed, onAnyTrackChange)
        .on?.(RoomEvent.TrackUnsubscribed, onAnyTrackChange)
        .on?.(RoomEvent.TrackMuted, onAnyTrackChange as any)
        .on?.(RoomEvent.TrackUnmuted, onAnyTrackChange as any)
        .on?.(RoomEvent.LocalTrackPublished, onAnyTrackChange as any)
        .on?.(RoomEvent.LocalTrackUnpublished, onAnyTrackChange as any)
        .on?.(RoomEvent.ConnectionStateChanged, onConn);

      detachEvents = () => {
        clearTimeout(t1);
        clearTimeout(t2);
        room
          .off?.(RoomEvent.ParticipantConnected, updateParticipants)
          .off?.(RoomEvent.ParticipantDisconnected, updateParticipants)
          .off?.(RoomEvent.TrackSubscribed, onAnyTrackChange)
          .off?.(RoomEvent.TrackUnsubscribed, onAnyTrackChange)
          .off?.(RoomEvent.TrackMuted, onAnyTrackChange as any)
          .off?.(RoomEvent.TrackUnmuted, onAnyTrackChange as any)
          .off?.(RoomEvent.LocalTrackPublished, onAnyTrackChange as any)
          .off?.(RoomEvent.LocalTrackUnpublished, onAnyTrackChange as any)
          .off?.(RoomEvent.ConnectionStateChanged, onConn);
      };
    };

    return {
      joining: false,
      connected: false,
      error: null,
      url: null,
      token: null,
      room: null,
      participants: [],
      startedAt: null,
      micEnabled: true,
      camEnabled: true,

      setRoom: (room) => {
        set({
          room,
          connected: !!room,
          startedAt: room ? Date.now() : null,
        });
        syncAV(room);
        attachRoomListeners(room);
      },

      toggleMic: async () => {
        const room = get().room;
        if (!room) return;
        const next = !get().micEnabled;
        try {
          await room.localParticipant.setMicrophoneEnabled(next);
          set({ micEnabled: !!room.localParticipant.isMicrophoneEnabled });
        } catch {/* noop */}
      },

      toggleCam: async () => {
        const room = get().room;
        if (!room) return;
        const next = !get().camEnabled;
        try {
          await room.localParticipant.setCameraEnabled(next);
          set({ camEnabled: !!room.localParticipant.isCameraEnabled });
        } catch {/* noop */}
      },

      leave: () => {
        try { get().room?.disconnect(); } catch {}
        detachEvents?.();
        detachEvents = null;
        set({
          connected: false,
          url: null,
          token: null,
          room: null,
          participants: [],
          startedAt: null,
          micEnabled: true,
          camEnabled: true,
        });
      },

      joinActiveWorkspace: async () => {
        const { activeWorkspaceId } = useWorkspaceStore.getState();
        if (!activeWorkspaceId) {
          set({ error: "Select a workspace first." });
          return;
        }
        if (get().joining) return;

        set({ joining: true, error: null });

        try {
          const { data } = await api.post<JoinResponse>(
            `/workspace/${activeWorkspaceId}/meeting/join`,
            {},
            { withCredentials: true }
          );

          if ("success" in data && data.success) {
            const { url, token } = data.data;
            // expose creds; connection is handled by <LiveKitRoom connect />
            set({ url, token, joining: false, error: null });
          } else {
            set({
              joining: false,
              connected: false,
              error: (data as any)?.errors?.[0]?.message ?? "Unable to join meeting",
            });
          }
        } catch (e: any) {
          set({
            joining: false,
            connected: false,
            error: e?.message ?? "Network error while joining",
          });
        }
      },
    };
  })
);
