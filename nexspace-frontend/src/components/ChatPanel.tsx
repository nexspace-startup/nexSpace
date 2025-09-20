import React, { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMeetingStore, type MeetingState } from "../stores/meetingStore";
import { useUserStore } from "../stores/userStore";
import { initialsFrom } from "../utils/util";
import sendIcon from "../assets/send_icon.svg";
import { useUIStore } from "../stores/uiStore";

// Color palette for participant accents (names + fallback avatars)
// Includes provided colors and 5 complementary hues suited for dark UI
const NAME_COLORS = [
  "#04C97A", // teal-green
  "#B69AFF", // soft purple
  "#ED5C5B", // coral red
  "#3D93F8", // blue
  "#F59E0B", // amber
  "#7BD3FF", // sky
  "#FF76A7", // pink
  "#7BDFA1", // mint
] as const;

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

function colorForParticipant(id?: string, name?: string): string {
  const key = String(id || name || "");
  const idx = key ? hashString(key) % NAME_COLORS.length : 0;
  return NAME_COLORS[idx];
}

function isLight(hex: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return false;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  // relative luminance
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6;
}

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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollTimer = useRef<number | null>(null);
  const [scrolling, setScrolling] = useState(false);

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

  // Auto-grow message input up to MAX height, then allow internal scroll (hidden until scrolling)
  const MAX_INPUT_HEIGHT = 230;
  const inputScrollTimer = useRef<number | null>(null);
  const [inputScrolling, setInputScrolling] = useState(false);

  const resizeInput = () => {
    const el = inputRef.current; if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(MAX_INPUT_HEIGHT, el.scrollHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > next ? 'auto' : 'hidden';
  };

  useEffect(() => {
    if (!chatOpen) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatOpen, messages.length]);

  // Resize input when chat opens or text changes
  useEffect(() => { if (chatOpen) resizeInput(); }, [chatOpen]);
  useEffect(() => { resizeInput(); }, [text]);
  useEffect(() => () => { if (inputScrollTimer.current) window.clearTimeout(inputScrollTimer.current); }, []);

  // Send helper reused by submit and Enter key
  const handleSend = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await sendMessage(t);
    setTimeout(() => {
      const el = listRef.current; if (el) el.scrollTop = el.scrollHeight;
    }, 0);
    setTimeout(() => resizeInput(), 0);
  };

  useEffect(() => () => { if (scrollTimer.current) window.clearTimeout(scrollTimer.current); }, []);

  if (!chatOpen) return null;

  return (
    <aside
      className="absolute right-0 top-0 z-30 w-full max-w-[400px] h-dvh bg-[#18181B] border-l border-[#2A2B31] shadow-xl flex flex-col overflow-hidden"
      role="region"
      aria-label="Meeting chat"
    >
      <header className="flex items-center justify-between px-3 h-16 border-b border-[#2A2B31] text-[#C2C8D1]">
        <div className="font-medium">Chat</div>
        <button onClick={toggleChat} className="text-[#80889B] hover:text-[#C2C8D1] px-3" aria-label="Close chat">✕</button>
      </header>
      <div
        ref={listRef}
        onScroll={() => {
          if (!scrolling) setScrolling(true);
          if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
          scrollTimer.current = window.setTimeout(() => setScrolling(false), 800);
        }}
        className={["flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-2 chat-scroll", scrolling ? "scrolling" : ""].join(" ")}
      >
        {messages.map((m) => {
          const status = (m as any).status ?? ('success' as 'pending' | 'success' | 'failed');
          const isMine = m.isLocal || (myLivekitId && String(m.senderSid) === String(myLivekitId)) || (myUserId && String(m.senderSid) === String(myUserId));
          const bubbleBase = isMine ? 'bg-[rgba(66,133,244,0.13)] text-[#FFFFFF]' : 'bg-[rgba(128,136,155,0.13)] text-[#FFFFFF]';
          const bubbleStatus = status === 'pending' ? 'opacity-60' : '';
          const avatarUrl = isMine ? selfAvatar : undefined; // extend later when remote avatars available
          const nameInitials = initialsFrom(m.senderName);
          const accent = colorForParticipant(m.senderSid, m.senderName);
          const textOnAccent = isLight(accent) ? '#0F1216' : '#FFFFFF';
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && (
                <div className="w-6 h-6 rounded-full overflow-hidden grid self-start place-items-center flex-shrink-0" style={{ backgroundColor: accent }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={m.senderName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-semibold" style={{ color: textOnAccent }}>{nameInitials}</span>
                  )}
                </div>
              )}
              <div className={`max-w-[80%]`}>
                {!isMine && (
                  <div className="text-[11px] mb-0.5" style={{ color: accent }}>{m.senderName}</div>
                )}
                <div
                  className={`inline-block max-w-full ${bubbleBase} ${bubbleStatus} rounded-lg px-3 py-1.5 whitespace-pre-wrap break-words text-left`}
                  style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' as any }}
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
                <div className="w-6 h-6 rounded-full overflow-hidden grid self-start place-items-center flex-shrink-0" style={{ backgroundColor: accent }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-semibold" style={{ color: textOnAccent }}>{nameInitials}</span>
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
          await handleSend();
        }}
        className="border-t border-[#2A2B31] px-4 py-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                await handleSend();
              }
            }}
            onScroll={() => {
              if (!inputScrolling) setInputScrolling(true);
              if (inputScrollTimer.current) window.clearTimeout(inputScrollTimer.current);
              inputScrollTimer.current = window.setTimeout(() => setInputScrolling(false), 800);
            }}
            placeholder="Type a message"
            rows={1}
            className={[
              "flex-1 min-h-[44px] max-h-[230px] resize-none bg-[#23252B] text-[#E6EAF0]",
              "placeholder-[#80889B] rounded-xl px-3 py-3 outline-none focus:ring-1 focus:ring-[#3D93F8]",
              "chat-scroll",
              inputScrolling ? "scrolling" : "",
            ].join(" ")}
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
