// src/components/meeting/MeetingGrid.tsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRoomContext, useTracks, VideoTrack, isTrackReference } from "@livekit/components-react";
import type { Participant, Room } from "livekit-client";
import { Track } from "livekit-client";
import ProfileTile from "./ProfileTile";
import { useMeetingStore } from "../stores/meetingStore";
import { useShallow } from "zustand/react/shallow";
import { useUIStore } from "../stores/uiStore";

const CROSS_COUNT = 5 as const;

function collectParticipants(
  room: Room | null | undefined,
  ids: { id: string }[]
): Participant[] {
  if (!room) return [];
  const localId = (room.localParticipant as any)?.sid ?? room.localParticipant.identity;
  const remote = Array.from(room.remoteParticipants?.values?.() ?? []);
  const map = new Map<string, Participant>();
  map.set(localId, room.localParticipant);
  for (const rp of remote) {
    const key = (rp as any)?.sid ?? rp.identity;
    map.set(key, rp);
  }
  const out: Participant[] = [];
  for (const a of ids) {
    const p = map.get(a.id);
    if (p) out.push(p);
  }
  //test data to test meeting grid layouts
  // const arr: any[] = [];
  // for (let i = 0; i < 29; i++) {
  //   arr.push({ sid: `mock-${i}`, identity: `mock-${i}`, name: `User ${i + 1}` });
  // }
  // out.push(...arr);
  return out;
}

