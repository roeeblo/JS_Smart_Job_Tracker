import { create } from "zustand";

const KEY = "sjt-auth";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { user: null, accessToken: null, refreshToken: null };
    return JSON.parse(raw);
  } catch {
    return { user: null, accessToken: null, refreshToken: null };
  }
}

export const useAuth = create((set, get) => ({
  ...load(),
  setAuth: (user, accessToken, refreshToken) => {
    const state = { user, accessToken, refreshToken };
    localStorage.setItem(KEY, JSON.stringify(state));
    set(state);
  },
  setAccessTokenOnly: (accessToken) => {
    const { user, refreshToken } = get();
    const state = { user, accessToken, refreshToken };
    localStorage.setItem(KEY, JSON.stringify(state));
    set({ accessToken });
  },
  logout: () => {
    localStorage.removeItem(KEY);
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
