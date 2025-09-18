// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { useUserStore } from "./stores/userStore";
import LandingPage from "./components/LandingPage";
import Dashboard from "./Pages/Dashboard/Dashboard";
import { GuestRoute, ProtectedRoute } from "./routerGuard";
import InvitePage from "./Pages/AcceptInvitation";
import Signin from "./Pages/Signin/Signin";
import Setup from "./Pages/Setup/Setup";
import Toaster from "./components/Toaster";

function App() {
  const status = useUserStore((s) => s.status);
  const init = useUserStore((s) => s.init);

  useEffect(() => {
    if (status === "idle") void init();
  }, [status, init]);

  return (
    <Router>
      <Toaster />
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/setup" element={< Setup />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
