import React, { useMemo, useState } from "react";
import { MicIcon, MicDisabledIcon, CameraIcon, CameraDisabledIcon, ChatIcon } from "@livekit/components-react";
import { useShallow } from "zustand/react/shallow";
import { useMeetingStore } from "../stores/meetingStore";
import { useUIStore } from "../stores/uiStore";
import { fmtHMS } from "../utils/util";
import { useTick } from "../hooks/useTick";
import call_end from "../assets/call_end.svg"

const MeetingControls: React.FC = () => {
  const {
    connected, startedAt, micEnabled, camEnabled, toggleMic, toggleCam, chatOpen, unreadCount, toggleChat, screenShareEnabled, toggleScreenShare, leave
  } = useMeetingStore(
    useShallow((s) => ({
      connected: s.connected,
      startedAt: s.startedAt,
      micEnabled: s.micEnabled,
      camEnabled: s.camEnabled,
      toggleMic: s.toggleMic,
      toggleCam: s.toggleCam,
      chatOpen: s.chatOpen,
      unreadCount: s.unreadCount,
      toggleChat: s.toggleChat,
      screenShareEnabled: s.screenShareEnabled,
      toggleScreenShare: s.toggleScreenShare,
      leave: s.leave,
    }))
  );

  const tick = useTick(connected);
  const isWorkspaceOpen = useUIStore((s) => s.isWorkspacePanelOpen);

  const elapsed = useMemo(() => {
    if (!connected || !startedAt) return "00 : 00 : 00";
    return fmtHMS(Date.now() - startedAt);
  }, [connected, startedAt, tick]);

  const [moreOpen, setMoreOpen] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);

  if (!connected) return null;

  // When chat is open, visually center controls in remaining width by shifting left ~ half chat width
  const centerShift = chatOpen ? "translateX(calc(-50% - 204px))" : "translateX(-50%)";
  const bothOpen = chatOpen && isWorkspaceOpen;

  return (
    <div
      className="absolute left-1/2 control-bar w-[calc(100%-16px)] max-w-[680px] bottom-3 sm:bottom-6 min-h-[92px] sm:h-[60px] px-3 sm:px-4 py-3 sm:py-1"
      style={{ transform: centerShift }}
      role="region"
      aria-label="Meeting controls"
    >
      <div className="w-full flex items-center justify-between gap-4 sm:gap-6 flex-wrap">
        {/* Left: timer (hidden on mobile) */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-full grid place-items-center bg-[rgba(254,116,31,0.15)]" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M12 7v5l3 2" stroke="#FE741F" strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="12" cy="12" r="8.5" stroke="#FE741F" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <span className="time-readout" aria-live="polite">{elapsed}</span>
        </div>
        <div className="hidden sm:block h-8 w-px bg-[#26272B]" />
        {/* Center: A/V controls (mobile only: mic, cam, speaker) */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* View mode (hide on mobile) */}
          <div className="segmented hidden sm:flex" role="group" aria-label="View mode">
            <button className="segmented-active">Grid</button>
            <button className="segmented-inactive">3D</button>
          </div>

          {/* Mic */}
          <button
            onClick={toggleMic}
            className="ctrl-btn group"
            aria-pressed={!micEnabled}
            title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {micEnabled ? <MicIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#FE741F] group-hover:brightness-110" /> : <MicDisabledIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#FE741F] group-hover:brightness-110" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleCam}
            className="ctrl-btn group"
            aria-pressed={!camEnabled}
            title={camEnabled ? "Turn camera off" : "Turn camera on"}
          >
            {camEnabled ? <CameraIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#FE741F] group-hover:brightness-110" /> : <CameraDisabledIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#FE741F] group-hover:brightness-110" />}
          </button>

          {/* Screen share button on desktop; on mobile in more menu */}
          {!bothOpen && (
            <button
              onClick={toggleScreenShare}
              className={`ctrl-btn group hidden sm:grid ${screenShareEnabled ? 'ring-1 ring-[#3D93F8]' : ''}`}
              aria-pressed={screenShareEnabled}
              title={screenShareEnabled ? 'Stop presenting' : 'Present screen'}
            >
              {screenShareEnabled ? (
                <svg className="w-6 h-6 sm:w-5 sm:h-5 text-[#3D93F8] group-hover:text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16v8H4z" stroke="currentColor" strokeWidth="2" /><path d="M8 20h8" stroke="currentColor" strokeWidth="2" /><path d="M12 14v6" stroke="currentColor" strokeWidth="2" /></svg>
              ) : (
                <svg className="w-6 h-6 sm:w-5 sm:h-5 text-[#80889B] group-hover:text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 6h16v8H4z" stroke="currentColor" strokeWidth="2" /><path d="M8 20h8" stroke="currentColor" strokeWidth="2" /></svg>
              )}
            </button>
          )}

          {/* Chat beside presentation on desktop */}
          {!bothOpen && (
            <button className={`ctrl-btn group relative hidden sm:grid ${chatOpen ? 'ring-1 ring-[#3D93F8]' : ''}`} title="Chat" onClick={toggleChat} aria-pressed={chatOpen}>
              <ChatIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#80889B] group-hover:text-white" />
              {(!chatOpen && unreadCount > 0) && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ED5C5B] text-white text-[10px] grid place-items-center">{unreadCount}</span>
              )}
            </button>
          )}

          {/* Mobile 'more' (…): contains present + chat */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="ctrl-btn group sm:hidden"
            title="More"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-5 sm:h-5 text-[#80889B] group-hover:text-white" aria-hidden>
              <circle cx="6" cy="12" r="1.6" fill="currentColor" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" />
              <circle cx="18" cy="12" r="1.6" fill="currentColor" />
            </svg>
          </button>
        </div>

        {/* Separator between controls and settings */}
        <div className="hidden sm:block h-8 w-px bg-[#26272B]" />

        {/* Right: settings + leave (mobile) */}
        <div className="flex items-center gap-3 sm:gap-5">

          {/* Desktop settings when both chat + workspace are open */}
          {(true) && (
            <button
              className="ctrl-btn group hidden sm:grid"
              title="Settings"
              aria-haspopup="menu"
              aria-expanded={deskOpen}
              onClick={() => setDeskOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-5 sm:h-5 text-[#80889B] group-hover:text-white" aria-hidden>
                <circle cx="12" cy="6" r="1.6" fill="currentColor" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                <circle cx="12" cy="18" r="1.6" fill="currentColor" />
              </svg>
            </button>
          )}
          {/* End call (mobile only). Desktop/Tablet uses top-right leave. */}
          <button
            onClick={leave}
            className="ctrl-btn bg-[#ED5C5B] text-white sm:hidden"
            title="End call"
            aria-label="End call"
          >
            <img src={call_end} alt="Leave" className="w-6 h-6 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Mobile overflow menu */}
      {moreOpen && (
        <div className="absolute right-2 bottom-[104px] sm:bottom-[72px] bg-[#202024] border border-[#26272B] rounded-xl shadow-lg w-52 py-1" role="menu">
          <button className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5 flex items-center gap-2" onClick={() => { toggleScreenShare(); setMoreOpen(false); }}>
            {screenShareEnabled ? 'Stop presenting' : 'Present screen'}
          </button>
          <button className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5" onClick={() => { toggleChat(); setMoreOpen(false); }}>
            {chatOpen ? 'Close chat' : 'Open chat'}
          </button>
        </div>
      )}

      {deskOpen && (
        <div className="absolute right-2 bottom-[72px] hidden sm:block bg-[#202024] border border-[#26272B] rounded-xl shadow-lg w-56 py-1" role="menu">
          <button className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5" onClick={() => { toggleMic(); setDeskOpen(false); }}>
            {micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          </button>
          <button className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5" onClick={() => { toggleCam(); setDeskOpen(false); }}>
            {camEnabled ? 'Turn camera off' : 'Turn camera on'}
          </button>
          <button className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5" onClick={() => { toggleScreenShare(); setDeskOpen(false); }}>
            {screenShareEnabled ? 'Stop presenting' : 'Present screen'}
          </button>
          <button className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5" onClick={() => { toggleChat(); setDeskOpen(false); }}>
            {chatOpen ? 'Close chat' : 'Open chat'}
          </button>
          <div className="h-px bg-[#26272B] my-1" />
          <button className="w-full text-left px-3 py-2 text-sm text-[#ED5C5B] hover:bg-white/5" onClick={() => { leave(); setDeskOpen(false); }}>
            End call
          </button>
        </div>
      )}
    </div>
  );
};

export default MeetingControls;
