import React, { useMemo, useRef, useState, useCallback } from "react";
import { useMeetingStore } from "../stores/meetingStore";
import { initialsFrom } from "../utils/util";
import { useUIStore } from "../stores/uiStore";
import PresenceFlyout from "./PresenceFlyout";
import { useUserStore } from "../stores/userStore";
import { STATUS } from "../constants/constants";
import type { MeetingAvatar } from "../stores/meetingStore";

// ============================================================================
// Types
// ============================================================================

type StatusOption = {
  value: string;
  label: string;
};

// ============================================================================
// Constants
// ============================================================================

const WIDGET_TOP_POSITION = 24;
const WIDGET_HEIGHT = 60;
const CHAT_OFFSET = 204;
const MAX_VISIBLE_AVATARS = 2;

const STATUS_COLORS: Record<string, string> = {
  DO_NOT_DISTURB: "#ED5C5B",
  BUSY: "#ED5C5B",
  AVAILABLE: "#48FFA4",
  AWAY: "#F59E0B",
};

const DEFAULT_STATUS_COLOR = "#80889B";

// ============================================================================
// Helper Functions
// ============================================================================

const getParticipantId = (p: any): string => p?.sid ?? p?.identity ?? '';

const getParticipantName = (p: any): string => p?.name ?? p?.identity ?? '';

const getStatusText = (
  connected: boolean,
  joining: boolean,
  localPresence: string
): string => {
  if (!connected) {
    return joining ? "Joining…" : "Not in meeting";
  }

  const statusOption = STATUS?.find((x) => x.value === String(localPresence));
  return statusOption?.label ?? "Available";
};

const extractParticipantsFromRoom = (room: any): MeetingAvatar[] => {
  try {
    if (!room) return [];

    const result: MeetingAvatar[] = [];

    // Add local participant
    const localId = getParticipantId(room.localParticipant);
    if (localId) {
      result.push({
        id: localId,
        name: getParticipantName(room.localParticipant),
      });
    }

    // Add remote participants
    const remotes = Array.from(room.remoteParticipants?.values?.() ?? []);
    remotes.forEach((rp: any) => {
      const id = getParticipantId(rp);
      if (id) {
        result.push({
          id,
          name: getParticipantName(rp),
        });
      }
    });

    return result;
  } catch {
    return [];
  }
};

const getTransformStyle = (chatOpen: boolean): string => {
  return chatOpen
    ? `translateX(calc(-50% - ${CHAT_OFFSET}px))`
    : "translateX(-50%)";
};

const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;
};

// ============================================================================
// Sub-Components
// ============================================================================

const StatusIcon: React.FC = () => (
  <svg className="icon-16" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M5 9a7 7 0 1 0 14 0"
      stroke="#4285F4"
      strokeWidth="1.6"
      fill="none"
    />
    <circle cx="12" cy="9" r="2" fill="#48FFA4" />
  </svg>
);

