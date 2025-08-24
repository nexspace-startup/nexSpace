// import React from 'react'
import Sidebar from './_nexSideBar'
import { useNavigate } from 'react-router-dom'

const InviteTeam = () => {
    const navigate = useNavigate()

    return (
        <div className="flex min-h-screen bg-white">
            {/* Left Sidebar */}
            <Sidebar />

            {/* Right Panel */}
            <main className="flex-1 relative">
                {/* Progress Tracker */}
                <div className="absolute left-10 top-6 w-[860px]">
                    <div className="relative h-3 mb-2">
                        <div className="absolute top-1 left-[230px] w-[400px] h-[3px] bg-[#F2F2F2] rounded-full" />
                        <div className="absolute top-1 left-[230px] h-[3px] w-[400px] bg-gradient-to-r from-[#212121] to-[#4285F4]/80 rounded-full" />
                        <div className="absolute top-0 left-[628px] w-2 h-2 bg-[#212121] rounded-full" />
                    </div>

                    <div className="flex gap-16 ml-[190px] text-sm font-medium text-[#212121]">
                        <span className="">Account</span>
                        <span className="">Workspace</span>
                        <span className="font-bold">Invite</span>
                    </div>

                    <div className="w-full h-px bg-[#F2F2F2] mt-4" />
                </div>

                {/* Centered Invite Section */}
                <div className="flex h-full items-center justify-center pt-20">
                    <div className="flex flex-col items-center gap-12 mt-8">
                        {/* Title & Description */}
                        <div className="text-left space-y-2 w-[400px]">
                            <h2 className="text-2xl font-bold text-[#212121]">Invite team members</h2>
                            <p className="text-sm text-[#212121]">Fill out your personal info</p>
                        </div>

                        {/* Invite Form */}
                        <form className="flex flex-col gap-6 w-[400px]">
                            {/* Email + Invite Button */}
                            <div className="flex items-end gap-5">
                                <div className="flex flex-col gap-1 w-[280px]">
                                    <label className="text-sm font-medium text-[#212121]">Email</label>
                                    <input
                                        type="email"
                                        placeholder="Enter email"
                                        className="h-10 w-full px-4 border border-[#E0E0E0] rounded-xl text-sm placeholder-[#BFBFBF]"
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="w-[100px] h-10 border-[1.5px] border-[#212121] rounded-xl text-sm font-semibold text-[#212121]"
                                >
                                    Invite
                                </button>
                            </div>

                            {/* Copy Link */}
                            <div className="flex items-center gap-2 cursor-pointer">
                                <img
                                    src="/icons/link-icon.svg" // Replace with actual icon path
                                    alt="Copy Link"
                                    className="w-5 h-5"
                                />
                                <span className="text-sm font-bold text-[#4285F4]">Copy Link</span>
                            </div>
                        </form>

                        {/* Final Continue Button */}
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard')} // or wherever you need to route
                            className="w-[400px] h-10 bg-[#212121] text-white text-sm font-semibold rounded-xl"
                        >
                            Continue to NexSpace
                        </button>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default InviteTeam
