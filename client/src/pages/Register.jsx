import React, { useState } from "react";
import api from "../api";
import { useAuth } from "../store/auth";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const setAuth = useAuth((s) => s.setAuth);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim() || !email.trim() || !password.trim()) {
      setErr("Name, email and password are required");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    try {
      await api.post("/users", { name, email, password });
      const login = await api.post("/login", { email, password });
      setAuth(login.data.user, login.data.accessToken, login.data.refreshToken);
      nav("/");
    } catch (e) {
      const msg =
        e?.response?.status === 409
          ? "Email already exists"
          : e?.response?.data?.error || "Register failed";
      setErr(msg);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 card">
      <h1 className="panel-title mb-1">Create account</h1>
      <p className="muted mb-6">Join Smart Job Tracker in seconds.</p>

      {err && <div className="mb-3 text-red-400 mono">{err}</div>}

      <form onSubmit={submit} className="space-y-3">
        <input
          className="input"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          placeholder="Password (min 6)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn-primary w-full h-11 font-semibold">Sign up</button>
      </form>

      <div className="text-sm mt-4">
        <span className="muted">Already have an account?</span>{" "}
        <Link to="/login" className="text-primary hover:underline">Login</Link>
      </div>
    </div>
  );
}
