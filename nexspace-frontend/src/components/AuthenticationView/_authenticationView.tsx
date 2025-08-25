import React from 'react';
import { useNavigate } from 'react-router-dom';

const AuthPage: React.FC = () => {
     const navigate = useNavigate();
    const handleGoogleLogin = () => {
        openPopup('/api/auth/google');
    };
    const handleMicrosoftLogin = () => {
        openPopup('/api/auth/microsoft');
    };


    function openPopup(url: string) {
        window.open(url, 'oauth', 'width=400,height=500');
        const origin = 'http://localhost:3000';

        function onMessage(e: MessageEvent) {
            console.log('Message from child', e);
            if (e.origin !== origin) return;
            if (e.data?.type === 'oauth_done') {
                window.removeEventListener('message', onMessage);
               // try { w?.close(); } catch { }
                // refresh current user now that session cookie is set
                fetch('/api/me', { credentials: 'include' })
                    .then(r => r.json())
                    .then(data => {
                        // set your auth state here (context/store)
                        if(data?.user)
                            navigate('/setup/account')
                    });
            }
        }
        window.addEventListener('message', onMessage);
    }

    return (
        <div className="relative min-h-screen w-full bg-white flex items-center justify-center">
            {/* Centered Frame */}
            <div className="flex flex-col items-center gap-8 w-[400px]">
                {/* Logo and Title */}
                <div className="flex flex-col items-center gap-3">
                    {/* Logo */}
                    <div className="w-20 h-20 relative">
                        <div className="absolute inset-0 bg-[#EFF5FF] rounded-full flex items-center justify-center">
                            <div className="w-10 h-10 bg-[#D5E5FF] rounded-full flex items-center justify-center">
                                <div className="w-6 h-6 bg-[#4285F4] rounded-full" />
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-[24px] font-bold text-[#212121] text-center leading-[36px]">
                        Welcome to NexSpace
                    </h2>
                    <p className="text-[16px] text-[#212121] text-center leading-[24px] font-normal">
                        Virtual coworking & accountability for connected, productive teams.
                    </p>
                </div>

                {/* Email Input & Button */}
                <div className="flex flex-col items-start gap-4 w-full">
                    <div className="flex flex-col gap-1 w-full">
                        <label className="text-sm text-[#212121] font-medium">Email</label>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className="w-full px-4 py-2 border border-[#E0E0E0] rounded-xl text-sm text-[#212121] placeholder-[#BFBFBF] outline-none"
                        />
                    </div>

                    <button className="w-full bg-[#212121] text-white text-sm font-semibold py-2 rounded-xl shadow">
                        Continue with email
                    </button>
                </div>

                {/* Divider */}
                <div className="flex items-center justify-center gap-2 w-full">
                    <div className="flex-1 h-px bg-[#E6E6E6]" />
                    <span className="text-sm text-[#828282]">or</span>
                    <div className="flex-1 h-px bg-[#E6E6E6]" />
                </div>

                {/* OAuth Buttons */}
                <div className="flex flex-col gap-6 w-full">
                    {/* Google Button */}
                    <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 py-2 border border-[#E0E0E0] rounded-xl bg-[#F2F4F6]">
                        <img src="/google-icon.svg" alt="Google" className="w-5 h-5" />
                        <span className="text-sm font-semibold text-[#212121]">Continue with Google</span>
                    </button>

                    {/* Microsoft Button */}
                    <button onClick={handleMicrosoftLogin} className="w-full flex items-center justify-center gap-3 py-2 border border-[#E0E0E0] rounded-xl bg-[#F2F4F6]">
                        <img src="/microsoft-icon.svg" alt="Microsoft" className="w-5 h-5" />
                        <span className="text-sm font-semibold text-[#212121]">Continue with Microsoft</span>
                    </button>
                </div>
            </div>

            {/* Terms & Privacy */}
            <p className="absolute bottom-8 text-center text-sm text-[#828282] w-[322px]">
                By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
        </div>
    );
};

export default AuthPage;
