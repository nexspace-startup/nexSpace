import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Room, Participant } from "livekit-client";
import { RoomEvent, Track } from "livekit-client";
import { useWorkspaceStore } from "./workspaceStore";
import { api } from "../services/httpService";
import { toast } from "./toastStore";

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
  // whisper state
  whisperActive: boolean;
  whisperTargetSid: string | null;

  // chat state
  chatOpen: boolean;
  unreadCount: number;
  messages: ChatMessage[];

  // screen share state
  screenShareEnabled: boolean;
  // speaker playback toggle (mute all remote audio locally)
  speakerEnabled: boolean;

  // view mode for stage
  viewMode: 'grid' | '3d';
  setViewMode: (mode: 'grid' | '3d') => void;

  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  joinActiveWorkspace: () => Promise<void>;
  setRoom: (room: Room | null) => void;
  leave: () => void;
  // whisper controls
  startWhisper: (targetSid: string) => Promise<void>;
  stopWhisper: () => Promise<void>;

  // chat controls
  toggleChat: () => void;
  sendMessage: (text: string) => Promise<void>;
  retryMessage: (id: string) => Promise<void>;
  loadChatHistory: (limit?: number) => Promise<void>;
  // screen share control
  toggleScreenShare: () => Promise<void>;
  // speaker playback control
  toggleSpeaker: () => Promise<void>;
};

export type ChatMessage = {
  id: string;
  text: string;
  ts: number; // epoch ms
  senderSid: string;
  senderName: string;
  isLocal: boolean;
  // delivery status for UI: pending until server persists and echoes via LiveKit, success on echo, failed on API error
  status?: 'pending' | 'success' | 'failed';
};

