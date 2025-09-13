// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
// import Setup from "./Pages/Setup/Setup";
import Dashboard from "./Pages/Dashboard/Dashboard";
// import Signin from "./Pages/Signin/Signin";
import { GuestRoute, ProtectedRoute } from "./routerGuard";
import InvitePage from "./Pages/AcceptInvitation";
import AuthenticationPage from './components/Authentication';
import PersonalInformation from './components/PersonalInfo';
import InvitationSetup from "./components/InvitationSetup";

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signin" element={<AuthenticationPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          {/* <Route path="/setup" element={<PersonalInformation />} /> */}
          <Route path="/setup" element={<PersonalInformation onValidNext={(data) => console.log("Form data:", data)} />} />

        </Route>
        {/* <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<Signin />} /> */}
      </Routes>
    </Router>
  );
}

export default App;
