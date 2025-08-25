import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuth } from "./store/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function Protected({ children }) {
  const { accessToken } = useAuth();
  if (!accessToken) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="flex justify-between items-center mb-6">
        <Link to="/" className="font-bold text-xl">
          Smart Job Tracker
        </Link>
        <nav className="flex gap-4">
          {!user ? (
            <Link to="/login" className="text-blue-600">
              Login
            </Link>
          ) : (
            <button onClick={logout} className="text-red-600">
              Logout
            </button>
          )}
        </nav>
      </header>

      <Routes>
        <Route
          path="/"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route path="/login" element={<Login />} />
      </Routes>
    </div>
  );
}