const ChevronDownIcon: React.FC = () => (
  <svg className="icon-20 text-[#80889B]" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const SearchIcon: React.FC = () => (
  <svg className="icon-16 text-[#80889B]" viewBox="0 0 24 24" aria-hidden="true">
    <circle
      cx="11"
      cy="11"
      r="7"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="none"
    />
    <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const StatusDropdown: React.FC<{
  open: boolean;
  options: StatusOption[];
  onSelect: (value: string) => void;
}> = ({ open, options, onSelect }) => {
  if (!open) return null;

  return (
    <div className="menu" role="menu">
      {options.map((opt) => (
        <button
          key={opt.value}
          className="menu-item"
          role="menuitem"
          onClick={() => onSelect(opt.value)}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getStatusColor(opt.value) }}
          />
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const Avatar: React.FC<{
  participant: MeetingAvatar;
  avatarUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ participant, avatarUrl, className = "", style }) => {
  const displayName = participant.name || participant.id;

  return (
    <div
      className={`avatar-24 absolute top-0 overflow-hidden bg-white/10 ${className}`}
      style={style}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center">
          <span className="text-[10px] font-semibold text-white">
            {initialsFrom(displayName)}
          </span>
        </div>
      )}
    </div>
  );
};

const AvatarStack: React.FC<{
  participants: MeetingAvatar[];
  avatarById: Record<string, string | undefined>;
  localSid?: string;
  userAvatar?: string;
  extraCount: number;
}> = ({ participants, avatarById, localSid, userAvatar, extraCount }) => {
  const getAvatarUrl = useCallback(
    (participantId: string): string | undefined => {
      const fromStore = avatarById[participantId];
      if (fromStore) return fromStore;

      // Fallback to user avatar if this is the local participant
      if (localSid && participantId === localSid) {
        return userAvatar;
      }

      return undefined;
    },
    [avatarById, localSid, userAvatar]
  );

  return (
    <div className="avatar-stack-24" aria-label="Participants">
      {participants[0] && (
        <Avatar
          participant={participants[0]}
          avatarUrl={getAvatarUrl(participants[0].id)}
          style={{ left: 0 }}
        />
      )}
      {participants[1] && (
        <Avatar
          participant={participants[1]}
          avatarUrl={getAvatarUrl(participants[1].id)}
          style={{ left: 16 }}
        />
      )}
      {extraCount > 0 && (
        <div className="avatar-counter-24" style={{ left: 32, top: 0 }}>
          +{extraCount}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const TopWidget: React.FC = () => {
  // State
  const [statusOpen, setStatusOpen] = useState(false);
  const [presenceOpen, setPresenceOpen] = useState(false);

  // Refs
  const presenceAnchorRef = useRef<HTMLDivElement | null>(null);

  // Meeting store
  const connected = useMeetingStore((s) => s.connected);
  const joining = useMeetingStore((s) => s.joining);
  const participants = useMeetingStore((s) => s.participants);
  const room = useMeetingStore((s) => s.room);
  const localPresence = useMeetingStore((s) => s.localPresence);
  const setLocalPresence = useMeetingStore((s) => s.setLocalPresence);
  const avatarById = useMeetingStore((s) => s.avatarById);
  const chatOpen = useMeetingStore((s) => s.chatOpen);

  // UI store
  const isTopWidgetOpen = useUIStore((s) => s.isTopWidgetOpen);

  // User store
  const userAvatar = useUserStore((s) => s.user?.avatar);

  // Compute status text
  const statusText = useMemo(
    () => getStatusText(connected, joining, localPresence),
    [connected, joining, localPresence]
  );

  // Get display participants (from store or extract from room)
  const displayParticipants = useMemo(() => {
    if (participants?.length > 0) return participants;
    return extractParticipantsFromRoom(room);
  }, [participants, room]);

  // Get visible avatars and extra count
  const visibleAvatars = useMemo(
    () => displayParticipants.slice(0, MAX_VISIBLE_AVATARS),
    [displayParticipants]
  );

  const extraCount = Math.max(0, displayParticipants.length - MAX_VISIBLE_AVATARS);

  // Get local participant SID
  const localSid = getParticipantId((room as any)?.localParticipant);

  // Transform style for chat offset
  const transformStyle = useMemo(
    () => getTransformStyle(chatOpen),
    [chatOpen]
  );

  // Handlers
  const toggleStatusDropdown = useCallback(() => {
    setStatusOpen((prev) => !prev);
  }, []);

  const handleStatusSelect = useCallback(
    (value: string) => {
      setLocalPresence(value as any);
      setStatusOpen(false);
    },
    [setLocalPresence]
  );

  const togglePresenceFlyout = useCallback(() => {
    setPresenceOpen((prev) => !prev);
  }, []);

  const closePresenceFlyout = useCallback(() => {
    setPresenceOpen(false);
  }, []);

  if (!isTopWidgetOpen) return null;

  return (
    <>
      <div
        className="widget-top left-1/2 w-auto"
        style={{
          top: WIDGET_TOP_POSITION,
          height: WIDGET_HEIGHT,
          transform: transformStyle,
        }}
      >
        <div className="widget-top-inner w-full h-full">
          <div className="flex items-center w-full h-8 gap-3 sm:gap-8">
            {/* Status chip */}
            <div className="relative">
              <button
                type="button"
                className="status-chip min-w-[120px] max-w-[130px]"
                onClick={toggleStatusDropdown}
                aria-haspopup="menu"
                aria-expanded={statusOpen}
              >
                <StatusIcon />
                <span className="truncate max-w-[100px]">{statusText}</span>
                <ChevronDownIcon />
              </button>
              <StatusDropdown
                open={statusOpen}
                options={STATUS}
                onSelect={handleStatusSelect}
              />
            </div>

            {/* Divider */}
            <div className="sep-vert hidden sm:block" />

            {/* Search */}
            <button
              className="icon-btn-ghost hidden sm:grid"
              aria-label="Search"
              style={{ width: 32, height: 32 }}
            >
              <SearchIcon />
            </button>

            {/* Divider */}
            <div className="sep-vert hidden sm:block" />

            {/* Avatars + chevron (opens presence flyout) */}
            <div
              className="flex items-center cursor-pointer select-none"
              style={{ gap: 5 }}
              ref={presenceAnchorRef}
              onClick={togglePresenceFlyout}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  togglePresenceFlyout();
                }
              }}
            >
              <AvatarStack
                participants={visibleAvatars}
                avatarById={avatarById}
                localSid={localSid}
                userAvatar={userAvatar}
                extraCount={extraCount}
              />
              <button
                className="chev-btn hidden sm:grid"
                aria-label="More participants"
                style={{ width: 20, height: 20 }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5">
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="#80889B"
                    strokeWidth="1.6"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Presence Flyout */}
      <PresenceFlyout
        open={presenceOpen}
        onClose={closePresenceFlyout}
        participants={displayParticipants}
        anchorRef={presenceAnchorRef}
      />
    </>
  );
};

export default TopWidget;