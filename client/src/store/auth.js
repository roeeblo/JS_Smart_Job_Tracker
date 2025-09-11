import { create } from "zustand";

const LS_KEY = "sjt-auth";

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { user: null, accessToken: "", refreshToken: "" };
}

export const useAuth = create((set, get) => ({
  ...load(),
  setAuth: (user, accessToken, refreshToken) => {
    const next = { user, accessToken, refreshToken };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    set(next);
  },
  setAccessTokenOnly: (accessToken) => {
    const cur = get();
    const next = { ...cur, accessToken };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    set(next);
  },
  logout: () => {
    localStorage.removeItem(LS_KEY);
    set({ user: null, accessToken: "", refreshToken: "" });
  },
}));
