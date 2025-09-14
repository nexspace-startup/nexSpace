import React, { useMemo } from "react";
import { MicIcon, MicDisabledIcon, CameraIcon, CameraDisabledIcon, ChatIcon } from "@livekit/components-react";
import { useShallow } from "zustand/react/shallow";
import { useMeetingStore } from "../stores/meetingStore";
import { fmtHMS } from "../utils/util";
import { useTick } from "../hooks/useTick";

const MeetingControls: React.FC = () => {
    const {
        connected, startedAt, leave, micEnabled, camEnabled, toggleMic, toggleCam
    } = useMeetingStore(
        useShallow((s) => ({
            connected: s.connected,
            startedAt: s.startedAt,
            leave: s.leave,
            micEnabled: s.micEnabled,
            camEnabled: s.camEnabled,
            toggleMic: s.toggleMic,
            toggleCam: s.toggleCam,
        }))
    );

    const tick = useTick(connected);

    const elapsed = useMemo(() => {
        if (!connected || !startedAt) return "00 : 00 : 00";
        return fmtHMS(Date.now() - startedAt);
    }, [connected, startedAt, tick]);

    if (!connected) return null;

    return (
        <div
            className="absolute left-1/2 -translate-x-1/2 control-bar
                        w-[calc(100%-16px)] max-w-[682px]
                        h-auto sm:h-[72px]
                        px-3 sm:px-6 py-2 sm:py-0
                        bottom-2 sm:bottom-6 flex-wrap gap-3"
            role="region"
            aria-label="Meeting controls"
        >
            {/* Timer */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full grid place-items-center bg-[rgba(254,116,31,0.15)]" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M12 7v5l3 2" stroke="#FE741F" strokeWidth="2" fill="none" strokeLinecap="round" />
                        <circle cx="12" cy="12" r="8.5" stroke="#FE741F" strokeWidth="1.5" fill="none" />
                    </svg>
                </div>
                <span className="time-readout" aria-live="polite">
                    {elapsed}
                </span>
                <div className="mx-2 h-6 w-px bg-[#26272B]" />
            </div>

            {/* Middle controls */}
            <div className="flex items-center gap-5">
                {/* View mode (placeholder) */}
                <div className="segmented" role="group" aria-label="View mode">
                    <button className="segmented-active">Grid</button>
                    <button className="segmented-inactive">3D</button>
                </div>

                {/* Mic */}
                <button
                    onClick={toggleMic}
                    className="ctrl-btn"
                    aria-pressed={!micEnabled}
                    title={micEnabled ? "Mute microphone" : "Unmute microphone"}
                >
                    {micEnabled ? <MicIcon className="w-5 h-5 text-[#80889B]" /> : <MicDisabledIcon className="w-5 h-5 text-[#ed5c5b]" />}
                </button>

                {/* Camera */}
                <button
                    onClick={toggleCam}
                    className="ctrl-btn"
                    aria-pressed={!camEnabled}
                    title={camEnabled ? "Turn camera off" : "Turn camera on"}
                >
                    {camEnabled ? <CameraIcon className="w-5 h-5 text-[#80889B]" /> : <CameraDisabledIcon className="w-5 h-5 text-[#ed5c5b]" />}
                </button>

                {/* Chat placeholder */}
                <button className="ctrl-btn" title="Chat">
                    <ChatIcon className="w-5 h-5 text-[#80889B]" />
                </button>
            </div>

            {/* Leave */}
            <button onClick={leave} className="btn-cta">
                Leave Meeting
            </button>
        </div>
    );
};

export default MeetingControls;
