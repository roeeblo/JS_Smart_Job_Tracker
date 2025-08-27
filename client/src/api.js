import axios from "axios";
import { useAuth } from "./store/auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000",
});

api.interceptors.request.use((config) => {
  const { accessToken } = useAuth.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error?.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setAccessTokenOnly, logout } = useAuth.getState();
      if (!refreshToken) { logout(); throw error; }
      try {
        if (!refreshing) refreshing = axios.post(`${api.defaults.baseURL}/refresh`, { refreshToken });
        const { data } = await refreshing; refreshing = null;
        setAccessTokenOnly(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (e) { refreshing = null; logout(); throw e; }
    }
    throw error;
  }
);

export default api;
