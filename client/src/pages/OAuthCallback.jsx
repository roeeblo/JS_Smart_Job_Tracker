import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function OAuthCallback() {
  const { hash } = useLocation();
  const nav = useNavigate();
  const { setAuth } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");
    const name = params.get("name") || "";
    const email = params.get("email") || "";

    if (accessToken && refreshToken) {
      setAuth({ name, email }, accessToken, refreshToken);
      nav("/", { replace: true });
    } else {
      nav("/login", { replace: true });
    }
  }, [hash, nav, setAuth]);

  return <div className="text-center text-slate-300">Completing sign-in…</div>;
}
