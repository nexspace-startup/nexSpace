import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from "../../stores/userStore";
import { googleGetCode } from '../../lib/oauthClients';

type Provider = 'google' | 'microsoft';


const Signin: React.FC = () => {
    const setUser = useUserStore((state) => state.setUser);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const handleGoogleLogin = () => {
        handleOAuth('google')
    };
    const handleMicrosoftLogin = () => {
        handleOAuth('microsoft')
    };

    async function handleOAuth(provider: 'google' | 'microsoft') {
        try {
            setIsLoading(true);
            let result: any;
            if (provider === 'google') {
                const code = await googleGetCode();
                if (!code) throw new Error('Google sign-in was cancelled.');
                result = await completeAuthentication('google', {
                    code,
                    redirectUri: 'postmessage',
                });
            }
            //   else {
            //     const idToken = await microsoftGetIdToken();
            //     if (!idToken) throw new Error('Microsoft sign-in was cancelled.');
            //     result = await completeAuthentication('microsoft', { idToken });
            //   }

            if (!result?.isAuthenticated || !result.user) {
                console.log(result);
                alert('Authentication failed. Please try again.');
                return;
            }

            // save user
            setUser(result.user);
            setIsLoading(false);
            // route by workspaces
            const ws = result.workspaces ?? [];
            if (ws.length === 0) {
                navigate('/setup');
            } else if (ws.length >= 1) {
                // optionally set active workspace in a store here
                navigate('/dashboard'); // rewrite to your actual path
            } 
        } catch (e: any) {
            console.error(e);
            setIsLoading(false);
            alert(e?.message || 'Authentication error');
        }
    }

    async function completeAuthentication(
        provider: Provider,
        payload: Record<string, unknown>
    ): Promise<any> {
        const endpoint =
            provider === 'google'
                ? '/api/auth/google/callback'
                : '/api/auth/microsoft/callback';

        const resp = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!resp.ok && resp.status !== 204) {
            // backend might reply 204 No Content on success
            const msg = await resp.text().catch(() => 'Auth failed');
            throw new Error(msg || 'Authentication failed');
        }

        const me = await fetch('/api/me', { credentials: 'include' });
        if (!me.ok) throw new Error('Failed to bootstrap session');
        return (await me.json()) as any;
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

            {isLoading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-16 w-16"></div>
                </div>
            )}
        </div>
    );
};

export default Signin;
