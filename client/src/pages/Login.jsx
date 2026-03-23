import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../store/auth";

export default function Login() {
  const nav = useNavigate();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!email.trim() || !password.trim()) {
      setErr("Email and password are required");
      return;
    }

    try {
      setBusy(true);
      const { data } = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });
      setAuth(data.user, data.accessToken, data.refreshToken);
      nav("/", { replace: true });
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12 card">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="input w-full"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input w-full"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button disabled={busy} className="btn-primary w-full">
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <div className="text-sm muted mt-3">
        Need an account?{" "}
        <Link to="/register" className="link">
          Register
        </Link>
      </div>
    </div>
  );
}
