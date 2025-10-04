import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRoomContext, useTracks, VideoTrack, isTrackReference } from "@livekit/components-react";
import type { Participant, Room } from "livekit-client";
import { Track } from "livekit-client";
import ProfileTile from "./ProfileTile";
import { useMeetingStore } from "../stores/meetingStore";
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "../stores/uiStore";

// ============================================================================
// Constants
// ============================================================================

const CROSS_COUNT = 5;
const DEFAULT_PAGE_SIZE = 24;
const DEFAULT_BOTTOM_SAFE_AREA = 120;
const DEFAULT_TOP_SAFE_AREA = 96;

// ============================================================================
// Types
// ============================================================================

type Props = {
  pageSize?: number;
  bottomSafeAreaPx?: number;
  topSafeAreaPx?: number;
};

type GridMode = "one" | "five" | "many";

type GridDimensions = {
  rows: number;
  cols: number;
};

// ============================================================================
// Helper Functions
// ============================================================================

const getParticipantId = (p: any): string => p?.sid ?? p?.identity ?? '';

const collectParticipants = (
  room: Room | null | undefined,
  ids: { id: string }[]
): Participant[] => {
  if (!room) return [];

  const localId = getParticipantId(room.localParticipant);
  const remote = Array.from(room.remoteParticipants?.values?.() ?? []);

  // Build participant map
  const map = new Map<string, Participant>();
  map.set(localId, room.localParticipant);
  remote.forEach((rp) => {
    const key = getParticipantId(rp);
    map.set(key, rp);
  });

  // If no IDs provided, return all participants
  if (!ids?.length) {
    return [room.localParticipant, ...remote];
  }

  // Return participants in order of provided IDs
  return ids.map((a) => map.get(a.id)).filter(Boolean) as Participant[];
};

