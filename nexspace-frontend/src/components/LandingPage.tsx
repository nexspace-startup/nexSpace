import React from "react";
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate()
    return (
        <div className="relative w-screen h-screen bg-[#202024] font-manrope">
            <div className="absolute w-[480px] h-[432px] left-[480px] top-[196px] flex flex-col items-center gap-[50px]">
                <div className="w-[480px] h-[216px] flex flex-col items-center gap-[20px]">
                    {/* Logo */}
                    <div className="w-[80px] h-[80px] relative">
                        <div className="absolute inset-0 bg-gradient-to-b from-[#B7F2D4] to-[#48FFA4] rounded-full" />
                    </div>

                    {/* Heading & Subheading */}
                    <div className="w-[480px] h-[116px] flex flex-col items-center gap-[8px]">
                        <h1 className="w-[339px] h-[48px] text-white text-[32px] font-bold leading-[48px] tracking-[-0.01em] text-center">
                            Welcome to NexSpace
                        </h1>
                        <p className="w-[480px] h-[60px] text-white text-[20px] font-normal leading-[30px] text-center">
                            Virtual coworking & accountability for connected, productive teams.
                        </p>
                    </div>
                </div>

                {/* Join Button */}
                <button onClick={() => navigate('/signin')} className="w-[182px] h-[56px] bg-[#4285F4] rounded-[12px] shadow-[0px_4px_30px_rgba(142,166,246,0.2)] flex justify-center items-center gap-[8px]">
                    <span className="w-[36px] h-[27px] text-white text-[18px] font-semibold leading-[27px] flex items-center">
                        Join
                    </span>
                </button>

                {/* Footer message */}
                <p className="w-[480px] h-[60px] text-white text-[20px] font-normal leading-[30px] text-center">
                    We’re building something exciting. Stay tuned! 😉
                </p>
            </div>
        </div>
    );
}