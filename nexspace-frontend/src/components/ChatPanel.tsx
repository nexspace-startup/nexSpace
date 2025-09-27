import React, { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMeetingStore, type DMThreadPreview, type MeetingState } from "../stores/meetingStore";
import { useUserStore } from "../stores/userStore";
import { initialsFrom } from "../utils/util";
import sendIcon from "../assets/send_icon.svg";
import { useUIStore } from "../stores/uiStore";
import GroupChat from "./chatPanel/GroupChat";
import PrivateChat from "./chatPanel/PrivateChat";
import PrivateConversation from "./chatPanel/PrivateConversation";
import back_icon from "../assets/back_icon.svg"

// Color palette for participant accents (names + fallback avatars)
const NAME_COLORS = [
  "#E6E6E6",
  "#66CCFF",
  "#FF9966",
  "#99FF99",
  "#FFFF66",
  "#FF6699",
  "#CC99FF",
  "#33FFFF",
  "#FFCC66",
  "#FF6666",
  "#66FFCC",
  "#CCCCFF",
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
  const {
    chatOpen,
    messages,
    toggleChat,
    sendMessage,
    retryMessage,
    loadChatHistory,
    loadDMThreads,
    markDMRead,
    setActiveDMPeer,
    dmThreadsFromServer
  } = useMeetingStore(
    useShallow((s: MeetingState) => ({
      chatOpen: s.chatOpen,
      messages: s.messages,
      toggleChat: s.toggleChat,
      sendMessage: s.sendMessage,
      retryMessage: s.retryMessage,
      loadChatHistory: s.loadChatHistory,
      loadDMThreads: s.loadDMThreads,
      markDMRead: s.markDMRead,
      setActiveDMPeer: s.setActiveDMPeer,
      dmThreadsFromServer: s.dmThreads,
    }))
  );
  const selfAvatar = useUserStore((s) => s.user?.avatar);
  const myLivekitId = useMeetingStore((s) => (s.room as any)?.localParticipant?.identity as string | undefined);
  const myUserId = useUserStore((s) => s.user?.id);

  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollTimer = useRef<number | null>(null);
  const [mode, setMode] = useState<"private" | "group">("group");
  const [selectedThread, setSelectedThread] = useState<DMThreadPreview | null>(null);

  useEffect(() => {
    if (chatOpen) {
      loadChatHistory();
      loadDMThreads();
    }
  }, [chatOpen, loadChatHistory, loadDMThreads]);

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
  }, [chatOpen, mode]);

  // Auto-grow message input up to MAX height, then allow internal scroll
  const MAX_INPUT_HEIGHT = 230;
  const inputScrollTimer = useRef<number | null>(null);
  const [inputScrolling, setInputScrolling] = useState(false);

  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(MAX_INPUT_HEIGHT, el.scrollHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > next ? 'auto' : 'hidden';
  };

  // Child components handle list autoscroll on new messages.

  // Also scroll when switching to a specific DM or toggling modes
  useEffect(() => {
    if (!chatOpen) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatOpen, mode, selectedThread?.peerId]);

  // Resize input when chat opens or text changes
  useEffect(() => { if (chatOpen) resizeInput(); }, [chatOpen]);
  useEffect(() => { resizeInput(); }, [text]);
  useEffect(() => () => { if (inputScrollTimer.current) window.clearTimeout(inputScrollTimer.current); }, []);

  // Send helper reused by submit and Enter key
  const handleSend = useCallback(async () => {
    const t = text.trim();
    if (!t) return;
    setText("");

    // Send DM if in private mode with selected thread
    const recipientId = mode === "private" && selectedThread ? selectedThread.peerId : undefined;
    console.log(selectedThread);
    await sendMessage(t, recipientId);
    setTimeout(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
    setTimeout(() => resizeInput(), 0);
  }, [text, mode, selectedThread, sendMessage]);

  // Calculate unread counts (you can implement this based on your store structure)
  const dmUnreadTotal = dmThreadsFromServer?.reduce((total, thread) => total + (thread.unread || 0), 0) || 0;

  const handleThreadSelect = React.useCallback((thread: DMThreadPreview) => {
    setSelectedThread(thread);
    // Mark as read when selecting
    setActiveDMPeer(thread.peerId);
    if (thread.unread && thread.unread > 0) {
      markDMRead(thread.peerId);
    }
  }, [markDMRead]);

  const handleBackToThreads = React.useCallback(() => {
    setSelectedThread(null);
    setActiveDMPeer(null)
  }, []);

  useEffect(() => () => { if (scrollTimer.current) window.clearTimeout(scrollTimer.current); }, []);

  if (!chatOpen) return null;

  // Show input for group mode or when in a DM conversation
  const showInput = mode === "group" || (mode === "private" && selectedThread);

  return (
    <aside
      className="absolute right-0 top-0 z-30 w-full max-w-[400px] h-dvh bg-[#18181B] border-l border-[#2A2B31] shadow-xl flex flex-col overflow-hidden"
      role="region"
      aria-label="Meeting chat"
    >
      <header className="flex items-center justify-between px-3 h-16 border-b border-[#2A2B31] text-[#C2C8D1]">
        {mode === "private" && selectedThread ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToThreads}
              className="text-[#80889B] hover:text-[#C2C8D1] p-2"
              aria-label="Back to threads"
            >
              <img src={back_icon} alt="Back" className="w-4 h-4" />
            </button>
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full overflow-hidden grid place-items-center flex-shrink-0"
              style={{ backgroundColor: colorForParticipant(selectedThread.peerId, selectedThread.peerName) }}
            >
              {selectedThread.peerAvatar ? (
                <img
                  src={selectedThread.peerAvatar}
                  alt={selectedThread.peerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="text-xs font-semibold"
                  style={{ color: isLight(colorForParticipant(selectedThread.peerId, selectedThread.peerName)) ? '#0F1216' : '#FFFFFF' }}
                >
                  {initialsFrom(selectedThread.peerName)}
                </span>
              )}
            </div>
            <div className="text-[#FFFFFF] font-medium text-sm truncate">
              {selectedThread.peerName}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="font-medium">Chat</div>
            <div className="ml-2 flex items-center gap-1 bg-[#1F2126] rounded-full p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("group");
                  setSelectedThread(null);
                }}
                className={[
                  "px-3 py-1 text-sm rounded-full flex items-center gap-1",
                  mode === "group"
                    ? "bg-[#2B2E34] text-white"
                    : "text-[#9AA3B2] hover:text-white",
                ].join(" ")}
                aria-pressed={mode === "group"}
              >
                Group
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("private");
                  setSelectedThread(null);
                }}
                className={[
                  "px-3 py-1 text-sm rounded-full flex items-center gap-1",
                  mode === "private"
                    ? "bg-[#2B2E34] text-white"
                    : "text-[#9AA3B2] hover:text-white",
                ].join(" ")}
                aria-pressed={mode === "private"}
              >
                Private
                {dmUnreadTotal > 0 && (
                  <span className="bg-[#3D93F8] text-white text-xs font-semibold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 ml-1">
                    {dmUnreadTotal > 99 ? '99+' : dmUnreadTotal}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        <button onClick={toggleChat} className="text-[#80889B] hover:text-[#C2C8D1] px-3" aria-label="Close chat">✕</button>
      </header>

      {mode === "group" && (
        <GroupChat
          ref={listRef}
          messages={messages}
          myLivekitId={myLivekitId}
          myUserId={myUserId}
          selfAvatar={selfAvatar}
          initialsFrom={initialsFrom}
          colorForParticipant={colorForParticipant}
          isLight={isLight}
          retryMessage={retryMessage}
        />
      )}

      {mode === "private" && !selectedThread && (
        <PrivateChat
          dmThreads={dmThreadsFromServer || []}
          myUserId={myUserId}
          initialsFrom={initialsFrom}
          colorForParticipant={colorForParticipant}
          isLight={isLight}
          markDMRead={markDMRead}
          onThreadSelect={handleThreadSelect}
        />
      )}

      {mode === "private" && selectedThread && (
        <PrivateConversation
          ref={listRef}
          selectedThread={selectedThread}
          messages={messages}
          myLivekitId={myLivekitId}
          myUserId={myUserId}
          selfAvatar={selfAvatar}
          initialsFrom={initialsFrom}
          colorForParticipant={colorForParticipant}
          isLight={isLight}
          retryMessage={retryMessage}
          loadChatHistory={loadChatHistory}
        />
      )}

      {showInput && (
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
              placeholder={`Type a ${mode === "private" && selectedThread ? "private" : "group"} message`}
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
      )}
    </aside>
  );
};

export default ChatPanel;
