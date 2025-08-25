import { create } from "zustand";

const saved = JSON.parse(localStorage.getItem("auth") || "null");

export const useAuth = create((set) => ({
  user: saved?.user || null,
  accessToken: saved?.accessToken || null,
  refreshToken: saved?.refreshToken || null,

  setAuth: (user, accessToken, refreshToken) => {
    const auth = { user, accessToken, refreshToken };
    localStorage.setItem("auth", JSON.stringify(auth));
    set(auth);
  },

  setAccessTokenOnly: (accessToken) => {
    set((state) => {
      const auth = { ...state, accessToken };
      localStorage.setItem("auth", JSON.stringify({ user: auth.user, accessToken, refreshToken: auth.refreshToken }));
      return { accessToken };
    });
  },

  logout: () => {
    localStorage.removeItem("auth");
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
