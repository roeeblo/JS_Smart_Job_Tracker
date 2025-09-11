import React from "react";

const SERVER_ORIGIN =
  import.meta.env.VITE_SERVER_ORIGIN || "http://localhost:4000";

export default function Login() {
  const loginWithGoogle = () => {
    window.location.href = `${SERVER_ORIGIN.replace(/\/$/, "")}/auth/google`;
  };

  return (
    <div className="max-w-sm mx-auto bg-white/10 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-xl">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>
      <button
        onClick={loginWithGoogle}
        className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 font-medium hover:bg-slate-200 transition"
      >
        Continue with Google
      </button>
    </div>
  );
}
