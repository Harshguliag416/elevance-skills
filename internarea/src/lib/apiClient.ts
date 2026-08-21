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
 * In development mode, also sends X-Dev-Uid header for fallback authentication.
 * The token is fetched lazily and never cached long-term — Firebase rotates it.
 *
 * Response interceptor: normalizes network errors so callers can show a
 * friendly message instead of crashing.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

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

    // In development mode, add X-Dev-Uid header for backend auth fallback
    if (process.env.NODE_ENV === "development") {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)["X-Dev-Uid"] = "test-user-uid";
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
    // Attach a flag so callers can detect network errors vs server errors.
    if (!error.response) {
      error.isNetworkError = true;
    }
    // Throw synchronously so Axios chains the error in the existing promise
    // instead of creating a new rejected promise that can detach from the
    // caller's await chain (which would produce an "Unhandled Runtime Error"
    // overlay in Next.js 15 dev mode).
    throw error;
  }
);

export default apiClient;
