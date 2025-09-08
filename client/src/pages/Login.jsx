import React, { useState } from "react";
import api from "../api";
import { useAuth } from "../store/auth";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { data } = await api.post("/login", { email, password });
      setAuth(data.user, data.accessToken, data.refreshToken);
      nav("/", { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 card">
      <h1 className="panel-title mb-1">Welcome back</h1>
      <p className="muted mb-6">Sign in to continue tracking your job applications.</p>

      {!!err && <div className="mb-3 text-red-400 mono">{err}</div>}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm muted mb-1">Email</label>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm muted mb-1">Password</label>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button className="btn-primary w-full h-11 font-semibold">
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="mt-4 text-sm">
        <span className="muted">No account?</span>{" "}
        <Link to="/register" className="text-primary hover:underline">Create one</Link>
      </div>
    </div>
  );
}