function getTeamsDims(n: number) {
  if (n <= 1) return { rows: 1, cols: 1 };   // 1
  if (n <= 4) return { rows: 2, cols: 2 };   // 2..4  -> 2x2
  if (n <= 9) return { rows: 3, cols: 3 };   // 5..9  -> 3x3
  if (n <= 16) return { rows: 4, cols: 4 };  // 10..16 -> 4x4
  if (n <= 20) return { rows: 4, cols: 5 };  // 17..20 -> 4x5
  return { rows: 4, cols: 6 };               // 21..24 -> 4x6 (max on a page)
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type Props = {
  pageSize?: number;
  bottomSafeAreaPx?: number;
  topSafeAreaPx?: number;
};

const MeetingGrid: React.FC<Props> = ({
  pageSize = 24,
  bottomSafeAreaPx = 120,
  topSafeAreaPx = 96,
}) => {
  const room = useRoomContext();
  const avatars = useMeetingStore(useShallow((s) => s.participants));
  const chatOpen = useMeetingStore((s) => s.chatOpen);

  // Workspace panel UI store
  const isWorkspaceOpen = useUIStore((s) => s.isWorkspacePanelOpen);
  const toggleWorkspacePanel = useUIStore((s) => s.toggleWorkspacePanel);

  // Resolve participants
  const all = useMemo(() => collectParticipants(room, avatars), [room, avatars]);

  // Active screen share (first one; includes local)
  const screenRefs = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false }
  );
  const activeScreen = useMemo(() => {
    const ref = screenRefs.find((tr) => isTrackReference(tr));
    return isTrackReference(ref) ? ref : undefined;
  }, [screenRefs]);

  // Close workspace panel once when sharing starts
  const wasSharingRef = useRef(false);
  useEffect(() => {
    const isSharing = !!activeScreen;
    if (isSharing && !wasSharingRef.current && isWorkspaceOpen) {
      toggleWorkspacePanel();
    }
    wasSharingRef.current = isSharing;
  }, [activeScreen, isWorkspaceOpen, toggleWorkspacePanel]);

  // Expand/minimize state for stage
  const [expanded, setExpanded] = useState(false);


  const { mode, items } = useMemo(() => {
    const n = all.length;
    if (n <= 1) return { mode: "one" as const, items: all };
    if (n === CROSS_COUNT) return { mode: "five" as const, items: all };
    return { mode: "many" as const, items: all };
  }, [all]);

  const pages = useMemo(
    () => (mode === "many" ? chunk(items, pageSize) : [items]),
    [items, mode, pageSize]
  );

  const [page, setPage] = useState(0);
  useEffect(() => {
    if (page > pages.length - 1) setPage(pages.length - 1);
  }, [pages.length, page]);

  const current = pages[Math.min(page, pages.length - 1)] ?? [];
  const totalPages = pages.length;

  const GridMany = useMemo(
    () =>
      function GridManyInner() {
        const n = current.length;
        const { rows, cols } = getTeamsDims(n);
        const totalCells = rows * cols;
        const ghosts = totalCells - n; // invisible placeholders to keep the rectangle

        return (
          <div
            className="
            grid w-full max-w-screen-xl mx-auto
            gap-2 sm:gap-3
            place-content-center justify-items-center
          "
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {current.map((p) => (
              <ProfileTile key={(p as any)?.sid ?? p.identity} participant={p} />
            ))}

            {/* Ghost cells so the grid keeps NxM shape and stays centered */}
            {Array.from({ length: ghosts }).map((_, i) => (
              <div key={`ghost-${i}`} className="opacity-0 pointer-events-none" />
            ))}
          </div>
        );
      },
    [current]
  );


  const GridOne = useMemo(
    () =>
      function GridOneInner() {
        return (
          <div className="grid place-items-center w-full max-w-[424px] h-[463px]">
            {current[0] && <ProfileTile participant={current[0]} />}
          </div>
        );
      },
    [current]
  );

  const GridFive = useMemo(
    () =>
      function GridFiveInner() {
        const [pTop, pLeft, pCenter, pRight, pBottom] = current;
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
            <div style={{ gridArea: "top" }}>{pTop && <ProfileTile participant={pTop} />}</div>
            <div style={{ gridArea: "left" }}>{pLeft && <ProfileTile participant={pLeft} />}</div>
            <div style={{ gridArea: "center" }}>{pCenter && <ProfileTile participant={pCenter} />}</div>
            <div style={{ gridArea: "right" }}>{pRight && <ProfileTile participant={pRight} />}</div>
            <div style={{ gridArea: "bottom" }}>{pBottom && <ProfileTile participant={pBottom} />}</div>
          </div>
        );
      },
    [current]
  );

  // Safe-area paddings: keep margins when sharing but not expanded; remove when expanded
  const topPad = activeScreen ? (expanded ? 0 : topSafeAreaPx) : topSafeAreaPx;
  const bottomPad = activeScreen ? (expanded ? 0 : bottomSafeAreaPx) : bottomSafeAreaPx;
  // Side padding for the stage container (left/right)
  const sidePadClass = activeScreen && !expanded ? "px-4 sm:px-6" : "px-0";

  // Rounded corners only when not expanded
  const stageRoundClass = expanded ? "rounded-none" : "rounded-xl";

  return (
    <div className="relative h-full w-full bg-[#202024]">
      {/* Full width; keep right pad for chat */}
      <div
        className="relative mx-auto h-full w-full px-3 sm:px-0"
        style={{ paddingRight: chatOpen ? 408 : undefined }}
      >
        {/* Keep space for the top pill and bottom controls OR none if expanded */}
        <div
          className={`h-full w-full flex items-center justify-center ${sidePadClass}`}
          style={{
            paddingTop: topPad,
            paddingBottom: bottomPad,
          }}
        >
          {activeScreen ? (
            <div className={`relative w-full h-full overflow-hidden bg-black ${stageRoundClass}`}>
              <VideoTrack
                trackRef={activeScreen}
                className="!w-full !h-full object-contain"
                data-lk-object-fit="contain"
              />
              <div className="absolute left-3 top-3 px-2 py-1 rounded bg-black/50 text-white text-xs">
                Presenting:{" "}
                {((activeScreen as any)?.participant?.name) ||
                  ((activeScreen as any)?.participant?.identity) ||
                  "Screen"}
              </div>

              {/* Expand / Minimize button */}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 hover:bg-black/70 text-white grid place-items-center shadow-md"
                aria-label={expanded ? "Minimize presentation" : "Expand presentation"}
                title={expanded ? "Minimize" : "Expand"}
              >
                {expanded ? (
                  // Minimize icon (inwards arrows)
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 3v2H5v4H3V3h6zM21 9h-2V5h-4V3h6v6zM3 15h2v4h4v2H3v-6zM15 21v-2h4v-4h2v6h-6z" fill="currentColor" />
                  </svg>
                ) : (
                  // Expand icon (outwards arrows)
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 3H3v6h2V5h4V3zM21 3h-6v2h4v4h2V3zM5 17H3v4h6v-2H5v-2zM21 17h-2v2h-4v2h6v-4z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
          ) : (
            <>
              {mode === "one" && <GridOne />}
              {mode === "five" && <GridFive />}
              {mode === "many" && <GridMany />}
            </>
          )}
        </div>

        {/* Pagination for many */}
        {mode === "many" && totalPages > 1 && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[90px] flex items-center gap-4">
            <button
              className="btn-circle-ghost"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span className="text-white/80 text-sm tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              className="btn-circle-ghost"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingGrid;
