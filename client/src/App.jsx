import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuth } from "./store/auth";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ImportCSV from "./pages/ImportCSV";

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen relative">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0 bg-grid"></div>

      {/* NAV */}
      <nav className="nav sticky top-0 z-30">
        <div className="container-shell py-3 flex items-center justify-between">
          <Link to="/" className="brand">SJT</Link>
          <div className="flex items-center gap-2">
            {!user && (
              <>
                <Link to="/login" className="btn">Login</Link>
                <Link to="/register" className="btn-primary px-5 py-2 rounded-xl">Register</Link>
              </>
            )}
            {user && (
              <>
                <Link to="/import" className="btn">Import</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <main className="container-shell py-6">
        <Routes>
          <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/import" element={user ? <ImportCSV /> : <Navigate to="/login" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
