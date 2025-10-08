import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { Room, Participant } from "livekit-client";
import { RoomEvent, Track } from "livekit-client";
import { useWorkspaceStore } from "./workspaceStore";
import { useUserStore } from "./userStore";
import { api } from "../services/httpService";
import { toast } from "./toastStore";
import { PresenceStatusConstants, type PresenceStatus } from "../constants/enums";

// ============================================================================
// Types
// ============================================================================

type JoinResponse =
  | { success: true; data: { url: string; token: string } }
  | { success: false; errors: Array<{ message: string }> };

export type MeetingAvatar = {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
  status?: PresenceStatus;
};

export type ChatMessage = {
  id: string;
  text: string;
  ts: number;
  senderSid: string;
  senderName: string;
  recipientSid?: string;
  isLocal: boolean;
  status?: 'pending' | 'success' | 'failed';
  messageType: 'group' | 'dm';
  dmPeerId?: string;
};

export type DMThreadPreview = {
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  text?: string;
  ts?: number;
  unread: number;
};

type PresenceRecord = { status: PresenceStatus; ts: number };

export type MeetingState = {
  // Connection state
  joining: boolean;
  connected: boolean;
  error: string | null;
  url: string | null;
  token: string | null;
  room: Room | null;
  startedAt: number | null;

  // Participants & presence
  participants: MeetingAvatar[];
  presenceById: Record<string, PresenceRecord>;
  localPresence: PresenceStatus;
  avatarById: Record<string, string | undefined>;

  // Media controls
  micEnabled: boolean;
  camEnabled: boolean;
  screenShareEnabled: boolean;
  speakerEnabled: boolean;

  // Whisper state
  whisperActive: boolean;
  whisperTargetSid: string | null;

  // Chat state
  chatOpen: boolean;
  unreadCount: number;
  messages: ChatMessage[];
  activeDMPeer: string | null;
  dmThreads?: DMThreadPreview[];

  // View mode
  viewMode: 'grid' | '3d';

  // Actions
  setViewMode: (mode: 'grid' | '3d') => void;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  joinActiveWorkspace: () => Promise<void>;
  setRoom: (room: Room | null) => void;
  leave: () => void;
  startWhisper: (targetSid: string) => Promise<void>;
  stopWhisper: () => Promise<void>;
  toggleChat: () => void;
  sendMessage: (text: string, toIdentity?: string | null) => Promise<void>;
  retryMessage: (id: string) => Promise<void>;
  loadChatHistory: (limit?: number, peerIdentity?: string | null) => Promise<void>;
  loadDMThreads: () => Promise<void>;
  markDMRead: (peerIdentity: string) => Promise<void>;
  setActiveDMPeer: (peerId: string | null) => void;
  getGroupMessages: () => ChatMessage[];
  getDMMessages: (peerId: string) => ChatMessage[];
  getUnreadGroupCount: () => number;
  getUnreadDMCount: (peerId?: string) => number;
  getPresenceFor: (id?: string) => PresenceStatus;
  setLocalPresence: (status: PresenceStatus) => Promise<void>;
  getAvatarFor: (id?: string) => string | undefined;
};

// ============================================================================
// Helper Functions
// ============================================================================

const PRESENCE_STATUS_KEY = "presence_status";
const PRESENCE_TS_KEY = "presence_ts";
const VALID_PRESENCE_STATUSES = new Set<PresenceStatus>(Object.values(PresenceStatusConstants));
const VIEW_MODE_STORAGE_KEY = 'meeting:viewMode';

const normalizePresenceStatus = (value?: unknown): PresenceStatus | null => {
  if (typeof value !== "string") return null;
  const normalized = value.toUpperCase() as PresenceStatus;
  return VALID_PRESENCE_STATUSES.has(normalized) ? normalized : null;
};

const parsePresenceRecord = (
  participant: any,
  metadata?: { presence?: { status?: string; ts?: unknown } }
): PresenceRecord | null => {
  if (!participant) return null;
  const attrs = (participant as any)?.attributes as Record<string, string> | undefined;
  const statusValue =
    attrs?.[PRESENCE_STATUS_KEY] ??
    attrs?.["presence.status"] ??
    metadata?.presence?.status;

  const status = normalizePresenceStatus(statusValue);
  if (!status) return null;

  const tsValue =
    attrs?.[PRESENCE_TS_KEY] ??
    attrs?.["presence.ts"] ??
    metadata?.presence?.ts;

  const tsNumber =
    typeof tsValue === "number"
      ? tsValue
      : Number.parseInt(typeof tsValue === "string" ? tsValue : "", 10);

  const ts = Number.isFinite(tsNumber) ? tsNumber : Date.now();
  return { status, ts };
};

