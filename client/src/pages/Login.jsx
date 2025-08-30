import React, { useState } from "react";
import api from "../api";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";

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
      // server returns: { user, accessToken, refreshToken }
      setAuth(data.user, data.accessToken, data.refreshToken);
      nav("/", { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto bg-white border rounded p-4 space-y-4">
      <h1 className="text-xl font-bold">Login</h1>
      {!!err && <div className="text-red-600 text-sm">{err}</div>}
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Email</label>
          <input
            className="border rounded w-full p-2"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Password</label>
          <input
            className="border rounded w-full p-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <button
          disabled={busy}
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50 w-full"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
