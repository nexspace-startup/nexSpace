// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingView/_landingView";
import Setup from "./Pages/Setup/Setup";
import Dashboard from "./Pages/Dashboard/Dashboard";
import Signin from "./Pages/Signin/Signin";
import { GuestRoute, ProtectedRoute } from "./routerGuard";
import InvitePage from "./Pages/AcceptInvitation";

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/invite/:token" element={<InvitePage />} /> 
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/setup" element={<Setup />} />
        </Route>
        {/* <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<Signin />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
