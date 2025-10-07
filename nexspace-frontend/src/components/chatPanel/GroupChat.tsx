import React, { forwardRef, useMemo, useRef, useState, useEffect } from 'react';
import DaySeparator from '../DateSeperator';
import { shouldShowDaySeparator, getDayLabel, isMessageMine } from '../../utils/util';
import MessageItem from './MessageItem';
import type { ChatMessage } from '../../stores/meetingStore';
import { useMeetingStore } from '../../stores/meetingStore';

interface GroupChatProps {
    messages: ChatMessage[];
    myLivekitId?: string;
    myUserId?: string;
    selfAvatar?: string;
    initialsFrom: (name: string) => string;
    colorForParticipant: (sid: string, name: string) => string;
    isLight: (color: string) => boolean;
    retryMessage: (messageId: string) => void;
}

const GroupChat = forwardRef<HTMLDivElement, GroupChatProps>(({ 
    messages,
    myLivekitId,
    myUserId,
    selfAvatar,
    initialsFrom,
    colorForParticipant,
    isLight,
    retryMessage,
}, ref) => {
    // Live avatar mapping hydrated from presence/profile broadcasts
    const avatarById = useMeetingStore((s) => s.avatarById);
    const scrollTimer = useRef<number | null>(null);
    const [scrolling, setScrolling] = useState(false);
    const [stickToBottom, setStickToBottom] = useState(true);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // Filter to only show group messages (messages without recipientSid)
    const groupMessages = useMemo(() => messages.filter(message => !message.recipientSid), [messages]);

    // Smart autoscroll: only stick when user is near bottom
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        if (stickToBottom) {
            el.scrollTop = el.scrollHeight;
        }
    }, [groupMessages.length, stickToBottom]);
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
                    const threshold = 160;
                    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                    setStickToBottom(distanceFromBottom <= threshold);
                }
                if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
                scrollTimer.current = window.setTimeout(() => setScrolling(false), 800);
            }}
            className={["relative flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-2 chat-scroll", scrolling ? "scrolling" : ""].join(" ")}
        >

            {groupMessages.length === 0 ? (<div className="flex items-center justify-center h-full">
                <div className="text-center text-[#80889B]">
                    <div className="mb-2">No messages yet</div>
                    <div className="text-sm">Start a conversation</div>
                </div>
            </div>) :
                groupMessages.map((message, index) => {
                    const previousMessage = index > 0 ? groupMessages[index - 1] : undefined;
                    const showDaySeparator = shouldShowDaySeparator(message, previousMessage);
                    const isMine = isMessageMine({ message, myLivekitId, myUserId }) || false;
                    // Prefer self avatar for my messages, otherwise look up sender's avatar from store
                    const avatarUrl = isMine ? selfAvatar : avatarById?.[String(message.senderSid)];

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
                                showSenderName={true}
                                showTimestamp={true}
                            />
                        </React.Fragment>
                    );
                })}

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

GroupChat.displayName = 'GroupChat';

export default React.memo(GroupChat);
