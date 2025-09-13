import React, { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMeetingStore, type MeetingState } from "../stores/meetingStore";

const ChatPanel: React.FC = () => {
  const { chatOpen, messages, toggleChat, sendMessage } = useMeetingStore(
    useShallow((s: MeetingState) => ({
      chatOpen: s.chatOpen,
      messages: s.messages,
      toggleChat: s.toggleChat,
      sendMessage: s.sendMessage,
    }))
  );

  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatOpen) return;
    // autoscroll to bottom on open and on new messages
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chatOpen, messages.length]);

  if (!chatOpen) return null;

  return (
    <aside
      className="absolute right-2 sm:right-6 bottom-[92px] sm:bottom-[120px] z-30 w-[min(92vw,360px)] h-[min(60vh,520px)] bg-[#1C1C1F] border border-[#2A2B31] rounded-xl shadow-xl flex flex-col overflow-hidden"
      role="region"
      aria-label="Meeting chat"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-[#2A2B31] text-[#C2C8D1]">
        <div className="font-medium">Chat</div>
        <button onClick={toggleChat} className="text-[#80889B] hover:text-[#C2C8D1]" aria-label="Close chat">✕</button>
      </header>
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] ${m.isLocal ? 'ml-auto text-right' : ''}`}>
            <div className="text-[11px] text-[#80889B] mb-0.5">{m.senderName}</div>
            <div className={`${m.isLocal ? 'bg-[#2F3138] text-[#E6EAF0]' : 'bg-[#23252B] text-[#E6EAF0]'} rounded-lg px-3 py-1.5 whitespace-pre-wrap break-words`}>{m.text}</div>
          </div>
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          await sendMessage(t);
          setText("");
          setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 10);
        }}
        className="p-2 border-t border-[#2A2B31]"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message"
          className="w-full bg-[#23252B] text-[#E6EAF0] placeholder-[#80889B] rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#3D93F8]"
        />
      </form>
    </aside>
  );
};

export default ChatPanel;
