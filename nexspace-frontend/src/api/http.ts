import axios from "axios";

export const http = axios.create({
  baseURL: "/",           // Vite proxy handles routing to backend
  withCredentials: true,  // send session cookies
  timeout: 10000
});

http.interceptors.response.use(
  r => r,
  err => {
    const status = err?.response?.status ?? 0;
    const data = err?.response?.data;
    const message = (data && (data.message || data.error || data.title)) || err.message || `HTTP ${status}`;
    return Promise.reject(new Error(message));
  }
);
