import React, { useEffect, useMemo, useState } from "react";
import { MicIcon, MicDisabledIcon, CameraIcon, CameraDisabledIcon, ChatIcon } from "@livekit/components-react";
import { useShallow } from "zustand/react/shallow";
import { useMeetingStore } from "../stores/meetingStore";
import { useUIStore } from "../stores/uiStore";
import { fmtHMS } from "../utils/util";
import { useTick } from "../hooks/useTick";
import call_end from "../assets/call_end.svg"
import { useViewportSize } from "../hooks/useViewportSize";

const MeetingControls: React.FC = () => {
  const {
    connected, startedAt, micEnabled, camEnabled, toggleMic, toggleCam, chatOpen, unreadCount, toggleChat, screenShareEnabled, toggleScreenShare, leave,
    viewMode, setViewMode
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
      viewMode: s.viewMode,
      setViewMode: s.setViewMode,
    }))
  );

  const tick = useTick(connected);
  const { width: viewportWidth } = useViewportSize();
  const isMobile = viewportWidth <= 640;
  const isDesktopWide = viewportWidth >= 1280;
  const isWorkspaceOpen = useUIStore((s) => s.isWorkspacePanelOpen);
  const isWorkspaceControlsOpen = useUIStore((s) => s.isWorkspaceControlsOpen);

  const elapsed = useMemo(() => {
    if (!connected || !startedAt) return "00 : 00 : 00";
    return fmtHMS(Date.now() - startedAt);
  }, [connected, startedAt, tick]);

  const [moreOpen, setMoreOpen] = useState(false);

  // When chat is open, visually center controls in remaining width by shifting left ~ half chat width
  const shouldOffset = chatOpen && isDesktopWide;
  const centerShift = shouldOffset ? "translateX(calc(-50% - 204px))" : "translateX(-50%)";
  const collapseDesktopExtras =
    (!isMobile && isWorkspaceOpen) ||
    (!isMobile && chatOpen && viewportWidth >= 1024);
  const showOverflowMenu = isMobile || collapseDesktopExtras;
  const containerStyle = useMemo<React.CSSProperties>(() => ({
    transform: centerShift,
    paddingBottom: isMobile ? "env(safe-area-inset-bottom, 0px)" : undefined,
  }), [centerShift, isMobile]);

  useEffect(() => {
    if (!showOverflowMenu && moreOpen) {
      setMoreOpen(false);
    }
  }, [moreOpen, showOverflowMenu]);

  if (!connected || !isWorkspaceControlsOpen) {
    return null;
  }

  return (
    <div
      className="absolute left-1/2 control-bar z-40 w-[calc(100%-1.5rem)] sm:w-auto max-w-[min(760px,calc(100%-1.5rem))] bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] sm:bottom-6 min-h-[72px] sm:h-[60px] px-3 sm:px-4 py-3 sm:py-1 flex-wrap"
      style={containerStyle}
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
            <button
              className={`flex items-center gap-2 ${viewMode === 'grid' ? 'segmented-active' : 'segmented-inactive'}`}
              onClick={() => setViewMode('grid')}
            >
              <svg width="21" height="20" viewBox="0 0 21 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 6.49903C5 5.32082 5 4.73172 5.36667 4.36652C5.73133 4 6.32067 4 7.5 4C8.67933 4 9.268 4 9.63333 4.36652C10 4.73172 10 5.32082 10 6.49903C10 7.67724 10 8.26634 9.63333 8.63153C9.268 8.99806 8.67867 8.99806 7.5 8.99806C6.32133 8.99806 5.732 8.99806 5.36667 8.63153C5 8.26701 5 7.6779 5 6.49903ZM5 13.501C5 12.3228 5 11.7337 5.36667 11.3685C5.732 11.0019 6.32133 11.0019 7.5 11.0019C8.67867 11.0019 9.268 11.0019 9.63333 11.3685C10 11.7337 10 12.3228 10 13.501C10 14.6792 10 15.2683 9.63333 15.6335C9.268 16 8.67867 16 7.5 16C6.32133 16 5.732 16 5.36667 15.6335C5 15.269 5 14.6792 5 13.501ZM12 6.49903C12 5.32082 12 4.73172 12.3667 4.36652C12.732 4 13.3213 4 14.5 4C15.6787 4 16.268 4 16.6333 4.36652C17 4.73172 17 5.32082 17 6.49903C17 7.67724 17 8.26634 16.6333 8.63153C16.268 8.99806 15.6787 8.99806 14.5 8.99806C13.3213 8.99806 12.732 8.99806 12.3667 8.63153C12 8.26634 12 7.67724 12 6.49903ZM12 13.501C12 12.3228 12 11.7337 12.3667 11.3685C12.732 11.0019 13.3213 11.0019 14.5 11.0019C15.6787 11.0019 16.268 11.0019 16.6333 11.3685C17 11.7337 17 12.3228 17 13.501C17 14.6792 17 15.2683 16.6333 15.6335C16.268 16 15.6787 16 14.5 16C13.3213 16 12.732 16 12.3667 15.6335C12 15.2683 12 14.6792 12 13.501Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              Grid
            </button>
            <button
              className={`flex items-center gap-2 ${viewMode === '3d' ? 'segmented-active' : 'segmented-inactive'}`}
              onClick={() => setViewMode('3d')}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.0009 2.5L16.4959 6.25V12.7875C16.4959 13.0801 16.4188 13.3675 16.2726 13.6208C16.1263 13.8742 15.9159 14.0846 15.6625 14.2308L10.8342 17.0192C10.5808 17.1654 10.2934 17.2425 10.0009 17.2425C9.7083 17.2425 9.42089 17.1654 9.16753 17.0192L4.33919 14.2308C4.08583 14.0846 3.87544 13.8742 3.72916 13.6208C3.58288 13.3675 3.50587 13.0801 3.50586 12.7875V6.25L10.0009 2.5Z" stroke="#80889B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10.0009 5.83331V9.99998M10.0009 9.99998L6.39258 12.0833M10.0009 9.99998L13.6092 12.0833" stroke="#80889B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              3D
            </button>
          </div>

          {/* View mode (mobile) */}
          <div className="segmented sm:hidden" role="group" aria-label="View mode">
            <button
              className={`px-2 py-1 text-xs font-medium ${viewMode === 'grid' ? 'segmented-active' : 'segmented-inactive'}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              className={`px-2 py-1 text-xs font-medium ${viewMode === '3d' ? 'segmented-active' : 'segmented-inactive'}`}
              onClick={() => setViewMode('3d')}
            >
              3D
            </button>
          </div>

          {/* Mic */}
          <button
            onClick={toggleMic}
            className="ctrl-btn group"
            aria-pressed={!micEnabled}
            title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {micEnabled ? <MicIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#FFFFFF] group-hover:brightness-110" /> : <MicDisabledIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#ED5C5B] group-hover:brightness-110" />}
          </button>

          {/* Camera */}
          <button
            onClick={toggleCam}
            className="ctrl-btn group"
            aria-pressed={!camEnabled}
            title={camEnabled ? "Turn camera off" : "Turn camera on"}
          >
            {camEnabled ? <CameraIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#FFFFFF] group-hover:brightness-110" /> : <CameraDisabledIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#ED5C5B] group-hover:brightness-110" />}
          </button>

          {/* Screen share button on desktop; on mobile in more menu */}
          {!collapseDesktopExtras && (
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
          {!collapseDesktopExtras && (
            <button className={`ctrl-btn group relative hidden sm:grid ${chatOpen ? 'ring-1 ring-[#3D93F8]' : ''}`} title="Chat" onClick={toggleChat} aria-pressed={chatOpen}>
              <ChatIcon className="w-6 h-6 sm:w-5 sm:h-5 text-[#80889B] group-hover:text-white" />
              {(!chatOpen && unreadCount > 0) && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ED5C5B] text-white text-[10px] grid place-items-center">{unreadCount}</span>
              )}
            </button>
          )}


        </div>

        {/* Separator between controls and settings */}
        <div className="hidden sm:block h-8 w-px bg-[#26272B]" />

        {/* Right: settings + leave (mobile) */}
        <div className="flex items-center gap-3 sm:gap-5">

          {/* Mobile 'more' (…): contains present + chat */}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={`ctrl-btn group ${showOverflowMenu ? '' : 'sm:hidden'}`}
            title="More"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 sm:w-5 sm:h-5 text-[#80889B] group-hover:text-white" aria-hidden>
              <circle cx="12" cy="6" r="1.6" fill="currentColor" />
              <circle cx="12" cy="12" r="1.6" fill="currentColor" />
              <circle cx="12" cy="18" r="1.6" fill="currentColor" />
            </svg>
          </button>
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
        <div
          className="absolute right-2 bottom-[104px] sm:bottom-[72px] bg-[#202024] border border-[#26272B] rounded-xl shadow-lg w-52 py-1"
          role="menu"
          style={{ bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 96px)" : undefined }}
        >
          <button className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5 flex items-center gap-2" onClick={() => { toggleScreenShare(); setMoreOpen(false); }}>
            {screenShareEnabled ? 'Stop presenting' : 'Present screen'}
          </button>
          <button className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5" onClick={() => { toggleChat(); setMoreOpen(false); }}>
            {chatOpen ? 'Close chat' : 'Open chat'}
          </button>
          {isMobile && (
            <>
              <div className="border-t border-white/5 mt-1 pt-2 text-[11px] uppercase tracking-wide text-white/50 px-3">View</div>
              <div className="flex items-center justify-between px-3 py-2 gap-3">
                <button
                  className={`flex-1 px-2 py-1 rounded border border-white/10 text-xs font-medium ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'bg-transparent text-white/70'}`}
                  onClick={() => { setViewMode('grid'); setMoreOpen(false); }}
                >
                  Grid
                </button>
                <button
                  className={`flex-1 px-2 py-1 rounded border border-white/10 text-xs font-medium ${viewMode === '3d' ? 'bg-white/10 text-white' : 'bg-transparent text-white/70'}`}
                  onClick={() => { setViewMode('3d'); setMoreOpen(false); }}
                >
                  3D
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MeetingControls;