/**
 * Given a LiveKit room, compute a list of MeetingAvatar objects representing
 * all participants in the room. Remote participants are included from
 * room.remoteParticipants; the local participant is from room.localParticipant.
 * The returned list includes the local participant.
 *
 * If room is null, an empty list is returned.
 */
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
    /**
     * Updates the store's micEnabled and camEnabled to match the current
     * state of the room's local participant.
     *
     * @param room - the LiveKit room to sync with
     */
    const syncAV = (room: Room | null) => {
      const lp = room?.localParticipant;
      set({
        micEnabled: !!lp?.isMicrophoneEnabled,
        camEnabled: !!lp?.isCameraEnabled,
      });
    };

    let detachEvents: (() => void) | null = null;
    // track if we temporarily enabled mic for whisper
    let revertMicOnWhisperStop = false;

    // helper to update statuses
    const markStatusesByIds = (ids: string[], status: 'pending' | 'success' | 'failed') =>
      set((s) => ({ messages: s.messages.map((m) => (ids.includes(m.id) ? { ...m, status } : m)) }));

    const attachRoomListeners = (room: Room | null) => {
      detachEvents?.();
      detachEvents = null;
      if (!room) return;

      const updateParticipants = () => set({ participants: computeParticipants(room) });

      const syncScreen = () => {
        try {
          const lp: any = room.localParticipant as any;
          const pubs: any[] = lp?.getTrackPublications?.() ?? Array.from(lp?.trackPublications?.values?.() ?? []);
          const hasShare = pubs?.some((pub: any) => (pub?.source === Track.Source.ScreenShare) && pub?.track);
          set({ screenShareEnabled: !!hasShare });
        } catch { /* ignore */ }
      };

      // initial seed: participants + A/V + screenshare
      updateParticipants();
      syncAV(room);
      syncScreen();

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
        syncScreen();
      };

      // helper: (un)subscribe from a sender's audio on THIS client
      const setHearSender = (senderSid: string, shouldHear: boolean) => {
        try {
          const remotes = Array.from(room.remoteParticipants?.values?.() ?? []);
          const rp = remotes.find((p: any) => (p?.sid ?? p?.identity) === senderSid);
          if (!rp) return;
          const pubs: any[] = (rp as any).getTrackPublications?.() ?? Array.from((rp as any).trackPublications?.values?.() ?? []);
          pubs
            .filter((pub: any) => pub?.kind === 'audio' || pub?.source === Track.Source.Microphone)
            .forEach((pub: any) => {
              try { pub.setSubscribed?.(!!shouldHear); } catch { }
            });
        } catch { }
      };

      /**
       * Process incoming data from other clients in the room. Currently only
       * processes 'whisper' messages, which are used to control whether the local
       * user can hear the audio of another user in the room.
       *
       * The message format is a JSON object with the following fields:
       *
       * - `type`: should be 'whisper'
       * - `action`: one of 'start' or 'stop'
       * - `originSid`: the sid of the user that sent the message
       * - `targetSid`: the sid of the user that is the target of the action
       *
       * If the action is 'start', the local user will be subscribed to the sender's
       * audio if and only if the targetSid matches the local user's sid. If the
       * action is 'stop', the local user will be unsubscribed from the sender's
       * audio.
       */
      const onData = (
        payload: Uint8Array,
        _participant?: Participant,
        _kind?: any,
        topic?: string
      ) => {
        try {
          const text = typeof (payload as any) === 'string' ? (payload as any) : new TextDecoder().decode(payload);
          const msg = JSON.parse(text);
          if (!msg) return;
          const localSid = (room.localParticipant as any)?.sid ?? room.localParticipant.identity;

          // Handle whisper messages (topic may be undefined in older SDKs)
          if ((topic === undefined || topic === 'whisper') && msg.type === 'whisper') {
            const senderSid: string | undefined = msg.originSid;
            if (!senderSid) return;
            if (msg.action === 'start') {
              const targetSid: string | undefined = msg.targetSid;
              const shouldHear = !!targetSid && targetSid === localSid;
              setHearSender(senderSid, shouldHear);
            } else if (msg.action === 'stop') {
              setHearSender(senderSid, true);
            }
            return;
          }

          // Handle chat messages (authoritative echo from server)
          if ((topic === undefined || topic === 'chat') && msg.type === 'chat') {
            const senderSid: string = msg.senderSid ?? _participant?.identity ?? 'unknown';
            let senderName: string | undefined = typeof msg.senderName === 'string' ? msg.senderName : undefined; if (!senderName || !String(senderName).trim()) { try { const lp: any = room.localParticipant as any; if (String(lp?.identity) === String(senderSid)) { senderName = (lp?.name ?? lp?.identity) as string; } else { const remotes: any[] = Array.from((room as any).remoteParticipants?.values?.() ?? []); const rp = remotes.find((p: any) => String(p?.identity) === String(senderSid)); senderName = (rp?.name ?? rp?.identity) as string | undefined; } } catch { } } if (!senderName || !String(senderName).trim()) senderName = String(senderSid || 'User');
            const id: string = msg.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const text: string = String(msg.text ?? '');
            if (!text) return;
            const isLocal = senderSid === localSid;

            set((s) => {
              const idx = s.messages.findIndex((m) => m.id === id);
              const now = Date.now();
              if (idx >= 0) {
                // update existing (likely pending local), mark delivered
                const prev = s.messages[idx];
                const updated: ChatMessage = {
                  ...prev,
                  text,
                  senderSid,
                  senderName,
                  ts: now,
                  status: 'success',
                };
                const arr = s.messages.slice();
                arr[idx] = updated;
                return {
                  messages: arr,
                  unreadCount: s.chatOpen || prev.isLocal ? s.unreadCount : s.unreadCount + 1,
                };
              }
              // not found locally: append as new
              return {
                messages: [
                  ...s.messages,
                  { id, text, ts: now, senderSid, senderName, isLocal: isLocal, status: 'success' },
                ],
                unreadCount: s.chatOpen || isLocal ? s.unreadCount : s.unreadCount + 1,
              };
            });
            return;
          }
        } catch { /* ignore */ }
      };

      const onParticipantConnected = (p: Participant) => {
        // keep participants and A/V in sync
        updateParticipants();
        // If this local user is currently whispering, rebroadcast start to the newcomer only
        try {
          const { whisperActive, whisperTargetSid } = get();
          if (!whisperActive || !whisperTargetSid) return;
          const lp: any = room.localParticipant as any;
          const originSid = (lp?.sid ?? lp?.identity) as string;
          const payload = JSON.stringify({ type: 'whisper', action: 'start', originSid, targetSid: whisperTargetSid });
          const bytes = new TextEncoder().encode(payload);
          const destSid = (p as any)?.sid ?? p.identity;
          room.localParticipant.publishData(bytes, { reliable: true, topic: 'whisper', destinationSids: [destSid] } as any);
        } catch {/* ignore */ }
      };

      const onParticipantDisconnected = (p: Participant) => {
        updateParticipants();
        try {
          const { whisperActive, whisperTargetSid } = get();
          const leftSid = (p as any)?.sid ?? p.identity;
          if (whisperActive && whisperTargetSid && leftSid === whisperTargetSid) {
            get().stopWhisper?.();
          }
        } catch { /* ignore */ }
      };

      room
        .on?.(RoomEvent.ParticipantConnected, onParticipantConnected)
        .on?.(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
        .on?.(RoomEvent.TrackSubscribed, onAnyTrackChange)
        .on?.(RoomEvent.TrackUnsubscribed, onAnyTrackChange)
        .on?.(RoomEvent.TrackMuted, onAnyTrackChange as any)
        .on?.(RoomEvent.TrackUnmuted, onAnyTrackChange as any)
        .on?.(RoomEvent.LocalTrackPublished, onAnyTrackChange as any)
        .on?.(RoomEvent.LocalTrackUnpublished, onAnyTrackChange as any)
        .on?.(RoomEvent.ConnectionStateChanged, onConn)
        .on?.(RoomEvent.DataReceived as any, onData as any);

      detachEvents = () => {
        clearTimeout(t1);
        clearTimeout(t2);
        room
          .off?.(RoomEvent.ParticipantConnected, onParticipantConnected)
          .off?.(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
          .off?.(RoomEvent.TrackSubscribed, onAnyTrackChange)
          .off?.(RoomEvent.TrackUnsubscribed, onAnyTrackChange)
          .off?.(RoomEvent.TrackMuted, onAnyTrackChange as any)
          .off?.(RoomEvent.TrackUnmuted, onAnyTrackChange as any)
          .off?.(RoomEvent.LocalTrackPublished, onAnyTrackChange as any)
          .off?.(RoomEvent.LocalTrackUnpublished, onAnyTrackChange as any)
          .off?.(RoomEvent.ConnectionStateChanged, onConn)
          .off?.(RoomEvent.DataReceived as any, onData as any);
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
      whisperActive: false,
      whisperTargetSid: null,
      screenShareEnabled: false,
      speakerEnabled: true,
      chatOpen: false,
      unreadCount: 0,
      messages: [],
      viewMode: 'grid',

      setRoom: (room) => {
        set({
          room,
          connected: !!room,
          startedAt: room ? Date.now() : null,
        });
        syncAV(room);
        attachRoomListeners(room);
        // load recent chat when connected
        if (room) {
          try { get().loadChatHistory?.(100); } catch { }
        }
      },

      setViewMode: (mode: 'grid' | '3d') => set({ viewMode: mode }),

      toggleMic: async () => {
        const room = get().room;
        if (!room) return;
        const next = !get().micEnabled;
        try {
          await room.localParticipant.setMicrophoneEnabled(next);
          set({ micEnabled: !!room.localParticipant.isMicrophoneEnabled });
        } catch {/* noop */ }
      },

      toggleCam: async () => {
        const room = get().room;
        if (!room) return;
        const next = !get().camEnabled;
        try {
          await room.localParticipant.setCameraEnabled(next);
          set({ camEnabled: !!room.localParticipant.isCameraEnabled });
        } catch {/* noop */ }
      },

      leave: () => {
        try { get().room?.disconnect(); } catch { }
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
          whisperActive: false,
          whisperTargetSid: null,
          chatOpen: false,
          unreadCount: 0,
          messages: [],
          screenShareEnabled: false,
          speakerEnabled: true,
        });
      },

      startWhisper: async (targetSid: string) => {
        const room = get().room;
        if (!room) return;
        const lp: any = room.localParticipant as any;
        // ensure mic is on; if not, enable and remember to revert
        revertMicOnWhisperStop = false;
        try {
          if (!lp?.isMicrophoneEnabled) {
            await room.localParticipant.setMicrophoneEnabled(true);
            revertMicOnWhisperStop = true;
            set({ micEnabled: !!room.localParticipant.isMicrophoneEnabled });
          }
        } catch { }

        // broadcast start
        try {
          const originSid = (lp?.sid ?? lp?.identity) as string;
          const payload = JSON.stringify({ type: 'whisper', action: 'start', originSid, targetSid });
          const bytes = new TextEncoder().encode(payload);
          await room.localParticipant.publishData(bytes, { reliable: true, topic: 'whisper' } as any);
        } catch { }

        set({ whisperActive: true, whisperTargetSid: targetSid });
      },

      stopWhisper: async () => {
        const room = get().room;
        if (!room) return;
        const lp: any = room.localParticipant as any;
        // broadcast stop
        try {
          const originSid = (lp?.sid ?? lp?.identity) as string;
          const payload = JSON.stringify({ type: 'whisper', action: 'stop', originSid });
          const bytes = new TextEncoder().encode(payload);
          await room.localParticipant.publishData(bytes, { reliable: true, topic: 'whisper' } as any);
        } catch { }

        if (revertMicOnWhisperStop) {
          try {
            await room.localParticipant.setMicrophoneEnabled(false);
            set({ micEnabled: !!room.localParticipant.isMicrophoneEnabled });
          } catch { }
        }
        revertMicOnWhisperStop = false;
        set({ whisperActive: false, whisperTargetSid: null });
      },

      joinActiveWorkspace: async () => {
        const { activeWorkspaceId } = useWorkspaceStore.getState();
        if (!activeWorkspaceId) {
          set({ error: "Select a workspace first." });
          toast.warning("Select a workspace first");
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
            toast.error((data as any)?.errors?.[0]?.message ?? "Unable to join meeting");
          }
        } catch (e: any) {
          set({
            joining: false,
            connected: false,
            error: e?.message ?? "Network error while joining",
          });
          toast.error(e?.message ?? "Network error while joining");
        }
      },

      toggleChat: () => {
        set((s) => ({ chatOpen: !s.chatOpen, unreadCount: !s.chatOpen ? 0 : s.unreadCount }));
      },

      sendMessage: async (text: string) => {
        const room = get().room;
        if (!room) return;
        const clean = text.trim();
        if (!clean) return;
        const lp: any = room.localParticipant as any;
        const senderSid = (lp?.sid ?? lp?.identity) as string;
        const senderName = (lp?.name ?? lp?.identity) as string;

        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();
        // optimistic local append (pending)
        set((s) => ({
          messages: [
            ...s.messages,
            { id, text: clean, ts: now, senderSid, senderName, isLocal: true, status: 'pending' },
          ],
        }));

        // Single message POST to server which persists and broadcasts to LiveKit
        try {
          const { activeWorkspaceId } = useWorkspaceStore.getState();
          if (!activeWorkspaceId) {
            markStatusesByIds([id], 'failed');
            return;
          }
          await api.post(`/workspace/${activeWorkspaceId}/chat/messages`, { text: clean, id }, { withCredentials: true });
          // Mark success on API success; LiveKit echo will also upsert/confirm
          markStatusesByIds([id], 'success');
        } catch {
          markStatusesByIds([id], 'failed');
          toast.error('Failed to send message');
        }
      },

      retryMessage: async (id: string) => {
        const msg = get().messages.find((m) => m.id === id);
        if (!msg) return;
        markStatusesByIds([id], 'pending');
        try {
          const { activeWorkspaceId } = useWorkspaceStore.getState();
          if (!activeWorkspaceId) { markStatusesByIds([id], 'failed'); return; }
          await api.post(`/workspace/${activeWorkspaceId}/chat/messages`, { text: msg.text, id }, { withCredentials: true });
          markStatusesByIds([id], 'success');
        } catch {
          markStatusesByIds([id], 'failed');
        }
      },

      loadChatHistory: async (limit = 100) => {
        try {
          const { activeWorkspaceId } = useWorkspaceStore.getState();
          if (!activeWorkspaceId) return;
          const { data } = await api.get(`/workspace/${activeWorkspaceId}/chat/messages`, {
            params: { limit },
            withCredentials: true,
          });
          if ((data as any)?.success && Array.isArray((data as any).data)) {
            const items: Array<{ id: string; text: string; ts: string; sender: { id: string; name: string } }> = (data as any).data;
            // Determine current user id from LiveKit identity (not SID)
            let currentId: string | undefined;
            try {
              const room = get().room as any;
              currentId = room?.localParticipant?.identity as string | undefined;
            } catch { }
            set((s) => ({
              messages: items.map((m) => ({
                id: m.id,
                text: m.text,
                ts: new Date(m.ts).getTime(),
                senderSid: m.sender.id,
                senderName: m.sender.name,
                isLocal: currentId ? String(m.sender.id) === String(currentId) : false,
                status: 'success',
              })),
              unreadCount: s.chatOpen ? 0 : s.unreadCount,
            }));
          }
        } catch {/* ignore */ }
      },

      toggleScreenShare: async () => {
        const room = get().room;
        if (!room) return;
        try {
          const next = !get().screenShareEnabled;
          const fn = (room.localParticipant as any).setScreenShareEnabled;
          if (typeof fn === 'function') {
            await fn.call(room.localParticipant, next);
          }
          // Re-sync from actual publications to reflect success/failure accurately
          try {
            const lp: any = room.localParticipant as any;
            const pubs: any[] = lp?.getTrackPublications?.() ?? Array.from(lp?.trackPublications?.values?.() ?? []);
            const hasShare = pubs?.some((pub: any) => (pub?.source === Track.Source.ScreenShare) && pub?.track);
            set({ screenShareEnabled: !!hasShare });
          } catch { /* ignore */ }
        } catch {/* ignore */ }
      },

      toggleSpeaker: async () => {
        const room = get().room;
        if (!room) return;
        try {
          const next = !get().speakerEnabled;
          const remotes = Array.from(room.remoteParticipants?.values?.() ?? []);
          for (const rp of remotes) {
            try {
              const pubs: any[] = (rp as any).getTrackPublications?.() ?? Array.from((rp as any).trackPublications?.values?.() ?? []);
              for (const pub of pubs) {
                const isAudio = pub?.kind === 'audio' || pub?.source === Track.Source.Microphone;
                if (isAudio) {
                  try { await pub.setSubscribed?.(next); } catch { /* ignore */ }
                }
              }
            } catch { /* ignore */ }
          }
          set({ speakerEnabled: next });
        } catch { /* ignore */ }
      },
    };
  })
);
