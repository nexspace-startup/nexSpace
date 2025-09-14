// src/components/meeting/MeetingGrid.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import type { Participant, Room } from "livekit-client";
import ProfileTile from "./ProfileTile";
import { useMeetingStore } from "../stores/meetingStore";
import { useShallow } from "zustand/react/shallow";

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
  // for (let i = 0; i < 1; i++) {
  //   arr.push({ sid: `mock-${i}`, identity: `mock-${i}`, name: `User ${i + 1}` });
  // }
  // out.push(...arr);
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type Props = {
  pageSize?: number;
  bottomSafeAreaPx?: number; // space reserved for controls
};

const MeetingGrid: React.FC<Props> = ({
  pageSize = 24,
  bottomSafeAreaPx = 120,
}) => {
  const room = useRoomContext();
  const avatars = useMeetingStore(useShallow((s) => s.participants));

  // Resolve LiveKit Participant objects in the same order as the store list
  const all = useMemo(() => collectParticipants(room, avatars), [room, avatars]);

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

  // If total pages change (usually shrink), keep the current page in range
  useEffect(() => {
    if (page > pages.length - 1) setPage(pages.length - 1);
  }, [pages.length, page]);

  const current = pages[Math.min(page, pages.length - 1)] ?? [];
  const totalPages = pages.length;

  const GridMany = useMemo(() =>
    function GridManyInner() {
      return (
        <div
          className="grid gap-x-2 gap-y-2 w-full"
          style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))", justifyItems: "center" }}
        >
          {current.map((p) => (
            <ProfileTile key={(p as any)?.sid ?? p.identity} participant={p} />
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
          <div className="grid place-items-center w-[424px] h-[463px]">
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
            className="grid gap-6 justify-items-center w-[424px] h-[463px]"
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

  return (
    <div className="relative h-full w-full bg-[#202024]">
      {/* Centered stage with your max width */}
      <div className="relative mx-auto h-full w-full max-w-[1000px] px-3 sm:px-0">
        {/* Keep space for the top pill and bottom controls */}
        <div
          className="h-full w-full flex items-center justify-center"
          style={{ paddingTop: 96, paddingBottom: bottomSafeAreaPx }}
        >
          {mode === "one" && <GridOne />}
          {mode === "five" && <GridFive />}
          {mode === "many" && <GridMany />}
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
