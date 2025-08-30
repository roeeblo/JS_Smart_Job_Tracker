import React from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuth } from "./store/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ImportCSV from "./pages/ImportCSV";

function Private({ children }) {
  const { accessToken } = useAuth();
  if (!accessToken) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { accessToken, logout } = useAuth();

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      {/* Top Nav */}
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-lg font-semibold">
            Smart Job Tracker
          </Link>
          {accessToken && (
            <>
              <Link to="/" className="text-blue-600 underline">
                Dashboard
              </Link>
              <Link to="/import" className="text-blue-600 underline">
                Import CSV
              </Link>
            </>
          )}
        </div>
        <div>
          {accessToken ? (
            <button onClick={logout} className="text-red-600">
              Logout
            </button>
          ) : (
            <Link to="/login" className="text-blue-600 underline">
              Login
            </Link>
          )}
        </div>
      </nav>

      {/* Routes */}
      <Routes>
        <Route
          path="/"
          element={
            <Private>
              <Dashboard />
            </Private>
          }
        />
        <Route
          path="/import"
          element={
            <Private>
              <ImportCSV />
            </Private>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route
          path="*"
          element={<Navigate to={accessToken ? "/" : "/login"} replace />}
        />
      </Routes>
    </div>
  );
}
