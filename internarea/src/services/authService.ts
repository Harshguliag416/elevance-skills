import apiClient from "@/lib/apiClient";
import { auth } from "@/firebase/firebase";

/**
 * Auth-related API (Tasks 3 & 5).
 * - Forgot password (email or phone, once per day, letters-only password)
 * - Login history capture + retrieval
 * - Chrome login OTP gate
 */

export interface LoginHistoryRow {
  _id: string;
  uid: string;
  email: string;
  method: string;
  browser: string;
  os: string;
  deviceType: string;
  ipAddress: string;
  status: string;
  reason: string;
  createdAt: string;
}

export async function forgotPassword(payload: { email?: string; phone?: string }) {
  const { data } = await apiClient.post("/auth/forgot-password", payload);
  return data;
}

export async function recordLogin(method: string) {
  const { data } = await apiClient.post<{ success: boolean; status: string }>(
    "/auth/login-history",
    { method }
  );
  return data;
}

export async function getLoginHistory() {
  const { data } = await apiClient.get<{ success: boolean; data: LoginHistoryRow[] }>(
    "/auth/login-history"
  );
  return data.data;
}

export async function requestChromeOtp() {
  try {
    const currentUser = auth.currentUser;
    let token = null;
    if (currentUser) {
      token = await currentUser.getIdToken();
    }
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      // In development, we can use the dev Uid header for insecure auth
      if (process.env.NEXT_PUBLIC_API_URL?.includes('localhost')) {
        headers['X-Dev-Uid'] = 'dev-test-uid';
      }
    }
    const { data } = await apiClient.post("/auth/chrome/request-otp", {}, { headers });
    return data;
  } catch (err) {
    console.error("[authService] requestChromeOtp error:", err);
    throw err;
  }
}

export async function verifyChromeOtp(otp: string) {
  try {
    const currentUser = auth.currentUser;
    let token = null;
    if (currentUser) {
      token = await currentUser.getIdToken();
    }
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      // In development, we can use the dev Uid header for insecure auth
      if (process.env.NEXT_PUBLIC_API_URL?.includes('localhost')) {
        headers['X-Dev-Uid'] = 'dev-test-uid';
      }
    }
    const { data } = await apiClient.post("/auth/chrome/verify-otp", { otp }, { headers });
    return data;
  } catch (err) {
    console.error("[authService] verifyChromeOtp error:", err);
    throw err;
  }
}
