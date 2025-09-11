import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuth } from "./store/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import OAuthCallback from "./pages/OAuthCallback";

export default function App() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
      <nav className="backdrop-blur bg-white/5 border-b border-white/10 p-4 flex justify-between">
        <Link to="/" className="font-bold">Smart Job Tracker</Link>
        <div className="space-x-4">
          {!user && <Link to="/login" className="text-cyan-300">Login</Link>}
          {user && (
            <>
              <span className="text-slate-300">Hi, {user.name}</span>
              <button className="text-rose-300" onClick={logout}>Logout</button>
            </>
          )}
        </div>
      </nav>

      <main className="p-4">
        <Routes>
          <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
