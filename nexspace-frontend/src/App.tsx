// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { useUserStore } from "./stores/userStore";
import { GuestRoute, ProtectedRoute } from "./routerGuard";
import Toaster from "./components/Toaster";

const LandingPage = lazy(() => import("./components/LandingPage"));
const Signin = lazy(() => import("./Pages/Signin/Signin"));
const Setup = lazy(() => import("./Pages/Setup/Setup"));
const InvitePage = lazy(() => import("./Pages/AcceptInvitation"));
const Dashboard = lazy(() => import("./Pages/Dashboard/Dashboard"));

function FullscreenFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#202024] text-sm font-medium text-white">
      Loading…
    </div>
  );
}

function App() {
  const status = useUserStore((s) => s.status);
  const init = useUserStore((s) => s.init);

  useEffect(() => {
    if (status === "idle") void init();
  }, [status, init]);

  return (
    <Router>
      <Toaster />
      <Suspense fallback={<FullscreenFallback />}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<Signin />} />
            <Route path="/setup" element={<Setup />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
