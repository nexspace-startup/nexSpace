// src/routes/AppRoutes.tsx
import { Routes, Route } from "react-router-dom";
import { lazy } from "react";

// Lazy imports (each becomes its own chunk)
const Home = lazy(() => import("./components/LandingView/_landingView"));
const Login = lazy(() => import("./components/AuthenticationView/_authenticationView"));

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />

      {/* Protected routes comes here */}

      {/* 404 */}
      {/* <Route path="*" element={<NotFound />} /> */}
    </Routes>
  );
}
