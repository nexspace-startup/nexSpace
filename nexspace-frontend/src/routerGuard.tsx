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
    return (
      <div className="min-h-screen grid place-items-center bg-[#202024] text-white">
        <div className="text-sm opacity-80">Checking session…</div>
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

  // ✅ allow authed users to access public invite page
  const allowWhileAuthed = [/^\/invite\/[^/]+$/];
  const isAllowed = allowWhileAuthed.some(rx => rx.test(loc.pathname));

  if (status === "authed" && user?.id && !isAllowed) {
    // keep your existing behavior for other guest pages
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