const computeParticipants = (room: Room | null): MeetingAvatar[] => {
  if (!room) return [];

  const remote = Array.from(room.remoteParticipants?.values?.() ?? []);
  const list = [room.localParticipant, ...remote].filter(Boolean) as Participant[];
  return list.map((p) => {
    const json = parseParticipantMetadata((p as any)?.metadata);
    const presence = parsePresenceRecord(p, json ?? undefined);
    const avatarUrl = json?.profile?.avatar;
    const email = json?.profile?.email;
    return {
      id: (p as any)?.sid ?? p.identity,
      name: (p as any)?.name ?? p.identity,
      email: email,
      avatar: avatarUrl,
      status: presence?.status,
    };
  })
};

const getDMPeerForMessage = (
  message: { senderSid: string; recipientSid?: string },
  currentUserId: string
): string | undefined => {
  if (!message.recipientSid) return undefined;
  return message.senderSid === currentUserId
    ? message.recipientSid
    : message.senderSid;
};

const parseParticipantMetadata = (md?: string) => {
  if (!md) return null;
  try {
    return JSON.parse(md);
  } catch {
    return null;
  }
};

const getParticipantId = (p: any): string => p?.sid ?? p?.identity ?? '';

const getParticipantName = (p: any): string => p?.name ?? p?.identity ?? '';

// ============================================================================
// Store Implementation
// ============================================================================

