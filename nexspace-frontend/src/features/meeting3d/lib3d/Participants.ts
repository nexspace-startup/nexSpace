export type Participant = { id: string; name?: string };

// Stable assignment: keep prior seats when possible, fill gaps from front, avoid reshuffle unless seat count shrinks below occupied.
export function assignParticipantsToDesks(
    participants: Participant[] = [],
    previous: Map<string, number>,
    seatCapacity: number
): Map<string, number> {
    const next = new Map<string, number>();
    const used = new Set<number>();

    // 1) keep existing seat if still valid
    for (const p of participants) {
        const prevIdx = previous.get(p.id);
        if (prevIdx != null && prevIdx < seatCapacity) {
            next.set(p.id, prevIdx); used.add(prevIdx);
        }
    }
    // 2) assign new/seatless to the earliest free seat
    let cursor = 0;
    const takeNextFree = (): number | undefined => {
        while (cursor < seatCapacity) { if (!used.has(cursor)) { used.add(cursor); return cursor++; } cursor++; }
        return undefined;
    };
    for (const p of participants) {
        if (!next.has(p.id)) {
            const idx = takeNextFree();
            if (idx != null) next.set(p.id, idx);
        }
    }
    return next;
}
