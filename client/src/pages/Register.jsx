import React, { useState } from "react";
import api from "../api";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
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
      setDone(true);
    } catch (e) {
      const msg =
        e?.response?.status === 409
          ? "Email already exists"
          : e?.response?.data?.error || "Register failed";
      setErr(msg);
    }
  };

  if (done) {
    return (
      <div className="max-w-sm mx-auto mt-12 card">
        <h1 className="text-2xl font-semibold mb-2">Check your email</h1>
        <p className="muted">
          We sent you a verification link. After you verify, you can{" "}
          <button className="link" onClick={() => nav("/login")}>log in</button>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-12 card">
      <h1 className="text-2xl font-semibold mb-4">Create account</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="input w-full"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input w-full"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input w-full"
          placeholder="Password (min 6)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && <div className="text-red-400 text-sm">{err}</div>}

        <button className="btn-primary w-full">Sign up</button>
      </form>

      <div className="text-sm muted mt-3">
        Already have an account?{" "}
        <Link to="/login" className="link">Login</Link>
      </div>
    </div>
  );
}