const getTeamsDims = (n: number): GridDimensions => {
  if (n <= 1) return { rows: 1, cols: 1 };
  if (n <= 4) return { rows: 2, cols: 2 };
  if (n <= 9) return { rows: 3, cols: 3 };
  if (n <= 16) return { rows: 4, cols: 4 };
  if (n <= 20) return { rows: 4, cols: 5 };
  return { rows: 4, cols: 6 };
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  if (size <= 0) return [arr];

  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

const getGridMode = (participantCount: number): GridMode => {
  if (participantCount <= 1) return "one";
  if (participantCount === CROSS_COUNT) return "five";
  return "many";
};

// ============================================================================
// Sub-Components
// ============================================================================

const GridOne: React.FC<{ participant: Participant }> = ({ participant }) => (
  <div className="grid place-items-center w-full max-w-[424px] h-[463px]">
    <ProfileTile participant={participant} />
  </div>
);

const GridFive: React.FC<{ participants: Participant[] }> = ({ participants }) => {
  const [pTop, pLeft, pCenter, pRight, pBottom] = participants;

  return (
    <div
      className="grid gap-6 justify-items-center w-full max-w-[424px] h-[463px]"
      style={{
        gridTemplateAreas: `
          ".    top     ."
          "left center right"
          ".    bottom  ."
        `,
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      }}
    >
      <div style={{ gridArea: "top" }}>
        {pTop && <ProfileTile participant={pTop} />}
      </div>
      <div style={{ gridArea: "left" }}>
        {pLeft && <ProfileTile participant={pLeft} />}
      </div>
      <div style={{ gridArea: "center" }}>
        {pCenter && <ProfileTile participant={pCenter} />}
      </div>
      <div style={{ gridArea: "right" }}>
        {pRight && <ProfileTile participant={pRight} />}
      </div>
      <div style={{ gridArea: "bottom" }}>
        {pBottom && <ProfileTile participant={pBottom} />}
      </div>
    </div>
  );
};

const GridMany: React.FC<{ participants: Participant[] }> = ({ participants }) => {
  const n = participants.length;
  const { rows, cols } = getTeamsDims(n);
  const totalCells = rows * cols;
  const ghostCount = totalCells - n;

  return (
    <div
      className="grid w-full max-w-screen-xl mx-auto gap-2 sm:gap-3 place-content-center justify-items-center"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {participants.map((p) => (
        <ProfileTile key={getParticipantId(p)} participant={p} />
      ))}

      {/* Ghost cells to maintain grid shape */}
      {Array.from({ length: ghostCount }).map((_, i) => (
        <div key={`ghost-${i}`} className="opacity-0 pointer-events-none" />
      ))}
    </div>
  );
};

const ScreenShareStage: React.FC<{
  trackRef: any;
  expanded: boolean;
  onToggleExpand: () => void;
}> = ({ trackRef, expanded, onToggleExpand }) => {
  const participantName =
    trackRef?.participant?.name ||
    trackRef?.participant?.identity ||
    "Screen";

  const stageRoundClass = expanded ? "rounded-none" : "rounded-xl";

  return (
    <div className={`relative w-full h-full overflow-hidden bg-black ${stageRoundClass}`}>
      <VideoTrack
        trackRef={trackRef}
        className="!w-full !h-full"
        data-lk-object-fit="contain"
      />

      {/* Presenter label */}
      <div className="absolute left-3 top-3 px-2 py-1 rounded bg-black/50 text-white text-xs">
        Presenting: {participantName}
      </div>

      {/* Expand/Minimize button */}
      <button
        onClick={onToggleExpand}
        className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 hover:bg-black/70 text-white grid place-items-center shadow-md transition-colors"
        aria-label={expanded ? "Minimize presentation" : "Expand presentation"}
        title={expanded ? "Minimize" : "Expand"}
      >
        {expanded ? (
          // Minimize icon
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 3v2H5v4H3V3h6zM21 9h-2V5h-4V3h6v6zM3 15h2v4h4v2H3v-6zM15 21v-2h4v-4h2v6h-6z"
              fill="currentColor"
            />
          </svg>
        ) : (
          // Expand icon
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 3H3v6h2V5h4V3zM21 3h-6v2h4v4h2V3zM5 17H3v4h6v-2H5v-2zM21 17h-2v2h-4v2h6v-4z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </div>
  );
};

const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
  const handlePrevious = useCallback(() => {
    onPageChange(Math.max(0, currentPage - 1));
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    onPageChange(Math.min(totalPages - 1, currentPage + 1));
  }, [currentPage, totalPages, onPageChange]);

  return (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-[90px] flex items-center gap-4">
      <button
        className="btn-circle-ghost"
        onClick={handlePrevious}
        disabled={currentPage === 0}
        aria-label="Previous page"
      >
        ‹
      </button>
      <span className="text-white/80 text-sm tabular-nums">
        {currentPage + 1} / {totalPages}
      </span>
      <button
        className="btn-circle-ghost"
        onClick={handleNext}
        disabled={currentPage >= totalPages - 1}
        aria-label="Next page"
      >
        ›
      </button>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const MeetingGrid: React.FC<Props> = ({
  pageSize = DEFAULT_PAGE_SIZE,
  bottomSafeAreaPx = DEFAULT_BOTTOM_SAFE_AREA,
  topSafeAreaPx = DEFAULT_TOP_SAFE_AREA,
}) => {
  const room = useRoomContext();
  const avatars = useMeetingStore(useShallow((s) => s.participants));
  const chatOpen = useMeetingStore((s) => s.chatOpen);

  // UI store
  const isWorkspaceOpen = useUIStore((s) => s.isWorkspacePanelOpen);
  const toggleWorkspacePanel = useUIStore((s) => s.toggleWorkspacePanel);
  const setMeetingControlsVisible = useUIStore((s) => s.setMeetingControlsVisible);

  // State
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(false);

  // Refs
  const wasSharingRef = useRef(false);

  // Collect all participants
  const allParticipants = useMemo(
    () => collectParticipants(room, avatars),
    [room, avatars]
  );

  // Get active screen share
  const screenRefs = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false }
  );

  const activeScreenShare = useMemo(() => {
    const ref = screenRefs.find((tr) => isTrackReference(tr));
    return isTrackReference(ref) ? ref : undefined;
  }, [screenRefs]);

  // Close workspace panel when screen sharing starts
  useEffect(() => {
    const isSharing = !!activeScreenShare;
    if (isSharing && !wasSharingRef.current && isWorkspaceOpen) {
      toggleWorkspacePanel();
    }
    wasSharingRef.current = isSharing;
  }, [activeScreenShare, isWorkspaceOpen, toggleWorkspacePanel]);

  // Control meeting controls visibility based on expansion
  useEffect(() => {
    setMeetingControlsVisible(!expanded || !activeScreenShare);
  }, [activeScreenShare, expanded, setMeetingControlsVisible]);

  // Determine grid mode
  const mode = useMemo(
    () => getGridMode(allParticipants.length),
    [allParticipants.length]
  );

  // Paginate participants
  const pages = useMemo(
    () => (mode === "many" ? chunk(allParticipants, pageSize) : [allParticipants]),
    [allParticipants, mode, pageSize]
  );

  // Reset page if out of bounds
  useEffect(() => {
    if (page >= pages.length && pages.length > 0) {
      setPage(pages.length - 1);
    }
  }, [pages.length, page]);

  const currentPageParticipants = pages[page] ?? [];
  const totalPages = pages.length;

  // Calculate padding based on screen share and expansion state
  const topPad = activeScreenShare ? (expanded ? 0 : topSafeAreaPx) : topSafeAreaPx;
  const bottomPad = activeScreenShare ? (expanded ? 0 : bottomSafeAreaPx) : bottomSafeAreaPx;
  const sidePadClass = activeScreenShare && !expanded ? "px-4 sm:px-6" : "px-0";

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div className="relative h-full w-full bg-[#202024]">
      <div
        className="relative mx-auto h-full w-full px-3 sm:px-0"
        style={{ paddingRight: chatOpen ? 408 : undefined }}
      >
        <div
          className={`h-full w-full flex items-center justify-center ${sidePadClass}`}
          style={{
            paddingTop: topPad,
            paddingBottom: bottomPad,
          }}
        >
          {activeScreenShare ? (
            <ScreenShareStage
              trackRef={activeScreenShare}
              expanded={expanded}
              onToggleExpand={toggleExpanded}
            />
          ) : (
            <>
              {mode === "one" && currentPageParticipants[0] && (
                <GridOne participant={currentPageParticipants[0]} />
              )}
              {mode === "five" && (
                <GridFive participants={currentPageParticipants} />
              )}
              {mode === "many" && (
                <GridMany participants={currentPageParticipants} />
              )}
            </>
          )}
        </div>

        {/* Pagination controls */}
        {mode === "many" && totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
};

export default MeetingGrid;