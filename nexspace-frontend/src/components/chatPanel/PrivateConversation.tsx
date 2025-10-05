import React, { forwardRef, useRef, useState, useEffect } from 'react';
import DaySeparator from '../DateSeperator';
import { shouldShowDaySeparator, getDayLabel, isMessageMine } from '../../utils/util';
import MessageItem from './MessageItem';
import type { ChatMessage, DMThreadPreview } from '../../stores/meetingStore';
import { useMeetingStore } from '../../stores/meetingStore';

interface PrivateConversationProps {
    selectedThread: DMThreadPreview;
    messages: ChatMessage[];
    myLivekitId?: string;
    myUserId?: string;
    selfAvatar?: string;
    initialsFrom: (name: string) => string;
    colorForParticipant: (sid: string, name: string) => string;
    isLight: (color: string) => boolean;
    retryMessage: (messageId: string) => void;
    loadChatHistory: (limit?: number, peerIdentity?: string | null) => Promise<void>;
}

const PrivateConversation = forwardRef<HTMLDivElement, PrivateConversationProps>(({
    selectedThread,
    messages,
    myLivekitId,
    myUserId,
    selfAvatar,
    initialsFrom,
    colorForParticipant,
    isLight,
    retryMessage,
    loadChatHistory,
}, ref) => {
    const avatarById = useMeetingStore((s) => s.avatarById);
    const scrollTimer = useRef<number | null>(null);
    const [scrolling, setScrolling] = useState(false);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [stickToBottom, setStickToBottom] = useState(true);

    const dmMessages = React.useMemo(() => {
        const currentUserId = myLivekitId || myUserId;
        if (!currentUserId) return [];
        return messages.filter(m =>
            m.recipientSid &&
            (
                (m.senderSid === currentUserId && m.recipientSid === selectedThread.peerId) ||
                (m.senderSid === selectedThread.peerId && m.recipientSid === currentUserId)
            )
        );
    }, [messages, selectedThread.peerId, myLivekitId, myUserId]);

    // Load DM history when thread is selected
    useEffect(() => {
        let cancelled = false;
        const loadDMHistory = async () => {
            setLoading(true);
            try {
                await loadChatHistory(100, selectedThread.peerId);
            } catch (error) {
                console.error('Failed to load DM history:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadDMHistory();
        return () => { cancelled = true; };
    }, [selectedThread.peerId, loadChatHistory]);

    // When switching to a new thread, default to stick to bottom
    useEffect(() => {
        setStickToBottom(true);
    }, [selectedThread.peerId]);

    // Scroll to bottom when user is near bottom (smart autoscroll)
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        if (stickToBottom) {
            el.scrollTop = el.scrollHeight;
        }
    }, [dmMessages.length, loading, selectedThread.peerId, stickToBottom]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-[#80889B]">Loading conversation...</div>
            </div>
        );
    }

    return (
        <div
            ref={(el) => {
                containerRef.current = el;
                if (typeof ref === 'function') ref(el as HTMLDivElement);
                else if (ref && 'current' in (ref as any)) (ref as any).current = el;
            }}
            onScroll={() => {
                if (!scrolling) setScrolling(true);
                const el = containerRef.current;
                if (el) {
                    const threshold = 160; // px from bottom considered "near bottom"
                    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                    setStickToBottom(distanceFromBottom <= threshold);
                }
                if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
                scrollTimer.current = window.setTimeout(() => setScrolling(false), 800);
            }}
            className={["relative flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-2 chat-scroll", scrolling ? "scrolling" : ""].join(" ")}
        >
            {dmMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center text-[#80889B]">
                        <div className="mb-2">No messages yet</div>
                        <div className="text-sm">Start a conversation with {selectedThread.peerName}</div>
                    </div>
                </div>
            ) : (
                dmMessages.map((message, index) => {
                    const previousMessage = index > 0 ? dmMessages[index - 1] : undefined;
                    const showDaySeparator = shouldShowDaySeparator(message, previousMessage);
                    const isMine = isMessageMine({ message, myLivekitId, myUserId });
                    const avatarUrl = isMine ? selfAvatar : (selectedThread.peerAvatar || avatarById[selectedThread.peerId]);
                    return (
                        <React.Fragment key={message.id}>
                            {showDaySeparator && (
                                <DaySeparator label={getDayLabel(message.ts)} />
                            )}
                            <MessageItem
                                message={message}
                                isMine={isMine}
                                avatarUrl={avatarUrl}
                                initialsFrom={initialsFrom}
                                colorForParticipant={colorForParticipant}
                                isLight={isLight}
                                onRetry={retryMessage}
                                showAvatar={true}
                                showSenderName={false} // Hide sender name in 1-on-1 DM
                                showTimestamp={true}
                            />
                        </React.Fragment>
                    );
                })
            )}

            {!stickToBottom && (
                <button
                    type="button"
                    onClick={() => {
                        const el = containerRef.current;
                        if (el) el.scrollTop = el.scrollHeight;
                        setStickToBottom(true);
                    }}
                    className="absolute right-3 bottom-3 w-10 h-10 grid place-items-center rounded-full bg-[#3D93F8] text-white shadow hover:bg-[#2F7FDE] focus:outline-none"
                    aria-label="Jump to latest"
                    title="Jump to latest"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M12 16.5a.75.75 0 0 1-.53-.22l-6-6a.75.75 0 1 1 1.06-1.06L12 14.69l5.47-5.47a.75.75 0 0 1 1.06 1.06l-6 6a.75.75 0 0 1-.53.22Z" clipRule="evenodd" />
                    </svg>
                    <span className="sr-only">Jump to latest</span>
                </button>
            )}
        </div>
    );
});

PrivateConversation.displayName = 'PrivateConversation';

export default React.memo(PrivateConversation);