export const useMeetingStore = create<MeetingState>()(
  devtools((set, get) => {
    let detachEvents: (() => void) | null = null;
    let revertMicOnWhisperStop = false;

    // ------------------------------------------------------------------------
    // Sync Helpers
    // ------------------------------------------------------------------------

    const syncAV = (room: Room | null) => {
      const lp = room?.localParticipant;
      set({
        micEnabled: !!lp?.isMicrophoneEnabled,
        camEnabled: !!lp?.isCameraEnabled,
      });
    };

    const syncScreenShare = (room: Room) => {
      try {
        const lp: any = room.localParticipant;
        const pubs = lp?.getTrackPublications?.() ?? Array.from(lp?.trackPublications?.values?.() ?? []);
        const hasShare = pubs.some((pub: any) =>
          pub?.source === Track.Source.ScreenShare && pub?.track
        );
        set({ screenShareEnabled: hasShare });
      } catch {
        // Ignore errors
      }
    };

    // ------------------------------------------------------------------------
    // Message Status Updates
    // ------------------------------------------------------------------------

    const markStatusesByIds = (
      ids: string[],
      status: 'pending' | 'success' | 'failed'
    ) => {
      set((s) => ({
        messages: s.messages.map((m) =>
          ids.includes(m.id) ? { ...m, status } : m
        ),
      }));
    };

    // ------------------------------------------------------------------------
    // Presence Management
    // ------------------------------------------------------------------------

    const seedPresenceFromRoom = (room: Room) => {
      try {
        const all = [
          room.localParticipant,
          ...Array.from(room.remoteParticipants?.values?.() ?? [])
        ].filter(Boolean);

        const presencePatch: Record<string, PresenceRecord> = {};
        const avatarPatch: Record<string, string | undefined> = {};

        for (const p of all) {
          const pid = getParticipantId(p);
          const ident = (p as any)?.identity;
          if (!pid) continue;

          const metadata = parseParticipantMetadata((p as any)?.metadata);
          const presence = parsePresenceRecord(p, metadata ?? undefined);
          if (presence) {
            presencePatch[pid] = presence;
            if (ident && ident !== pid) presencePatch[ident] = presence;
          }

          const avatar = metadata?.profile?.avatar;
          if (avatar !== undefined) {
            avatarPatch[pid] = avatar;
            if (ident && ident !== pid) avatarPatch[ident] = avatar;
          }
        }

        if (Object.keys(presencePatch).length || Object.keys(avatarPatch).length) {
          set((s) => ({
            presenceById: { ...s.presenceById, ...presencePatch },
            avatarById: { ...s.avatarById, ...avatarPatch },
          }));
        }
      } catch {
        // Ignore errors
      }
    };

    const syncParticipantSnapshot = (
      participant: any,
      previousMetadata?: string
    ) => {
      const pid = getParticipantId(participant);
      const ident = participant?.identity;

      if (!pid) return;
      if (previousMetadata !== undefined && previousMetadata === participant?.metadata) return;

      const metadata = parseParticipantMetadata(participant?.metadata);
      const presence = parsePresenceRecord(participant, metadata ?? undefined);

      set((s) => {
        let changed = false;
        const next: Partial<MeetingState> = {};

        if (presence) {
          const prev = s.presenceById[pid];
          if (!prev || prev.ts <= presence.ts) {
            const merged: Record<string, PresenceRecord> = {
              ...s.presenceById,
              [pid]: presence,
            };

            if (ident && ident !== pid) {
              const prevAlias = s.presenceById[ident];
              if (!prevAlias || prevAlias.ts <= presence.ts) {
                merged[ident] = presence;
              }
            }

            next.presenceById = merged;
            changed = true;
          }
        }

        const avatar = metadata?.profile?.avatar;
        if (avatar !== undefined) {
          const currentAvatar = s.avatarById[pid];
          if (currentAvatar !== avatar) {
            const mergedAvatars: Record<string, string | undefined> = {
              ...s.avatarById,
              [pid]: avatar,
            };

            if (ident && ident !== pid && s.avatarById[ident] !== avatar) {
              mergedAvatars[ident] = avatar;
            }

            next.avatarById = mergedAvatars;
            changed = true;
          }
        }

        return changed ? next : s;
      });
    };

    // ------------------------------------------------------------------------
    // Profile Broadcasting
    // ------------------------------------------------------------------------

    const broadcastProfile = async (room: Room, destSid?: string) => {
      try {
        const avatar = useUserStore.getState()?.user?.avatar;
        const lp: any = room.localParticipant;
        const identity = lp?.identity ?? lp?.sid;

        if (!avatar || !identity) return;

        const payload = JSON.stringify({ type: 'profile', identity, avatar });
        const bytes = new TextEncoder().encode(payload);
        const opts: any = { reliable: true, topic: 'profile' };

        if (destSid) opts.destinationSids = [destSid];

        await room.localParticipant.publishData(bytes, opts);
      } catch {
        // Ignore errors
      }
    };

    // ------------------------------------------------------------------------
    // Whisper Management
    // ------------------------------------------------------------------------

    const setHearSender = (room: Room, senderSid: string, shouldHear: boolean) => {
      try {
        const remotes = Array.from(room.remoteParticipants?.values?.() ?? []);
        const rp = remotes.find((p: any) => getParticipantId(p) === senderSid);

        if (!rp) return;

        const pubs = (rp as any).getTrackPublications?.() ??
          Array.from((rp as any).trackPublications?.values?.() ?? []);

        pubs
          .filter((pub: any) =>
            pub?.kind === 'audio' || pub?.source === Track.Source.Microphone
          )
          .forEach((pub: any) => {
            try {
              pub.setSubscribed?.(shouldHear);
            } catch {
              // Ignore errors
            }
          });
      } catch {
        // Ignore errors
      }
    };

    const broadcastWhisper = async (
      room: Room,
      action: 'start' | 'stop',
      targetSid?: string
    ) => {
      try {
        const lp: any = room.localParticipant;
        const originSid = lp?.sid ?? lp?.identity;
        const payload = JSON.stringify({
          type: 'whisper',
          action,
          originSid,
          ...(targetSid && { targetSid }),
        });
        const bytes = new TextEncoder().encode(payload);
        await room.localParticipant.publishData(bytes, {
          reliable: true,
          topic: 'whisper',
        } as any);
      } catch {
        // Ignore errors
      }
    };

    // ------------------------------------------------------------------------
    // Chat Message Handling
    // ------------------------------------------------------------------------

    const handleChatMessage = (room: Room, msg: any) => {
      const localSid = getParticipantId(room.localParticipant);
      const senderSid: string = msg.senderSid ?? 'unknown';

      let senderName = msg.senderName;
      if (!senderName || !String(senderName).trim()) {
        const lp: any = room.localParticipant;
        if (String(lp?.identity) === String(senderSid)) {
          senderName = getParticipantName(lp);
        } else {
          const remotes = Array.from(room.remoteParticipants?.values?.() ?? []);
          const rp = remotes.find((p: any) =>
            String(p?.identity) === String(senderSid)
          );
          senderName = rp ? getParticipantName(rp) : String(senderSid || 'User');
        }
      }

      const id: string = msg.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const text: string = String(msg.text ?? '');

      if (!text) return;

      const isLocal = senderSid === localSid;
      const recipientSid = msg.recipientSid || msg.recipientId || undefined;
      const messageType: 'group' | 'dm' = recipientSid ? 'dm' : 'group';
      const dmPeerId = messageType === 'dm'
        ? getDMPeerForMessage({ senderSid, recipientSid }, localSid)
        : undefined;

      set((s) => {
        const idx = s.messages.findIndex((m) => m.id === id);
        const now = Date.now();

        if (idx >= 0) {
          // Update existing message
          const prev = s.messages[idx];
          const updated: ChatMessage = {
            ...prev,
            text,
            senderSid,
            senderName,
            recipientSid,
            ts: now,
            status: 'success',
            messageType,
            dmPeerId,
          };

          const arr = [...s.messages];
          arr[idx] = updated;

          let newUnreadCount = s.unreadCount;
          if (!s.chatOpen && !prev.isLocal) {
            if (messageType === 'group' ||
              (messageType === 'dm' && s.activeDMPeer !== dmPeerId)) {
              newUnreadCount++;
            }
          }

          return { messages: arr, unreadCount: newUnreadCount };
        }

        // Add new message
        const newMessage: ChatMessage = {
          id,
          text,
          ts: now,
          senderSid,
          senderName,
          recipientSid,
          isLocal,
          status: 'success',
          messageType,
          dmPeerId,
        };

        let newUnreadCount = s.unreadCount;
        if (!s.chatOpen && !isLocal) {
          if (messageType === 'group' ||
            (messageType === 'dm' && s.activeDMPeer !== dmPeerId)) {
            newUnreadCount++;
          }
        }

        // Update DM threads
        let newDMThreads = s.dmThreads;
        if (messageType === 'dm' && dmPeerId) {
          const threads = [...(s.dmThreads || [])];
          const i = threads.findIndex((t) => t.peerId === dmPeerId);
          const addUnread = !isLocal && (!s.chatOpen || s.activeDMPeer !== dmPeerId);

          if (i >= 0) {
            const t = threads[i];
            threads[i] = {
              ...t,
              text,
              ts: now,
              unread: Math.max(0, (t.unread || 0) + (addUnread ? 1 : 0)),
            };
          } else {
            const peerNameGuess = !isLocal
              ? senderName
              : s.participants.find((p) => String(p.id) === String(dmPeerId))?.name || String(dmPeerId);
            threads.unshift({
              peerId: dmPeerId,
              peerName: peerNameGuess,
              text,
              ts: now,
              unread: addUnread ? 1 : 0,
            });
          }

          threads.sort((a, b) => (b.ts || 0) - (a.ts || 0));
          newDMThreads = threads;
        }

        return {
          messages: [...s.messages, newMessage],
          unreadCount: newUnreadCount,
          dmThreads: newDMThreads,
        };
      });
    };

    // ------------------------------------------------------------------------
    // Data Channel Handler
    // ------------------------------------------------------------------------

    const handleDataReceived = (
      room: Room,
      payload: Uint8Array,
      participant?: Participant,
      _kind?: any,
      topic?: string
    ) => {
      try {
        const text = typeof payload === 'string'
          ? payload
          : new TextDecoder().decode(payload);
        const msg = JSON.parse(text);

        if (!msg) return;

        const localSid = getParticipantId(room.localParticipant);

        // Handle whisper
        if ((topic === undefined || topic === 'whisper') && msg.type === 'whisper') {
          const senderSid = msg.originSid;
          if (!senderSid) return;

          if (msg.action === 'start') {
            const shouldHear = msg.targetSid === localSid;
            setHearSender(room, senderSid, shouldHear);
          } else if (msg.action === 'stop') {
            setHearSender(room, senderSid, true);
          }
          return;
        }

        // Handle profile
        if ((topic === undefined || topic === 'profile') && msg.type === 'profile') {
          const senderSid = getParticipantId(participant) || msg.senderSid;
          const identity = msg.identity;
          const avatar = msg.avatar;

          if (!senderSid || !avatar) return;

          set((s) => {
            const next: Partial<MeetingState> = {};

            if (s.avatarById[senderSid] !== avatar) {
              next.avatarById = { ...s.avatarById, [senderSid]: avatar };
            }

            if (identity && identity !== senderSid) {
              next.avatarById = {
                ...(next.avatarById ?? s.avatarById),
                [identity]: avatar
              };
            }

            return Object.keys(next).length ? next : s;
          });
          return;
        }

        // Handle chat
        if ((topic === undefined || topic === 'chat') && msg.type === 'chat') {
          handleChatMessage(room, msg);
        }
      } catch {
        // Ignore errors
      }
    };

    // ------------------------------------------------------------------------
    // Room Event Listeners
    // ------------------------------------------------------------------------

    const attachRoomListeners = (room: Room | null) => {
      detachEvents?.();
      detachEvents = null;

      if (!room) return;

      const updateParticipants = () => {
        set({ participants: computeParticipants(room) });
      };

      // Initial sync
      updateParticipants();
      syncAV(room);
      syncScreenShare(room);
      seedPresenceFromRoom(room);

      // Broadcast profile
      broadcastProfile(room);

      // Settle device state
      const t1 = setTimeout(() => syncAV(room), 250);
      const t2 = setTimeout(() => syncAV(room), 1200);

      const onConn = () => {
        updateParticipants();
        syncAV(room);
      };

      const onAnyTrackChange = () => {
        updateParticipants();
        syncAV(room);
        syncScreenShare(room);
      };

      const onParticipantConnected = (p: Participant) => {
        updateParticipants();
        syncParticipantSnapshot(p);

        const destSid = getParticipantId(p);
        if (destSid) {
          broadcastProfile(room, destSid);

          // Rebroadcast whisper state if active
          const { whisperActive, whisperTargetSid } = get();
          if (whisperActive && whisperTargetSid) {
            const lp: any = room.localParticipant;
            const originSid = getParticipantId(lp);
            const payload = JSON.stringify({
              type: 'whisper',
              action: 'start',
              originSid,
              targetSid: whisperTargetSid,
            });
            const bytes = new TextEncoder().encode(payload);
            room.localParticipant.publishData(bytes, {
              reliable: true,
              topic: 'whisper',
              destinationSids: [destSid],
            } as any);
          }
        }
      };

      const onParticipantDisconnected = (p: Participant) => {
        updateParticipants();

        const { whisperActive, whisperTargetSid } = get();
        const leftSid = getParticipantId(p);

        if (whisperActive && whisperTargetSid && leftSid === whisperTargetSid) {
          get().stopWhisper?.();
        }
      };

      const onMetadataChanged = (
        previousMetadata: string | undefined,
        participant: any
      ) => {
        syncParticipantSnapshot(participant, previousMetadata);
        // Also refresh participant snapshots so computed status/avatar reflect latest metadata
        set({ participants: computeParticipants(room) });
      };

      const onAttributesChanged = (
        _changed: Record<string, string>,
        participant: any
      ) => {
        syncParticipantSnapshot(participant);
        set({ participants: computeParticipants(room) });
      };

      const onData = (
        payload: Uint8Array,
        participant?: Participant,
        kind?: any,
        topic?: string
      ) => {
        handleDataReceived(room, payload, participant, kind, topic);
      };

      // Attach listeners
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
        .on?.(RoomEvent.DataReceived as any, onData as any)
        .on?.(RoomEvent.ParticipantMetadataChanged as any, onMetadataChanged)
        .on?.(RoomEvent.ParticipantAttributesChanged as any, onAttributesChanged);

      // Cleanup function
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
          .off?.(RoomEvent.DataReceived as any, onData as any)
          .off?.(RoomEvent.ParticipantMetadataChanged as any, onMetadataChanged)
          .off?.(RoomEvent.ParticipantAttributesChanged as any, onAttributesChanged);
      };
    };

    // ------------------------------------------------------------------------
    // Store State & Actions
    // ------------------------------------------------------------------------

    return {
      // Initial state
      joining: false,
      connected: false,
      error: null,
      url: null,
      token: null,
      room: null,
      participants: [],
      presenceById: {},
      localPresence: 'IN_MEETING',
      avatarById: {},
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
      activeDMPeer: null,
      viewMode: (() => {
        if (typeof window === 'undefined') return 'grid';
        try {
          const stored = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
          return stored === '3d' ? '3d' : 'grid';
        } catch {
          return 'grid';
        }
      })(),

      // Actions
      setRoom: (room) => {
        set({
          room,
          connected: !!room,
          startedAt: room ? Date.now() : null,
        });
        syncAV(room);
        attachRoomListeners(room);

        if (room) {
          get().loadChatHistory?.(100);
        }
      },

      setViewMode: (mode) => {
        try {
          window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
        } catch {
          // Ignore storage failures (e.g. Safari private mode)
        }
        set({ viewMode: mode });
      },

      toggleMic: async () => {
        const room = get().room;
        if (!room) return;

        const next = !get().micEnabled;
        try {
          await room.localParticipant.setMicrophoneEnabled(next);
          set({ micEnabled: !!room.localParticipant.isMicrophoneEnabled });
        } catch {
          // Ignore errors
        }
      },

      toggleCam: async () => {
        const room = get().room;
        if (!room) return;

        const next = !get().camEnabled;
        try {
          await room.localParticipant.setCameraEnabled(next);
          set({ camEnabled: !!room.localParticipant.isCameraEnabled });
        } catch {
          // Ignore errors
        }
      },

      leave: () => {
        try {
          get().room?.disconnect();
        } catch {
          // Ignore errors
        }

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
          activeDMPeer: null,
          screenShareEnabled: false,
          speakerEnabled: true,
        });
      },

      startWhisper: async (targetSid: string) => {
        const room = get().room;
        if (!room) return;

        const lp: any = room.localParticipant;
        revertMicOnWhisperStop = false;

        // Enable mic if needed
        try {
          if (!lp?.isMicrophoneEnabled) {
            await room.localParticipant.setMicrophoneEnabled(true);
            revertMicOnWhisperStop = true;
            set({ micEnabled: !!room.localParticipant.isMicrophoneEnabled });
          }
        } catch {
          // Ignore errors
        }

        await broadcastWhisper(room, 'start', targetSid);
        set({ whisperActive: true, whisperTargetSid: targetSid });
      },

      stopWhisper: async () => {
        const room = get().room;
        if (!room) return;

        await broadcastWhisper(room, 'stop');

        if (revertMicOnWhisperStop) {
          try {
            await room.localParticipant.setMicrophoneEnabled(false);
            set({ micEnabled: !!room.localParticipant.isMicrophoneEnabled });
          } catch {
            // Ignore errors
          }
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
            set({ url, token, joining: false, error: null });
          } else {
            const errorMsg = (data as any)?.errors?.[0]?.message ?? "Unable to join meeting";
            set({ joining: false, connected: false, error: errorMsg });
            toast.error(errorMsg);
          }
        } catch (e: any) {
          const errorMsg = e?.message ?? "Network error while joining";
          set({ joining: false, connected: false, error: errorMsg });
          toast.error(errorMsg);
        }
      },

      toggleChat: () => {
        set((s) => ({
          chatOpen: !s.chatOpen,
          unreadCount: !s.chatOpen ? 0 : s.unreadCount,
        }));
      },

      sendMessage: async (text: string, toIdentity?: string | null) => {
        const room = get().room;
        if (!room) return;

        const clean = text.trim();
        if (!clean) return;

        const lp: any = room.localParticipant;
        const senderSid = getParticipantId(lp);
        const senderName = getParticipantName(lp);
        const { activeWorkspaceMembers } = useWorkspaceStore.getState();
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();

        const messageType: 'group' | 'dm' = toIdentity ? 'dm' : 'group';
        const dmPeerId = messageType === 'dm' ? toIdentity : undefined;

        // Optimistic append
        const newMessage: ChatMessage = {
          id,
          text: clean,
          ts: now,
          senderSid,
          senderName,
          recipientSid: toIdentity || undefined,
          isLocal: true,
          status: 'pending',
          messageType,
          dmPeerId: dmPeerId || undefined,
        };

        set((s) => {
          let newDMThreads = s.dmThreads;

          if (messageType === 'dm' && dmPeerId) {
            const threads = [...(s.dmThreads || [])];
            const i = threads.findIndex((t) => t.peerId === dmPeerId);

            if (i >= 0) {
              threads[i] = { ...threads[i], text: clean, ts: now };
            } else {
              const peerNameGuess = activeWorkspaceMembers
                ?.find((p) => String(p.id) === String(dmPeerId))?.name ||
                String(dmPeerId);
              threads.unshift({
                peerId: dmPeerId,
                peerName: peerNameGuess,
                text: clean,
                ts: now,
                unread: 0,
              });
            }

            threads.sort((a, b) => (b.ts || 0) - (a.ts || 0));
            newDMThreads = threads;
          }

          return {
            messages: [...s.messages, newMessage],
            dmThreads: newDMThreads,
          };
        });

        // Send to server
        try {
          const { activeWorkspaceId } = useWorkspaceStore.getState();
          if (!activeWorkspaceId) {
            markStatusesByIds([id], 'failed');
            return;
          }

          await api.post(
            `/workspace/${activeWorkspaceId}/chat/messages`,
            {
              text: clean,
              id,
              ...(toIdentity && { to: toIdentity }),
            },
            { withCredentials: true }
          );

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
          if (!activeWorkspaceId) {
            markStatusesByIds([id], 'failed');
            return;
          }

          await api.post(
            `/workspace/${activeWorkspaceId}/chat/messages`,
            {
              text: msg.text,
              id,
              ...(msg.recipientSid && { to: msg.recipientSid }),
            },
            { withCredentials: true }
          );

          markStatusesByIds([id], 'success');
        } catch {
          markStatusesByIds([id], 'failed');
        }
      },

      loadChatHistory: async (limit = 100, peerIdentity?: string | null) => {
        try {
          const { activeWorkspaceId } = useWorkspaceStore.getState();
          if (!activeWorkspaceId) return;

          const params: any = { limit };
          if (peerIdentity) params.peer = peerIdentity;

          const { data } = await api.get(
            `/workspace/${activeWorkspaceId}/chat/messages`,
            { params, withCredentials: true }
          );

          if ((data as any)?.success && Array.isArray((data as any).data)) {
            const items: Array<{
              id: string;
              text: string;
              ts: string;
              sender: { id: string; name: string; avatar?: string };
              recipientId?: string | null;
            }> = (data as any).data;

            const room: any = get().room;
            const currentId = room?.localParticipant?.identity;

            const avatarPatch: Record<string, string | undefined> = {};
            const processedMessages = items.map((m) => {
              const messageType: 'group' | 'dm' = m.recipientId ? 'dm' : 'group';
              const dmPeerId = messageType === 'dm' && currentId
                ? getDMPeerForMessage(
                  { senderSid: m.sender.id, recipientSid: m.recipientId || undefined },
                  currentId
                )
                : undefined;

              // Collect any known avatars from history
              if (m.sender?.id && m.sender?.avatar !== undefined) {
                avatarPatch[m.sender.id] = m.sender.avatar;
              }

              return {
                id: m.id,
                text: m.text,
                ts: new Date(m.ts).getTime(),
                senderSid: m.sender.id,
                senderName: m.sender.name,
                recipientSid: m.recipientId ?? undefined,
                isLocal: currentId ? String(m.sender.id) === String(currentId) : false,
                status: 'success' as const,
                messageType,
                dmPeerId,
              };
            });

            set((s) => ({
              messages: peerIdentity
                ? [
                  ...s.messages.filter(
                    (msg) => msg.messageType !== 'dm' || msg.dmPeerId !== peerIdentity
                  ),
                  ...processedMessages,
                ]
                : processedMessages,
              unreadCount: s.chatOpen ? 0 : s.unreadCount,
              avatarById: Object.keys(avatarPatch).length
                ? { ...s.avatarById, ...avatarPatch }
                : s.avatarById,
            }));
          }
        } catch {
          // Ignore errors
        }
      },

      loadDMThreads: async () => {
        try {
          const { activeWorkspaceId } = useWorkspaceStore.getState();
          if (!activeWorkspaceId) return;

          const { data } = await api.get(
            `/workspace/${activeWorkspaceId}/chat/threads`,
            { withCredentials: true }
          );

          if ((data as any)?.success && Array.isArray((data as any).data)) {
            const rows: Array<{
              peer: { id: string; name: string; avatar?: string };
              last?: { text: string; ts: string };
              unread?: number;
            }> = (data as any).data;

            const avatarPatch: Record<string, string | undefined> = {};
            const threads = rows.map((r) => {
              if (r.peer?.id && r.peer?.avatar !== undefined) {
                avatarPatch[r.peer.id] = r.peer.avatar;
              }
              return ({
                peerId: r.peer.id,
                peerName: r.peer.name,
                peerAvatar: r.peer.avatar,
                text: r.last?.text,
                ts: r.last ? new Date(r.last.ts).getTime() : undefined,
                unread: r.unread || 0,
              });
            });

            set((s) => ({
              dmThreads: threads,
              avatarById: Object.keys(avatarPatch).length
                ? { ...s.avatarById, ...avatarPatch }
                : s.avatarById,
            }));
          }
        } catch {
          // Ignore errors
        }
      },

      markDMRead: async (peerIdentity: string) => {
        try {
          const { activeWorkspaceId } = useWorkspaceStore.getState();
          if (!activeWorkspaceId) return;

          await api.post(
            `/workspace/${activeWorkspaceId}/chat/threads/${peerIdentity}/read`,
            {},
            { withCredentials: true }
          );

          set((s) => ({
            dmThreads: (s.dmThreads || []).map((t) =>
              t.peerId === peerIdentity ? { ...t, unread: 0 } : t
            ),
          }));
        } catch {
          // Ignore errors
        }
      },

      setActiveDMPeer: (peerId: string | null) => {
        set({ activeDMPeer: peerId });

        if (peerId) {
          get().loadChatHistory?.(100, peerId);
        }
      },

      getGroupMessages: () => {
        return get().messages.filter((msg) => msg.messageType === 'group');
      },

      getDMMessages: (peerId: string) => {
        return get().messages.filter(
          (msg) => msg.messageType === 'dm' && msg.dmPeerId === peerId
        );
      },

      getUnreadGroupCount: () => {
        const { chatOpen, activeDMPeer, messages } = get();
        if (chatOpen && !activeDMPeer) return 0;
        return messages.filter(
          (msg) => msg.messageType === 'group' && !msg.isLocal
        ).length;
      },

      getUnreadDMCount: (peerId?: string) => {
        const { dmThreads, activeDMPeer, chatOpen } = get();
        if (!dmThreads) return 0;

        if (peerId) {
          const thread = dmThreads.find((t) => t.peerId === peerId);
          return chatOpen && activeDMPeer === peerId ? 0 : thread?.unread || 0;
        }

        return dmThreads.reduce((sum, t) => sum + (t.unread || 0), 0);
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

          syncScreenShare(room);
        } catch {
          // Ignore errors
        }
      },

      toggleSpeaker: async () => {
        const room = get().room;
        if (!room) return;

        try {
          const next = !get().speakerEnabled;
          const remotes = Array.from(room.remoteParticipants?.values?.() ?? []);

          for (const rp of remotes) {
            try {
              const pubs = (rp as any).getTrackPublications?.() ??
                Array.from((rp as any).trackPublications?.values?.() ?? []);

              for (const pub of pubs) {
                const isAudio = pub?.kind === 'audio' ||
                  pub?.source === Track.Source.Microphone;

                if (isAudio) {
                  try {
                    await pub.setSubscribed?.(next);
                  } catch {
                    // Ignore errors
                  }
                }
              }
            } catch {
              // Ignore errors
            }
          }

          set({ speakerEnabled: next });
        } catch {
          // Ignore errors
        }
      },

      getPresenceFor: (id?: string) => {
        if (!id) return 'AVAILABLE';
        const s = get().presenceById[id];
        return s?.status || 'AVAILABLE';
      },

      setLocalPresence: async (status: PresenceStatus) => {
        try {
          const room: any = get().room;
          const pid = getParticipantId(room?.localParticipant);
          const ident = room?.localParticipant?.identity;

          if (pid) {
            const ts = Date.now();
            const record: PresenceRecord = { status, ts };
            set((s) => ({
              localPresence: status,
              presenceById: {
                ...s.presenceById,
                [pid]: record,
                ...(ident && ident !== pid ? { [ident]: record } : {}),
              },
            }));

            try {
              const lp: any = room?.localParticipant;
              await lp?.setAttributes?.({
                [PRESENCE_STATUS_KEY]: status,
                [PRESENCE_TS_KEY]: ts.toString(),
              });
            } catch {
              // Ignore attribute errors
            }
          }
        } catch {
          // Ignore errors
        }

        // Propagate to backend
        try {
          const wid = useWorkspaceStore.getState().activeWorkspaceId;
          if (wid) {
            await api.post(
              `/workspace/${wid}/presence`,
              { status },
              { withCredentials: true }
            );
          }
        } catch {
          // Ignore errors
        }
      },

      getAvatarFor: (id?: string) => {
        if (!id) return undefined;
        return get().avatarById[id];
      },
    };
  })
);
