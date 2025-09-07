// src/routes/Guards.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useUserStore } from "./stores/userStore";

export function ProtectedRoute() {
  const { status, init } = useUserStore();
  const loc = useLocation();

  useEffect(() => {
    if (status === "idle") void init();
  }, [status, init]);

  if (status === "idle" || status === "checking") return null;
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

  if (status === "idle" || status === "checking") return null;

  // ✅ allow authed users to access public invite page
  const allowWhileAuthed = [/^\/invite\/[^/]+$/];
  const isAllowed = allowWhileAuthed.some(rx => rx.test(loc.pathname));

  if (status === "authed" && user?.id && !isAllowed) {
    // keep your existing behavior for other guest pages
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}
