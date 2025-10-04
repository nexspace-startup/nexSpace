import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { MeetingAvatar } from "../stores/meetingStore";
import { useMeetingStore } from "../stores/meetingStore";

// ============================================================================
// Types
// ============================================================================

export type PresenceFlyoutProps = {
  open: boolean;
  onClose: () => void;
  participants: MeetingAvatar[];
  anchorRef?: React.RefObject<HTMLElement | null>;
};

type PresenceStatus = string;

type StatusConfig = {
  label: string;
  styles: string;
  icon: React.ReactNode;
};

// ============================================================================
// Constants
// ============================================================================

const FLYOUT_TOP_POSITION = 94;

const STATUS_CONFIGS: Record<string, StatusConfig> = {
  IN_MEETING: {
    label: 'In a meeting',
    styles: 'bg-[rgba(148,173,255,0.2)] text-white',
    icon: <MeetingIcon />,
  },
  DO_NOT_DISTURB: {
    label: 'Do not disturb',
    styles: 'bg-[rgba(255,192,136,0.2)] text-white',
    icon: <MoonIcon />,
  },
  DND: {
    label: 'Do not disturb',
    styles: 'bg-[rgba(255,192,136,0.2)] text-white',
    icon: <MoonIcon />,
  },
  BUSY: {
    label: 'Busy',
    styles: 'bg-[rgba(255,192,136,0.2)] text-white',
    icon: <MoonIcon />,
  },
  AWAY: {
    label: 'Away',
    styles: 'bg-[rgba(245,158,11,0.20)] text-white',
    icon: <MoonIcon />,
  },
  AVAILABLE: {
    label: 'Available',
    styles: 'bg-[rgba(72,255,164,0.20)] text-white',
    icon: <MoonIcon />,
  },
};

const DEFAULT_STATUS: StatusConfig = {
  label: 'Available',
  styles: 'bg-[rgba(72,255,164,0.20)] text-white',
  icon: <MoonIcon />,
};

// ============================================================================
// Helper Functions
// ============================================================================

const mapStatusToConfig = (status: PresenceStatus): StatusConfig => {
  const normalized = String(status || '').toUpperCase();
  return STATUS_CONFIGS[normalized] || DEFAULT_STATUS;
};

const filterParticipants = (
  participants: MeetingAvatar[],
  query: string
): MeetingAvatar[] => {
  const normalized = query.trim().toLowerCase();

  if (!normalized) return participants;

  return participants.filter((p) =>
    (p.name || p.id).toLowerCase().includes(normalized)
  );
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
};

// ============================================================================
// Icon Components
// ============================================================================

const PhoneIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    className="text-[#80889B]"
    aria-hidden
  >
    <path
      d="M6 4h3l2 5-2 1c.8 1.6 2.1 2.9 3.7 3.7l1-2 5 2v3c0 .6-.4 1-1 1C11.2 18.4 5.6 12.8 5 6c0-.6.4-1 1-1Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const VideoIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    className="text-[#80889B]"
    aria-hidden
  >
    <rect
      x="4"
      y="7"
      width="10"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <path
      d="M14 10l6-3v10l-6-3v-4Z"
      stroke="currentColor"
      strokeWidth="1.4"
      fill="none"
    />
  </svg>
);

const AiIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    className="text-[#80889B]"
    aria-hidden
  >
    <circle
      cx="12"
      cy="12"
      r="8"
      stroke="currentColor"
      strokeWidth="1.4"
    />
    <path
      d="M8 12h8M12 8v8"
      stroke="currentColor"
      strokeWidth="1.4"
    />
  </svg>
);

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="text-[#FFC088]"
      aria-hidden
    >
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5Z"
        fill="#FFC088"
      />
    </svg>
  );
}

function MeetingIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="text-[#4285F4]"
      aria-hidden
    >
      <path
        d="M4 7h10v10H4z"
        stroke="#4285F4"
        strokeWidth="1.4"
      />
      <path
        d="M14 10l6-3v10l-6-3v-4Z"
        stroke="#4285F4"
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  );
}

