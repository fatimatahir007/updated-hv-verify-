import axios from "axios";

// In development, Vite proxies /api/* → http://localhost:8000/*
// This means requests stay same-origin (localhost:5173) → no CORS needed.
// In production builds, requests go directly to the backend host.
const isDev = import.meta.env.DEV;
const BASE_URL = isDev
  ? "/api"                                          // proxied by vite.config.js
  : `http://${window.location.hostname}:8000`;     // direct in production

const API = axios.create({
  baseURL: BASE_URL,
});

// ── Auto-attach admin JWT to every request ──────────────────────
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token && !config.headers["Authorization"]) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 Unauthorized globally
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.response?.data?.detail === "Invalid token") {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin-login";
    }
    return Promise.reject(error);
  }
);

export default API;