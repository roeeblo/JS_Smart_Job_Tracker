// client/src/App.jsx
import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import { useAuth } from "./store/auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ImportCSV from "./pages/ImportCSV";

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/60 backdrop-blur supports-[backdrop-filter]:bg-slate-950/40">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">Smart Job Tracker</Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-slate-300 hover:text-white">Dashboard</Link>
            <Link to="/import" className="text-slate-300 hover:text-white">Import</Link>
            {!user && (
              <>
                <Link to="/login" className="text-sky-400 hover:text-sky-300">Login</Link>
                <Link to="/register" className="text-sky-400 hover:text-sky-300">Register</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl p-4">
        <Routes>
          {/* מצב הדגמה: תמיד מראה דשבורד גם אם לא מחוברים */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportCSV />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </main>
    </div>
  );
}
