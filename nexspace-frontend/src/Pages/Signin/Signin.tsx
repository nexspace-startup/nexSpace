import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserStore } from "../../stores/userStore";
import { googleGetCode } from '../../lib/oauthClients';
import { getMe } from '../../services/authService';
import { api } from '../../services/httpService';

type Provider = 'google' | 'microsoft';

const Signin: React.FC = () => {
    const setUser = useUserStore((state) => state.setUser);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const loc = useLocation();

    // NEW: figure out where to go after login
    const resolveNext = () => {
        const from = (loc.state as any)?.from;
        const statePath = typeof from === 'string' ? from : from?.pathname;
        const queryNext = new URLSearchParams(loc.search).get('next');
        const raw = statePath || queryNext;
        // allow only same-origin paths
        return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
    };

    const handleGoogleLogin = () => {
        handleOAuth('google');
    };
    const handleMicrosoftLogin = () => {
        handleOAuth('microsoft');
    };

    async function handleOAuth(provider: Provider) {
        try {
            setIsLoading(true);
            if (provider === 'google') {
                const code = await googleGetCode();
                if (!code) throw new Error('Google sign-in was cancelled.');
                await completeAuthentication('google', {
                    code,
                    redirectUri: 'postmessage',
                });
            }
            // (If you add Microsoft, call completeAuthentication similarly)
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
                ? '/auth/google/callback'
                : '/auth/microsoft/callback';

        const res = await api.post(endpoint, payload);
        const resp = res?.data;
        // success can be 204 (No Content) — tolerate both 2xx + 204
        if (!resp?.success) {
            const msg = await resp.text().catch(() => 'Auth failed');
            throw new Error(msg || 'Authentication failed');
        }

        getMe()
            .then((res) => {
                if (res?.isAuthenticated && res?.user) {
                    const { id, first_name, last_name, email } = res.user;
                    const name = [first_name, last_name].filter(Boolean).join(' ');
                    setIsLoading(false);
                    setUser({ id, firstName: first_name, lastName: last_name, name, email });

                    // CHANGED: use intended route if available; otherwise dashboard.
                    const path = resolveNext();

                    if (id) {
                        navigate(path, { replace: true });
                    } else {
                        // if the user record isn't created yet → onboarding
                        if (path !== '/dashboard') {
                            navigate(path, { replace: true });
                        } else
                            navigate('/setup', { replace: true });
                    }
                } else {
                    setIsLoading(false);
                    alert('Authentication failed. Please try again.');
                }
            })
            .catch((e) => {
                console.error(e);
                setIsLoading(false);
                alert(e?.message || 'Authentication error');
            });
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

                    <h2 className="text-[24px] font-bold text-[#212121] text-center leading-[36px]">
                        Welcome to NexSpace
                    </h2>
                    <p className="text-[16px] text-[#212121] text-center leading-[24px] font-normal">
                        Virtual coworking & accountability for connected, productive teams.
                    </p>
                </div>

                {/* Email Input & Button (placeholder for later) */}
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
                    <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 py-2 border border-[#E0E0E0] rounded-xl bg-[#F2F4F6]">
                        <img src="/google-icon.svg" alt="Google" className="w-5 h-5" />
                        <span className="text-sm font-semibold text-[#212121]">Continue with Google</span>
                    </button>

                    <button onClick={handleMicrosoftLogin} className="w-full flex items-center justify-center gap-3 py-2 border border-[#E0E0E0] rounded-xl bg-[#F2F4F6]">
                        <img src="/microsoft-icon.svg" alt="Microsoft" className="w-5 h-5" />
                        <span className="text-sm font-semibold text-[#212121]">Continue with Microsoft</span>
                    </button>
                </div>
            </div>

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
