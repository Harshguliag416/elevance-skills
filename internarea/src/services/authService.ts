import apiClient from "@/lib/apiClient";

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
  const { data } = await apiClient.post("/auth/chrome/request-otp");
  return data;
}

export async function verifyChromeOtp(otp: string) {
  const { data } = await apiClient.post("/auth/chrome/verify-otp", { otp });
  return data;
}
