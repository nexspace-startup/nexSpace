import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingView/_landingView';
import Setup from './Pages/Setup/Setup';
import Dashboard from './Pages/Dashboard/Dashboard';
import Signin from './Pages/Signin/Signin';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<Signin />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/dashboard" element={<Dashboard />} />

      </Routes>
    </Router>
  );
}

export default App;
