// src/routes/Guards.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useUserStore } from "./stores/userStore";

export function ProtectedRoute() {
  const { status, init } = useUserStore();
  const loc = useLocation();

  useEffect(() => {
    // Initialize session once when status is idle
    if (status === "idle") void init();
  }, [status, init]);

  if (status === "idle" || status === "checking") {
    const isInvite = /^\/invite\/[^/]+$/.test(loc.pathname);
    const msg = isInvite ? "Preparing your invitation…" : "Checking session…";
    return (
      <div className="min-h-screen grid place-items-center bg-[#202024] text-white">
        <div className="flex items-center gap-3 text-sm opacity-80">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span>{msg}</span>
        </div>
      </div>
    );
  }
  if (status === "guest") {
    // optional: send to /signin instead of "/", and carry where they came from
    return <Navigate to="/signin" replace state={{ from: loc }} />;
  }
  return <Outlet />;
}

export function GuestRoute() {
  const { user, status, init } = useUserStore();
  const loc = useLocation();

  useEffect(() => {
    if (status === "idle") void init();
  }, [status, init]);

  if (status === "idle" || status === "checking") {
    return (
      <div className="min-h-screen grid place-items-center bg-[#202024] text-white">
        <div className="text-sm opacity-80">Loading…</div>
      </div>
    );
  }

  // If authenticated and there is a return hint to an invite, honor it
  if (status === "authed") {
    const sp = new URLSearchParams(loc.search || "");
    const redirectQ = sp.get("redirect");
    const from: any = (loc as any).state?.from;
    const fromPath = typeof from === 'string'
      ? from
      : (from && typeof from === 'object' && from.pathname)
        ? `${from.pathname}${from.search || ''}${from.hash || ''}`
        : null;
    const hint = redirectQ || fromPath;
    if (hint && /^\/invite\//.test(hint)) {
      return <Navigate to={hint} replace />;
    }
    if (user?.id) {
      return <Navigate to="/dashboard" replace />;
    }
  }
  return <Outlet />;
}
