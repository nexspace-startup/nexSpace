import React from 'react';

const Sidebar: React.FC = () => {
    return (
        <aside className="w-[483px] bg-[#FCF9F2] rounded-[20px] p-6 flex flex-col">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 relative">
                    <div className="absolute inset-0 bg-[#EFF5FF] rounded-full flex items-center justify-center">
                        <div className="w-6 h-6 bg-[#D5E5FF] rounded-full flex items-center justify-center">
                            <div className="w-3 h-3 bg-[#4285F4] rounded-full" />
                        </div>
                    </div>
                </div>
                <h1 className="text-[20px] font-bold text-[#212121]">NexSpace</h1>
            </div>

            {/* Optional: you can add images/text here later */}
        </aside>
    );
};

export default Sidebar;