const SearchIcon: React.FC = () => (
  <svg className="w-5 h-5 text-[#80889B]" viewBox="0 0 24 24" aria-hidden>
    <circle
      cx="11"
      cy="11"
      r="7"
      stroke="currentColor"
      strokeWidth="1.6"
      fill="none"
    />
    <path
      d="M20 20l-3.2-3.2"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

// ============================================================================
// Sub-Components
// ============================================================================

const StatusBadge: React.FC<{ status: PresenceStatus }> = ({ status }) => {
  const config = mapStatusToConfig(status);

  return (
    <div className={`presence-badge ${config.styles}`}>
      {config.icon}
      <span className="text-[12px] font-medium">{config.label}</span>
    </div>
  );
};

const ParticipantAvatar: React.FC<{
  participant: MeetingAvatar;
  avatarUrl?: string;
}> = ({ participant, avatarUrl }) => {
  const displayName = participant.name || participant.id;

  return (
    <div className="w-8 h-8 rounded-full overflow-hidden grid place-items-center bg-[rgba(88,39,218,0.25)]">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[12px] font-medium text-white/90">
          {getInitials(displayName)}
        </span>
      )}
    </div>
  );
};

const ParticipantItem: React.FC<{
  participant: MeetingAvatar;
  status: PresenceStatus;
  avatarUrl?: string;
}> = ({ participant, status, avatarUrl }) => {
  const displayName = participant.name || participant.id;

  return (
    <div className="presence-item">
      {/* User card */}
      <div className="flex items-center gap-3">
        <ParticipantAvatar participant={participant} avatarUrl={avatarUrl} />
        <div className="flex flex-col leading-none">
          <div className="text-white text-[14px] font-medium font-manrope">
            {displayName}
          </div>
          <div className="text-[#80889B] text-[12px] font-manrope mt-1">
            {participant.id}
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className="hidden sm:flex sm:justify-self-center">
        <StatusBadge status={status} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 sm:justify-self-end sm:ml-2">
        <button className="btn-circle-ghost" aria-label="Call audio">
          <PhoneIcon />
        </button>
        <button className="btn-circle-ghost" aria-label="Call video">
          <VideoIcon />
        </button>
        <button className="btn-circle-ghost" aria-label="Whisper">
          <AiIcon />
        </button>
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div className="py-8 text-center text-sm text-[#80889B]">
    No participants
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

const PresenceFlyout: React.FC<PresenceFlyoutProps> = ({
  open,
  onClose,
  participants,
  anchorRef,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");

  // Subscribe to presence and avatar maps so updates trigger re-render
  const presenceById = useMeetingStore((s) => s.presenceById);
  const avatarById = useMeetingStore((s) => s.avatarById);

  // Filter participants based on search query
  const filteredParticipants = useMemo(
    () => filterParticipants(participants ?? [], query),
    [participants, query]
  );

  // Handle search input change
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value);
    },
    []
  );

  // Close on outside click / touch / Escape
  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      // Don't close if clicking inside the flyout
      if (ref.current?.contains(target)) return;

      // Don't close if clicking the anchor element
      if (anchorRef?.current?.contains(target as any)) return;

      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick as any);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="presence-flyout fixed left-1/2 -translate-x-1/2 z-50"
      style={{ top: FLYOUT_TOP_POSITION }}
      role="dialog"
      aria-label="Participants"
    >
      {/* Search */}
      <div className="presence-search w-full">
        <SearchIcon />
        <input
          className="flex-1 bg-transparent outline-none text-white placeholder:text-white/60 text-[14px] font-manrope"
          placeholder="Search people"
          value={query}
          onChange={handleSearchChange}
          autoComplete="off"
        />
      </div>

      {/* List */}
      <div className="w-full flex flex-col divide-y divide-[#26272B]/60 overflow-y-auto">
        {filteredParticipants.length === 0 ? (
          <EmptyState />
        ) : (
          filteredParticipants.map((participant) => {
            // Prefer explicit presence; fallback to participant.status; else assume in meeting
            const status =
              presenceById[participant.id]?.status ||
              (participant.status as any) ||
              ("IN_MEETING" as any);
            const avatarUrl = avatarById[participant.id] ?? participant?.avatar;

            return (
              <ParticipantItem
                key={participant.id}
                participant={participant}
                status={status}
                avatarUrl={avatarUrl}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default PresenceFlyout;
