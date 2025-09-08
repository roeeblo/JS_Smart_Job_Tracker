// client/src/api.js
import axios from "axios";
import { useAuth } from "./store/auth";

// בזמן dev דבר ישירות עם השרת, ובprod השתמש בנתיב יחסי /api
const baseURL =
  import.meta.env.DEV
    ? "http://localhost:4000"
    : (import.meta.env.VITE_API_URL || "/api");

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const { accessToken } = useAuth.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error?.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setAccessTokenOnly, logout } = useAuth.getState();
      if (!refreshToken) {
        logout();
        throw error;
      }
      try {
        if (!refreshing) {
          refreshing = api.post("/refresh", { refreshToken });
        }
        const { data } = await refreshing;
        refreshing = null;
        setAccessTokenOnly(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        logout();
        throw e;
      }
    }
    throw error;
  }
);

export default api;
