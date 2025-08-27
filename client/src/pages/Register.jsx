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
    <div className="max-w-sm mx-auto mt-12 bg-white p-6 rounded-xl shadow">
      <h1 className="text-2xl font-semibold mb-4">Create account</h1>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full border p-2 rounded"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded"
          placeholder="Password (min 6)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && <div className="text-red-600 text-sm">{err}</div>}

        <button className="w-full bg-green-600 text-white p-2 rounded">
          Sign up
        </button>
      </form>

      <div className="text-sm text-gray-600 mt-3">
        Already have an account?{" "}
        <Link to="/login" className="text-blue-600">Login</Link>
      </div>
    </div>
  );
}
