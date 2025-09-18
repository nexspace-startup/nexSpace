// src/Pages/Invite/InvitePage.tsx
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useUserStore } from "../stores/userStore";
import { acceptInvitation } from "../services/dashboardService";

type View =
  | "checking"
  | "invalid-token"
  | "redirecting-signin"
  | "accepting"
  | "accepted"
  | "already-used"
  | "expired"
  | "not-found"
  | "email-mismatch"
  | "error";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const loc = useLocation();

  const status = useUserStore((s) => s.status); // "idle" | "checking" | "authed" | "guest"
  const init = useUserStore((s) => s.init);

  const [view, setView] = useState<View>("checking");
  const [hint, setHint] = useState<string | undefined>(undefined); // optional extra info
  const acceptingOnce = useRef(false); // avoid double POST in StrictMode

  // 0) Synchronous token sanity check (UUID as per backend route)
  useEffect(() => {
    if (!token || !UUID_RE.test(token)) {
      setView("invalid-token");
    }
  }, [token]);

  // 1) Know auth status; bounce guests to signin (carry return path)
  useEffect(() => {
    if (view === "invalid-token") return;

    if (status === "idle") {
      void init();
      return;
    }

    if (status === "guest") {
      setView("redirecting-signin");
      const next = encodeURIComponent(loc.pathname);
      navigate(`/signin?redirect=${next}`, { replace: true });
      return;
    }
  }, [status, init, loc.pathname, navigate, view]);

  // 2) When authed & token looks valid → accept exactly once
  useEffect(() => {
    if (view === "invalid-token") return;
    if (status !== "authed") return;
    if (!token) return;
    if (acceptingOnce.current) return;

    acceptingOnce.current = true;
    setView("accepting");

    (async () => {
      try {
        const result = await acceptInvitation(token);
        if (result?.accepted) {
          setView("accepted");
          navigate("/dashboard", { replace: true });
          return;
        }
        // Unexpected shape → treat as generic error
        setView("error");
      } catch (e: any) {
        const statusCode = e?.response?.status as number | undefined;
        const err0 = e?.response?.data?.errors?.[0];
        const code = (err0?.code || err0?.message || "").toUpperCase();

        // map backend statuses/codes
        if (statusCode === 410 && (code === "ALREADY_USED" || err0?.message === "ALREADY_USED")) {
          setView("already-used");
          return;
        }
        if (statusCode === 410 && (code === "EXPIRED" || err0?.message === "EXPIRED")) {
          setView("expired");
          return;
        }
        if (statusCode === 404) {
          setView("not-found");
          return;
        }
        if (statusCode === 400 && (code === "VALIDATION_ERROR")) {
          setView("invalid-token");
          return;
        }
        if (statusCode === 409 && (code === "EMAIL_MISMATCH" || err0?.message === "EMAIL_MISMATCH")) {
          setView("email-mismatch");
          setHint("Please sign in with the same email address that received this invitation.");
          return;
        }
        if (statusCode === 401) {
          // cookie/session missing → send back to signin with return param
          setView("redirecting-signin");
          const next = encodeURIComponent(loc.pathname);
          navigate(`/signin?redirect=${next}`, { replace: true });
          return;
        }
        setView("error");
      }
    })();
  }, [status, token, navigate, view]);

  /* ---------------- UI states (no spinners; minimal text) ---------------- */
  if (view === "invalid-token")
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Invalid invitation link</h1>
        <p className="text-sm text-slate-600">This link is malformed. Please check the URL or request a new invite.</p>
      </div>
    );

  if (view === "already-used")
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Invitation already used</h1>
        <p className="text-sm text-slate-600">You’re already a member, or this invitation has been claimed.</p>
        <Link to="/dashboard" replace className="text-indigo-600 underline text-sm">
          Go to Dashboard
        </Link>
      </div>
    );

  if (view === "expired")
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Invitation expired</h1>
        <p className="text-sm text-slate-600">This invitation has expired. Ask a workspace admin to send a new one.</p>
      </div>
    );

  if (view === "not-found")
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Invitation not found</h1>
        <p className="text-sm text-slate-600">This link may be invalid or revoked. Please request a fresh invitation.</p>
      </div>
    );

  if (view === "email-mismatch")
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-lg font-semibold">Signed-in email doesn’t match</h1>
        <p className="text-sm text-slate-600">
          {hint || "Please sign in with the email address that received this invitation."}
        </p>

      </div>
    );

  if (view === "error")
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-slate-600">We couldn’t process this invitation. Please try again later.</p>
      </div>
    );

  // "checking" | "redirecting-signin" | "accepting" | "accepted"
  if (view === "checking" || view === "accepting" || view === "redirecting-signin") {
    const label = view === "redirecting-signin" ? "Redirecting to sign in…" : view === "accepting" ? "Accepting invitation…" : "Preparing…";
    return (
      <div className="min-h-[40vh] grid place-items-center text-white">
        <div className="flex items-center gap-3 text-sm opacity-80">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span>{label}</span>
        </div>
      </div>
    );
  }
  return null;
}
