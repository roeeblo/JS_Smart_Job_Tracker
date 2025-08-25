import axios from "axios";
import { useAuth } from "./store/auth";

const api = axios.create({
  baseURL: "http://localhost:4000",
});

// attach access token to each request
api.interceptors.request.use((config) => {
  const { accessToken } = useAuth.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// refresh token handling
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error?.response?.status;

    if (status === 401 && !original._retry) {
      original._retry = true;

      const { refreshToken, setAccessTokenOnly, logout } = useAuth.getState();
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }

      try {
        if (!refreshing) {
          refreshing = axios.post("http://localhost:4000/refresh", { refreshToken });
        }
        const { data } = await refreshing;
        refreshing = null;

        // new access token
        setAccessTokenOnly(data.accessToken);

        // verify again
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        useAuth.getState().logout();
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
