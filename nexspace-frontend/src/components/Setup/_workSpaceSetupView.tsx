import React from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './_nexSideBar'; // Update if you’re not using path aliases

const WorkspaceSetup: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="flex min-h-screen bg-white">
            {/* Left Panel */}
            <Sidebar />

            {/* Right Panel */}
            <main className="flex-1 relative bg-white">
                {/* Top Progress UI */}
                <div className="absolute left-10 top-6 w-[860px]">
                    <div className="relative h-3 mb-2">
                        <div className="absolute top-1 left-[230px] w-[400px] h-[3px] bg-[#F2F2F2] rounded-full" />
                        <div className="absolute top-1 left-[230px] h-[3px] w-[209px] bg-gradient-to-r from-[#212121] to-[#4285F4]/80 rounded-full" />
                        <div className="absolute top-0 left-[439px] w-2 h-2 bg-[#212121] rounded-full" />
                    </div>

                    <div className="flex gap-16 ml-[190px] text-sm font-medium text-[#212121]">
                        <span className="">Account</span>
                        <span className="font-bold">Workspace</span>
                        <span className="opacity-40">Invite</span>
                    </div>

                    <div className="w-full h-px bg-[#F2F2F2] mt-4" />
                </div>

                {/* Centered Content */}
                <div className="flex h-full items-center justify-center">
                    <div className="flex flex-col gap-12 items-center mt-20">
                        {/* Title */}
                        <div className="text-left space-y-2 w-[400px]">
                            <h2 className="text-2xl font-bold text-[#212121]">Setup Your Workspace</h2>
                            <p className="text-sm text-[#212121]">Fill out your personal info</p>
                        </div>

                        {/* Form */}
                        <form className="flex flex-col gap-5 w-[400px]">
                            {/* Team Name */}
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-[#212121]">Team Name*</label>
                                <input
                                    type="text"
                                    placeholder="Enter your team name"
                                    className="h-10 w-full px-4 border border-[#E0E0E0] rounded-xl text-sm placeholder-[#BFBFBF]"
                                />
                            </div>

                            {/* Team Size */}
                            <div className="flex flex-col gap-1">
                                <label className="text-sm font-medium text-[#212121]">Team Size*</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Select team size"
                                        className="h-10 w-full px-4 border border-[#E0E0E0] rounded-xl text-sm text-[#212121]"
                                    />
                                    <span className="absolute right-4 top-2 text-[#212121] text-xl">⌄</span>
                                </div>
                            </div>

                            {/* Continue Button */}
                            <button
                                type="button"
                                onClick={() => navigate('/setup/invite')}
                                className="w-full h-10 bg-[#212121] text-white text-sm font-semibold rounded-xl"
                            >
                                Continue
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default WorkspaceSetup;
