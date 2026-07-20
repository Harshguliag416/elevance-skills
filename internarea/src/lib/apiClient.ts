import axios from "axios";
import { auth } from "@/firebase/firebase";

/**
 * Centralized API client.
 *
 * Base URL: prefers NEXT_PUBLIC_API_URL, then falls back to the existing
 * production deployment so the app keeps working without configuration.
 *
 * Request interceptor: attaches the current Firebase ID token as a Bearer
 * header so the backend can verify identity (see backend/middleware/auth.js).
 * The token is fetched lazily and never cached long-term — Firebase rotates it.
 *
 * Response interceptor: normalizes network errors so callers can show a
 * friendly message instead of crashing.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://internshala-clone-y2p2.onrender.com";

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken(/* forceRefresh */ false);
      if (token) {
        config.headers = config.headers || {};
        (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
      }
    }
  } catch (err) {
    // A missing/expired token simply means the request goes unauthenticated;
    // the backend returns 401 for protected routes, which callers handle.
    console.warn("[apiClient] could not attach auth token:", (err as Error)?.message);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = error;
    if (!error.response) {
      normalized.isNetworkError = true;
    }
    return Promise.reject(normalized);
  }
);

export default apiClient;
