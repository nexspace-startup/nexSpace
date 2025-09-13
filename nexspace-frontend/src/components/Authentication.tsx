import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { googleGetCode } from '../lib/oauthClients';

type Provider = 'google' | 'microsoft';

const emailSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Enter a valid email address'),
    password: z.string().optional(), // dynamically required later
});

type FormData = z.infer<typeof emailSchema>;

export default function AuthenticationPage() {
    const setUser = useUserStore((state) => state.setUser);
    const navigate = useNavigate();

    const [emailVerified, setEmailVerified] = useState(false);
    const [backendError, setBackendError] = useState('');

    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
        clearErrors,
        watch,
    } = useForm<FormData>({
        resolver: zodResolver(emailSchema),
    });

    const email = watch('email');
    const password = watch('password');

    // MOCK backend email check
    const checkEmailBackend = async (email: string) => {
        // === replace true with false to test failure ===
        return true; // ✅ always true for now
    };

    // MOCK backend password check
    const checkPasswordBackend = async (email: string, password: string) => {
        // === replace true with false to test failure ===
        return true; // ✅ always true for now
    };

    const onSubmit = async (data: FormData) => {
        if (!emailVerified) {
            // Step 1: verify email
            if (!data.email) {
                setError('email', { message: 'Enter an email' });
                return;
            }
            const valid = await checkEmailBackend(data.email);
            if (!valid) {
                setBackendError('Enter your correct email.');
                setEmailVerified(false);
                return;
            }
            clearErrors('email');
            setBackendError('');
            setEmailVerified(true);
        } else {
            // Step 2: verify password
            if (!data.password) {
                setError('password', { message: 'Enter password' });
                return;
            }
            const valid = await checkPasswordBackend(data.email, data.password);
            if (!valid) {
                setBackendError('Enter your correct password.');
                return;
            }
            // ✅ Success → Navigate
            setBackendError('');
            setUser({ email: data.email }); // mock user
            navigate('/setup'); // or dashboard, adjust as needed
        }
    };

    const handleGoogleLogin = () => {
        handleOAuth('google');
    };
    const handleMicrosoftLogin = () => {
        handleOAuth('microsoft');
    };

    async function handleOAuth(provider: 'google' | 'microsoft') {
        try {
            let result: any;
            if (provider === 'google') {
                const code = await googleGetCode();
                if (!code) throw new Error('Google sign-in was cancelled.');
                // result = await completeAuthentication('google', { code, redirectUri: 'postmessage' });
            }
            // leaving Microsoft commented
            result = { isAuthenticated: true, user: { email: 'mock@nex.com' }, workspaces: [] };

            if (!result?.isAuthenticated || !result.user) {
                alert('Authentication failed. Please try again.');
                return;
            }
            setUser(result.user);
            const ws = result.workspaces ?? [];
            if (ws.length === 0) {
                navigate('/setup');
            } else {
                navigate('/dashboard');
            }
        } catch (e: any) {
            console.error(e);
            alert(e?.message || 'Authentication error');
        }
    }

    return (
        <div className="fixed inset-0 w-screen h-screen bg-[#202024] flex flex-col items-center justify-center overflow-hidden px-4">
            {/* Logo */}
            <div className="w-20 h-20 mb-8">
                <div className="w-full h-full rounded-full bg-gradient-to-b from-[#B7F2D4] to-[#48FFA4] flex items-center justify-center">
                    <span className="text-black text-2xl font-bold">N</span>
                </div>
            </div>

            {/* Heading */}
            <h1 className="text-white font-semibold text-center text-[24px] w-[254px] h-[36px]">
                Welcome to NexSpace
            </h1>
            <p className="text-white text-base mt-2 text-center max-w-md w-[400px] h-[48px] text-[16px]">
                Virtual coworking & accountability for connected, productive teams.
            </p>

            {/* Auth Card */}
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="mt-10 w-full max-w-md bg-[#1a1a1c] rounded-2xl p-6 flex flex-col gap-5"
            >
                {/* Email Input */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-white text-sm font-medium">
                        Email *
                    </label>
                    <input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        {...register('email')}
                        className={`bg-[#2b2b2e] text-white placeholder-gray-400 rounded-2xl h-[40px] px-4 py-3 focus:outline-none focus:ring-2 ${errors.email ? 'ring-red-500' : 'ring-[#4285F4]'
                            }`}
                    />
                    {errors.email && (
                        <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                    )}
                </div>

                {/* Conditionally show password */}
                {emailVerified && (
                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="password"
                            className="text-white text-sm font-medium"
                        >
                            Password *
                        </label>
                        <input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            {...register('password')}
                            className={`bg-[#2b2b2e] text-white placeholder-gray-400 rounded-2xl h-[40px] px-4 py-3 focus:outline-none focus:ring-2 ${errors.password ? 'ring-red-500' : 'ring-[#4285F4]'
                                }`}
                        />
                        {errors.password && (
                            <p className="text-red-500 text-sm mt-1">
                                {errors.password.message}
                            </p>
                        )}
                    </div>
                )}

                {/* Backend error */}
                {backendError && (
                    <p className="text-red-500 text-sm mt-1">{backendError}</p>
                )}

                {/* Continue Button */}
                <button
                    type="submit"
                    className="w-[400px] h-[40px] bg-[#4285F4] rounded=xl text-white text-base font-medium rounded-lg shadow-[0_4px_30px_rgba(142,166,246,0.2)] self-center hover:scale-105 transition"
                >
                    {emailVerified ? 'Continue' : 'Continue with Email'}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4">
                    <hr className="flex-grow border-t border-gray-600" />
                    <span className="text-gray-400 text-sm">or</span>
                    <hr className="flex-grow border-t border-gray-600" />
                </div>

                {/* Google Auth */}
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="flex items-center justify-center gap-3 w-full bg-[#2b2b2e] text-white rounded-xl py-[9px] px-[86px] hover:bg-[#3a3a3e] transition"
                >
                    <img
                        src="https://www.svgrepo.com/show/475656/google-color.svg"
                        alt="Google"
                        className="w-5 h-5"
                    />
                    <span className="text-sm font-medium">Continue with Google</span>
                </button>

                {/* Microsoft Auth */}
                <button
                    type="button"
                    onClick={handleMicrosoftLogin}
                    className="flex items-center justify-center gap-3 w-full bg-[#2b2b2e] text-white py-[9px] px-[86px] rounded-xl hover:bg-[#3a3a3e] transition"
                >
                    <img
                        src="https://www.svgrepo.com/show/452213/microsoft.svg"
                        alt="Microsoft"
                        className="w-5 h-5"
                    />
                    <span className="text-sm font-medium">Continue with Microsoft</span>
                </button>
            </form>

            {/* Footer */}
            <p className="mt-8 text-sm text-gray-400 text-center max-w-xs">
                By signing up, you agree to our{' '}
                <span className="underline cursor-pointer">Terms of Service</span> and{' '}
                <span className="underline cursor-pointer">Privacy Policy</span>.
            </p>
        </div>
    );
}
