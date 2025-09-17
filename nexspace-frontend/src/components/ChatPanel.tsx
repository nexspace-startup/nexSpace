import React, { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMeetingStore, type MeetingState } from "../stores/meetingStore";
import { useUserStore } from "../stores/userStore";
import { initialsFrom } from "../utils/util";
import sendIcon from "../assets/send_icon.svg";
import { useUIStore } from "../stores/uiStore";

const ChatPanel: React.FC = () => {
  const { chatOpen, messages, toggleChat, sendMessage, retryMessage } = useMeetingStore(
    useShallow((s: MeetingState) => ({
      chatOpen: s.chatOpen,
      messages: s.messages,
      toggleChat: s.toggleChat,
      sendMessage: s.sendMessage,
      retryMessage: s.retryMessage,
    }))
  );
  const myLivekitId = useMeetingStore((s) => (s.room as any)?.localParticipant?.identity as string | undefined);
  const myUserId = useUserStore((s) => s.user?.id);

  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // collapse workspace panel while chat is open
  const toggleWorkspacePanel = useUIStore((s) => s.toggleWorkspacePanel);
  useEffect(() => {
    if (chatOpen) toggleWorkspacePanel(false);
  }, [chatOpen, toggleWorkspacePanel]);

  // position at bottom on open without smooth animation
  useEffect(() => {
    if (!chatOpen) return;
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatOpen]);

  const selfAvatar = useUserStore((s) => s.user?.avatar);

  useEffect(() => {
    if (!chatOpen) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatOpen, messages.length]);

  if (!chatOpen) return null;

  return (
    <aside
      className="absolute right-0 top-0 z-30 w-[360px] sm:w-[400px] h-dvh bg-[#18181B] border-l border-[#2A2B31] shadow-xl flex flex-col overflow-hidden"
      role="region"
      aria-label="Meeting chat"
    >
      <header className="flex items-center justify-between px-3 h-16 border-b border-[#2A2B31] text-[#C2C8D1]">
        <div className="font-medium">Chat</div>
        <button onClick={toggleChat} className="text-[#80889B] hover:text-[#C2C8D1] px-3" aria-label="Close chat">✕</button>
      </header>
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.map((m) => {
          const status = (m as any).status ?? ('success' as 'pending' | 'success' | 'failed');
          const isMine = m.isLocal || (myLivekitId && String(m.senderSid) === String(myLivekitId)) || (myUserId && String(m.senderSid) === String(myUserId));
          const bubbleBase = isMine ? 'bg-[rgba(66,133,244,0.13)] text-[#FFFFFF]' : 'bg-[rgba(128,136,155,0.13)] text-[#FFFFFF]';
          const bubbleStatus = status === 'pending' ? 'opacity-60' : '';
          const avatarUrl = isMine ? selfAvatar : undefined; // extend later when remote avatars available
          const nameInitials = initialsFrom(m.senderName);
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && (
                <div className="w-6 h-6 rounded-full overflow-hidden bg-[#23252B] grid place-items-center flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={m.senderName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-semibold text-white/90">{nameInitials}</span>
                  )}
                </div>
              )}
              <div className={`max-w-[80%] ${isMine ? 'text-right' : ''}`}>
                {!isMine && (
                  <div className="text-[11px] text-[#80889B] mb-0.5">{m.senderName}</div>
                )}
                <div
                  className={`inline-block ${bubbleBase} ${bubbleStatus} rounded-lg px-3 py-1.5 whitespace-pre-wrap break-words`}
                  title={status === 'pending' ? 'Sending…' : status === 'failed' ? 'Failed to send' : ''}
                >
                  {m.text}
                </div>
                {isMine && status === 'pending' && (
                  <div className="text-[11px] text-[#80889B] mt-0.5">Sending…</div>
                )}
                {isMine && status === 'failed' && (
                  <span className="inline-flex items-center ml-1 align-middle gap-2">
                    <span className="text-red-500 font-bold" aria-label="Message failed" title="Message failed to send">!</span>
                    <button
                      type="button"
                      className="text-xs text-[#C2C8D1] hover:text-white underline"
                      onClick={() => retryMessage(m.id)}
                    >
                      Retry
                    </button>
                  </span>
                )}
              </div>
              {isMine && (
                <div className="w-6 h-6 rounded-full overflow-hidden bg-[#23252B] grid place-items-center flex-shrink-0">
                  {selfAvatar ? (
                    <img src={selfAvatar} alt="You" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-semibold text-white/90">{initialsFrom(m.senderName)}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          await sendMessage(t);
          setText("");
          setTimeout(() => {
            const el = listRef.current; if (el) el.scrollTop = el.scrollHeight;
          }, 0);
        }}
        className="border-t border-[#2A2B31] h-16 px-4 py-4"
      >
        <div className="flex items-center gap-2 h-full">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
            className="flex-1 h-12 bg-[#23252B] text-[#E6EAF0] placeholder-[#80889B] rounded-xl px-3 outline-none focus:ring-1 focus:ring-[#3D93F8]"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className={`h-12 w-12 grid place-items-center rounded-xl bg-[#3D93F8] text-white disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label="Send message"
            title="Send"
          >
            <img src={sendIcon} alt="Send" className="w-5 h-5" />
          </button>
        </div>
      </form>
    </aside>
  );
};

export default ChatPanel;
