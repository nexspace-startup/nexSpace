import React, { useEffect, useMemo, useState } from 'react';
import type { DMThreadPreview } from '../../stores/meetingStore';
import { useMeetingStore } from '../../stores/meetingStore';
import { getDayLabel } from '../../utils/util';
import { useWorkspaceStore, type WorkspaceMember } from '../../stores/workspaceStore';

interface PrivateChatProps {
    dmThreads: DMThreadPreview[];
    myUserId?: string;
    initialsFrom: (name: string) => string;
    colorForParticipant: (sid: string, name: string) => string;
    isLight: (color: string) => boolean;
    markDMRead: (threadId: string) => void;
    onThreadSelect?: (thread: DMThreadPreview) => void;
}


const PrivateChat: React.FC<PrivateChatProps> = ({
    dmThreads,
    myUserId,
    initialsFrom,
    colorForParticipant,
    isLight,
    markDMRead,
    onThreadSelect,
}) => {
    const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
    const avatarById = useMeetingStore((s) => s.avatarById);
    const activeWorkspaceMembers = useWorkspaceStore((s) => s.activeWorkspaceMembers);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<WorkspaceMember[]>([]);
    const [err, setErr] = useState<string | null>(null);
    const filteredResults = useMemo(() =>
        results.filter(r => !myUserId || String(r.id) !== String(myUserId)),
        [results, myUserId]
    );

    // Debounced search
    useEffect(() => {
        let cancelled = false;
        let t: number | undefined;
        const run = async () => {
            if (!activeWorkspaceId) return;
            const q = query.trim();
            if (!q) { setResults([]); setSearching(false); setErr(null); return; }
            setSearching(true);
            setErr(null);
            try {
                const filteredMembers = activeWorkspaceMembers?.filter(m => m.name.toLowerCase().includes(q.toLowerCase()));
                setResults(filteredMembers || []);
            } catch (e: any) {
                if (!cancelled) { setErr(e?.message ?? 'Search failed'); setResults([]); }
            } finally {
                if (!cancelled) setSearching(false);
            }
        };
        t = window.setTimeout(run, 300);
        return () => { cancelled = true; if (t) window.clearTimeout(t); };
    }, [query, activeWorkspaceId]);

    const handleThreadClick = (thread: DMThreadPreview) => {
        if (thread.unread && thread.unread > 0) {
            markDMRead(thread.peerId);
        }
        onThreadSelect?.(thread);
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search input */}
            <div className="p-3 border-b border-[rgba(128,136,155,0.1)]">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people"
                    className="w-full bg-[#23252B] text-[#E6EAF0] placeholder-[#80889B] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#3D93F8]"
                />
            </div>

            {/* Results or Threads */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {query.trim() ? (
                    <div className="space-y-0">
                        {searching && (
                            <div className="p-4 text-[#80889B] text-sm">Searching…</div>
                        )}
                        {!searching && err && (
                            <div className="p-4 text-[#80889B] text-sm">{err}</div>
                        )}
                        {!searching && !err && filteredResults.length === 0 && (
                            <div className="p-4 text-[#80889B] text-sm">No matches</div>
                        )}
                        {!searching && !err && filteredResults.map((u) => {
                            const accent = colorForParticipant(u.id, u.name);
                            const textOnAccent = isLight(accent) ? '#0F1216' : '#FFFFFF';
                            const nameInitials = initialsFrom(u.name);
                            const avatar = avatarById[String(u.id)];
                            return (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => {
                                        const thread: DMThreadPreview = { peerId: u.id, peerName: u.name, text: '', ts: undefined, unread: 0 };
                                        onThreadSelect?.(thread);
                                        setResults([]);
                                        setQuery('');
                                    }}
                                    className="w-full px-4 py-3 hover:bg-[rgba(128,136,155,0.08)] transition-colors duration-150 text-left border-b border-[rgba(128,136,155,0.1)]"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-full overflow-hidden grid place-items-center flex-shrink-0 mt-1" style={{ backgroundColor: accent }}>
                                            {avatar ? (
                                                <img src={avatar} alt={u.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-sm font-semibold" style={{ color: textOnAccent }}>{nameInitials}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-[#FFFFFF] font-medium text-sm truncate">{u.name}</h3>
                                            </div>
                                            <p className="text-[#9AA3B2] text-sm truncate pr-2 leading-relaxed">Start a conversation</p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-0">
                        {dmThreads.map((thread) => {
                            const accent = colorForParticipant(thread.peerId, thread.peerName);
                            const textOnAccent = isLight(accent) ? '#0F1216' : '#FFFFFF';
                            const nameInitials = initialsFrom(thread.peerName);
                            const threadAvatar = thread.peerAvatar || avatarById[thread.peerId];

                            return (
                                <button
                                    key={thread.peerId}
                                    type="button"
                                    onClick={() => handleThreadClick(thread)}
                                    className="w-full px-4 py-3 hover:bg-[rgba(128,136,155,0.08)] transition-colors duration-150 text-left border-b border-[rgba(128,136,155,0.1)]"
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div
                                            className="w-12 h-12 rounded-full overflow-hidden grid place-items-center flex-shrink-0 mt-1"
                                            style={{ backgroundColor: accent }}
                                        >
                                            {threadAvatar ? (
                                                <img
                                                    src={threadAvatar}
                                                    alt={thread.peerName}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span
                                                    className="text-sm font-semibold"
                                                    style={{ color: textOnAccent }}
                                                >
                                                    {nameInitials}
                                                </span>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <h3 className="text-[#FFFFFF] font-medium text-sm truncate">
                                                    {thread.peerName}
                                                </h3>
                                                <span className="text-[#80889B] text-xs font-medium flex-shrink-0 ml-2">
                                                    {thread.ts && getDayLabel(thread.ts)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <p className="text-[#9AA3B2] text-sm truncate pr-2 leading-relaxed">
                                                    {thread.text}
                                                </p>
                                                {thread.unread > 0 && (
                                                    <span className="bg-[#3D93F8] text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-2 flex-shrink-0">
                                                        {thread.unread > 99 ? '99+' : thread.unread}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(PrivateChat);
