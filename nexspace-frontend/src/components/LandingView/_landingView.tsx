import React from 'react';
import { useNavigate } from 'react-router-dom';



const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="relative w-full min-h-screen bg-[#F9F9F9] flex flex-col items-center justify-center px-4">
            {/* Center Card */}
            <div className="w-[480px] flex flex-col items-center gap-12">

                {/* Logo */}
                <div className="w-20 h-20 relative">
                    <div className="absolute inset-0 bg-[#EFF5FF] rounded-full flex items-center justify-center">
                        <div className="w-10 h-10 bg-[#D5E5FF] rounded-full flex items-center justify-center">
                            <div className="w-6 h-6 bg-[#4285F4] rounded-full" />
                        </div>
                    </div>
                </div>

                {/* Title & Subtitle */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <h1 className="text-[32px] font-bold text-[#212121] leading-[48px]">
                        Welcome to NexSpace
                    </h1>
                    <p className="text-[20px] text-[#212121] leading-[30px] font-normal">
                        Virtual coworking & accountability for connected, productive teams.
                    </p>
                </div>

                {/* Join Button */}
                <button onClick={() => navigate('/signin')}
                    className="bg-[#212121] text-white text-[18px] font-semibold px-6 py-3 rounded-xl shadow-md">
                    Join Now
                </button>

                {/* Footer Message */}
                <p className="text-[20px] text-[#212121] text-center leading-[30px] font-normal">
                    We’re building something exciting. Stay tuned! 😉
                </p>
            </div>
        </div>
    );
};

export default LandingPage;
