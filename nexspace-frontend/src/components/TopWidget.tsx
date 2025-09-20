import React, { useMemo, useState } from "react";
import { useMeetingStore } from "../stores/meetingStore";
import { initialsFrom } from "../utils/util";

const TopWidget: React.FC = () => {
  // Subscribe to individual slices to avoid unstable selector objects
  const connected = useMeetingStore((s) => s.connected);
  const joining = useMeetingStore((s) => s.joining);
  const participants = useMeetingStore((s) => s.participants);

  const [statusOpen, setStatusOpen] = useState(false);
  const [status, setStatus] = useState<string>("In a meeting");
  const statusText = useMemo(
    () => (connected ? status : joining ? "Joining…" : "Not in meeting"),
    [connected, joining, status]
  );

  const avatars = useMemo(() => participants.slice(0, 2), [participants]);
  const extraCount = Math.max(0, participants.length - avatars.length);
  const chatOpen = useMeetingStore((s) => s.chatOpen);
  const shift = chatOpen ? "translateX(calc(-50% - 204px))" : "translateX(-50%)";

  return (
    <div
      className="widget-top left-1/2 w-auto"
      style={{ top: 24, height: 60, transform: shift }}
    >
      <div className="widget-top-inner w-full h-full">
        <div className="flex items-center w-full h-8 gap-3 sm:gap-8">
          {/* Status chip */}
          <div className="relative">
            <button
              type="button"
              className="status-chip min-w-[120px] max-w-[130px]"
              onClick={() => setStatusOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={statusOpen}
            >
              <svg className="icon-16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 9a7 7 0 1 0 14 0" stroke="#4285F4" strokeWidth="1.6" fill="none" />
                <circle cx="12" cy="9" r="2" fill="#48FFA4" />
              </svg>
              <span className="truncate max-w-[100px]">{statusText}</span>
              <svg className="icon-20 text-[#80889B]" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </button>
            {statusOpen && (
              <div className="menu" role="menu">
                {["In a meeting", "Available", "Do not disturb", "Away"].map((opt) => (
                  <button
                    key={opt}
                    className="menu-item"
                    role="menuitem"
                    onClick={() => {
                      setStatus(opt);
                      setStatusOpen(false);
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          opt === "Do not disturb"
                            ? "#ED5C5B"
                            : opt === "Available"
                              ? "#48FFA4"
                              : opt === "Away"
                                ? "#F59E0B"
                                : "#80889B",
                      }}
                    />
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="sep-vert hidden sm:block" />

          {/* Search */}
          <button className="icon-btn-ghost hidden sm:grid" aria-label="Search" style={{ width: 32, height: 32 }}>
            <svg className="icon-16 text-[#80889B]" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" fill="none" />
              <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>

          {/* Divider */}
          <div className="sep-vert hidden sm:block" />

          {/* Avatars + chevron */}
          <div className="flex items-center" style={{ gap: 5 }}>
            <div className="avatar-stack-24" aria-label="Participants">
              {avatars[0] && (
                <div
                  className={"avatar-24 absolute left-0 top-0 grid place-items-center bg-white/10"}
                >
                  <span className="text-[10px] font-semibold text-white">{initialsFrom(avatars[0].name)}</span>
                </div>
              )}
              {avatars[1] && (
                <div
                  className={"avatar-24 absolute top-0 grid place-items-center bg-white/10"}
                  style={{ left: 16 }}
                >
                  <span className="text-[10px] font-semibold text-white">{initialsFrom(avatars[1].name)}</span>
                </div>
              )}
              {extraCount > 0 && <div className="avatar-counter-24" style={{ left: 32, top: 0 }}>{extraCount > 0 ? `+${extraCount}` : "+0"}</div>}
            </div>
            <button className="chev-btn hidden sm:grid" aria-label="More participants" style={{ width: 20, height: 20 }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M6 9l6 6 6-6" stroke="#80889B" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopWidget;
