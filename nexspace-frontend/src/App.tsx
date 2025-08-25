// import { BrowserRouter } from 'react-router-dom';
// import './App.css';
// import './index.css';
// import { Suspense } from 'react';
// import AppRoutes from './router';

// function App() {

//   return (
//     // <BrowserRouter>
//     //   <Suspense fallback={<div>Loading...</div>}>
//     //     <AppRoutes />
//     //   </Suspense>
//     // </BrowserRouter>
//   )
// }

// export default App

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingView/_landingView';
import AuthPage from './components/AuthenticationView/_authenticationView'; // make sure this path is correct
import AccountSetup from './components/Setup/_accountSetupView';
import WorkspaceSetup from './components/Setup/_workSpaceSetupView';
import InviteTeam from './components/Setup/_invitationView';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<AuthPage />} />
        <Route path="/setup/account" element={<AccountSetup />} />
        <Route path="/setup/workspace" element={<WorkspaceSetup />} />
        <Route path="/setup/invite" element={<InviteTeam />} />
      </Routes>
    </Router>
  );
}

export default App;
