import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserStore } from "../../stores/userStore";
import { googleGetCode } from "../../lib/oauthClients";
import { toast } from "../../stores/toastStore";
import { AuthService, getMe, type MeResponse } from "../../services/authService";
import microsoftIcon from '../../assets/Microsoft.svg'
import googleIcon from '../../assets/Google.svg'

type Provider = "google" | "microsoft";

type FormData = {
    email: string;
    // Keep key present for resolver typing; may be undefined when not required
    password: string | undefined;
};

export default function Signin() {
    const setUser = useUserStore((s) => s.setUser);
    const navigate = useNavigate();
    const location = useLocation();

    const [isChecking, setIsChecking] = useState(false);
    const [emailChecked, setEmailChecked] = useState(false);
    const [emailExists, setEmailExists] = useState<boolean | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [requirePassword, setRequirePassword] = useState(false);
    const [authError, setAuthError] = useState<string>("");
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    const dynamicSchema = useMemo(
        () =>
            z.object({
                email: z
                    .email("Enter a valid email address")
                    .min(1, "Email is required"),
                password: requirePassword
                    ? z.string().min(1, "Password is required")
                    : z.string().optional(),
            }),
        [requirePassword]
    );

    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
        clearErrors,
        watch,
        setValue,
    } = useForm<FormData>({ resolver: zodResolver(dynamicSchema), shouldUnregister: true });

    const email = watch("email");

    // Password step controlled by state via showPassword

    async function checkEmailExists(_email: string): Promise<boolean> {
        return AuthService.checkEmail(_email);
    }

    async function loginWithEmailPassword(
        _email: string,
        _password: string
    ): Promise<{ ok: boolean; user?: any; workspaces?: any[] }> {
        const res = await AuthService.signin(_email, _password);
        // keep same shape as before
        if (res.ok) return { ok: true, user: { email: _email }, workspaces: [] };
        return { ok: false } as any;
    }

    function computeRedirectTarget(): string | null {
        // Priority: ?redirect=/path → location.state.from → null
        const searchParams = new URLSearchParams(location.search || "");
        const q = searchParams.get("redirect");
        if (q && typeof q === "string") return q;
        const from: any = (location as any).state?.from;
        if (!from) return null;
        if (typeof from === "string") return from;
        if (typeof from === "object" && from.pathname) {
            return `${from.pathname}${from.search || ""}${from.hash || ""}`;
        }
        return null;
    }

    async function redirectPostLogin(forceTarget?: string | null): Promise<void> {
        const me: MeResponse | null = await getMe();
        const target = (forceTarget && forceTarget !== "/signin") ? forceTarget : computeRedirectTarget();
        // update store with basic identity
        if (me?.user) {
            const first = me.user.first_name || "";
            const last = me.user.last_name || "";
            const name = [first, last].filter(Boolean).join(" ") || undefined;
            setUser({ id: me.user?.id, name, email: me.user?.email, avatar: me?.user?.avatar || "" });
        }
        if (target && target !== "/signin") {
            navigate(target, { replace: true });
        } else if (me?.workspaces && me.workspaces.length > 0) {
            navigate("/dashboard", { replace: true });
        } else {
            navigate("/setup", { replace: true });
        }
    }

    // Reset flow when email changes
    useEffect(() => {
        setEmailChecked(false);
        setEmailExists(null);
        setShowPassword(false);
        setRequirePassword(false);
        setAuthError("");
        clearErrors(["email", "password"]);
        setValue("password", "");
    }, [email, clearErrors, setValue]);

    const onSubmit = async (data: FormData) => {
        setAuthError("");
        if (!emailChecked) {
            if (!data.email) {
                setError("email", { message: "Enter an email" });
                return;
            }
            setIsChecking(true);
            try {
                const exists = await checkEmailExists(data.email);
                setEmailExists(exists);
                setEmailChecked(true);
                clearErrors("email");
                if (exists) {
                    setShowPassword(true);
                    setRequirePassword(true);
                    setAuthError("");
                } else {
                    setShowPassword(false);
                    setRequirePassword(false);
                    setValue("password", "");
                    setAuthError("No account found");
                }
            } catch (e: any) {
                setAuthError(e?.message || "Could not verify email");
            } finally {
                setIsChecking(false);
            }
            return;
        }

        if (emailExists && showPassword) {
            if (!data.password) {
                setError("password", { message: "Enter password" });
                return;
            }
            setIsChecking(true);
            try {
                const res = await loginWithEmailPassword(data.email, data.password);
                if (!res.ok || !res.user) {
                    setAuthError("Enter your correct password.");
                    return;
                }
                await redirectPostLogin();
            } catch (e: any) {
                setAuthError(e?.message || "Authentication error");
            } finally {
                setIsChecking(false);
            }
            return;
        }

        // Email was checked and does not exist
        setValue("password", "");
        setAuthError("No account found");
    };

    const handleGoogleLogin = () => handleOAuth("google");
    const handleMicrosoftLogin = () => handleOAuth("microsoft");

    async function handleOAuth(provider: Provider) {
        try {
            if (provider === "google") {
                setIsGoogleLoading(true);
                const code = await googleGetCode();
                if (!code) throw new Error("Google sign-in was cancelled.");
                const next = computeRedirectTarget();
                const ok = await AuthService.googleCallback(code, "postmessage", next);
                if (!ok) throw new Error("Google authentication failed");
                await redirectPostLogin(next);
                return;
            }
            // Preserve existing Microsoft mock behavior
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || "Authentication error");
        } finally {
            setIsGoogleLoading(false);
        }
    }

    return (
        <main className="min-h-screen w-full bg-[#202024] text-white font-manrope flex flex-col">
            <div className="flex-1 flex items-center justify-center px-5 py-10">
                <div className="w-full max-w-[580px] flex flex-col items-center gap-10">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-b from-[#B7F2D4] to-[#48FFA4]" aria-hidden="true" />
                        <div className="w-full max-w-[400px] flex flex-col items-center gap-2">
                            <h1 className="text-center font-semibold tracking-[-0.01em] leading-[1.5] text-xl sm:text-2xl">Welcome to NexSpace</h1>
                            <p className="text-center leading-[1.5]  opacity-95 text-sm sm:text-base">
                                Virtual coworking & accountability for connected, productive teams.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className="w-full max-w-[480px] bg-[#18181B] rounded-2xl p-6 sm:p-10 flex flex-col gap-8"
                    >
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3">
                                <label htmlFor="email" className="text-xs sm:text-sm font-medium font-clashGrotesk">
                                    Email*
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    placeholder="you@company.com"
                                    {...register("email")}
                                    className={`h-10 w-full rounded-2xl px-4 text-[14px] bg-[rgba(128,136,155,0.10)] placeholder-[#A3A3A3] focus:outline-none border ${errors.email ? "border-[#FF6060]" : "border-transparent focus:border-[#4285F4]"
                                        }`}
                                />
                                {errors.email && (
                                    <p className="text-[#FF6060] text-xs">{errors.email.message}</p>
                                )}
                            </div>

                            {showPassword && (
                                <div className="flex flex-col gap-3">
                                    <label htmlFor="password" className="text-xs sm:text-sm font-medium">
                                        Password*
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        autoComplete="current-password"
                                        placeholder="Enter your password"
                                        {...register("password")}
                                        className={`h-10 w-full rounded-2xl px-4 text-[14px] bg-[rgba(128,136,155,0.10)] placeholder-[#A3A3A3] focus:outline-none border ${errors.password ? "border-[#FF6060]" : "border-transparent focus:border-[#4285F4]"
                                            }`}
                                    />
                                    {errors.password && (
                                        <p className="text-[#FF6060] text-xs">{errors.password.message}</p>
                                    )}
                                </div>
                            )}

                            {authError && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-[14px] h-[14px] rounded-full bg-[#FF6060]" aria-hidden="true" />
                                        <span className="text-xs text-[#FF6060]">{authError}</span>
                                    </div>
                                    {emailChecked && emailExists === false && (
                                        <button
                                            type="button"
                                            onClick={() => navigate("/setup", { state: { email } })}
                                            className="text-[14px] font-semibold underline text-[#4285F4]"
                                        >
                                            Create Account?
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Primary action button moved here to reduce gap */}
                            <button
                                type="submit"
                                disabled={isChecking}
                                className="w-full h-10 rounded-xl bg-[#4285F4] text-white text-[13px] sm:text-[14px] font-semibold shadow-[0px_4px_30px_rgba(142,166,246,0.2)] hover:bg-[#4b90ff] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {showPassword ? "Continue" : isChecking ? "Checking..." : "Continue with Email"}
                            </button>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-[#828282]">
                            <div className="h-px bg-[#26272B] flex-1" />
                            <span>or</span>
                            <div className="h-px bg-[#26272B] flex-1" />
                        </div>

                        <div className="flex flex-col gap-6">
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={isGoogleLoading}
                                className="w-full h-10 rounded-xl bg-[rgba(128,136,155,0.25)] disabled:opacity-60 disabled:cursor-not-allowed text-white inline-flex items-center justify-center gap-3 hover:bg-[rgba(128,136,155,0.35)]"
                            >
                                {isGoogleLoading ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                        </svg>
                                        <span className="text-[13px] sm:text-[14px] font-semibold">Signing in…</span>
                                    </>
                                ) : (
                                    <>
                                        <img
                                            src={googleIcon}
                                            alt="Google"
                                            className="w-5 h-5"
                                        />
                                        <span className="text-[13px] sm:text-[14px] font-semibold">Continue with Google</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleMicrosoftLogin}
                                className="w-full h-10 rounded-xl bg-[rgba(128,136,155,0.25)] text-white inline-flex items-center justify-center gap-3 hover:bg-[rgba(128,136,155,0.35)]"
                            >
                                <img
                                    src={microsoftIcon}
                                    alt="Microsoft"
                                    className="w-5 h-5"
                                />
                                <span className="text-[13px] sm:text-[14px] font-semibold">Continue with Microsoft</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            <footer className="px-6 pb-4">
                <p className="text-center text-xs sm:text-sm text-[#80889B] mx-auto max-w-xs">
                    By signing up, you agree to our <span className="underline">Terms of Service</span> and <span className="underline">Privacy Policy</span>.
                </p>
            </footer>
        </main>
    );
}
