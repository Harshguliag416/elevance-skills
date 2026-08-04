import apiClient from "@/lib/apiClient";

/**
 * Reusable service for all language / OTP API calls.
 * Keeps endpoints, request/response shapes, and error mapping in one place so
 * UI components never touch axios or raw status codes directly.
 */

export interface LanguageApiResult {
  preferredLanguage: string;
}

export interface OtpRequestResult {
  success: boolean;
  message?: string;
  expiresInSeconds?: number;
  devMode?: boolean;
}

export interface OtpVerifyResult {
  success: boolean;
  preferredLanguage?: string;
  message?: string;
  attemptsRemaining?: number;
  retryAfterSeconds?: number;
}

/** Persist/refresh the profile on login; returns the DB-stored language. */
export async function syncLanguage(): Promise<LanguageApiResult> {
  const { data } = await apiClient.post<LanguageApiResult>("/user/sync");
  return data;
}

export async function getLanguage(): Promise<LanguageApiResult> {
  const { data } = await apiClient.get<LanguageApiResult>("/user/language");
  return data;
}

/** Save a non-verified language preference. */
export async function updateLanguage(language: string): Promise<LanguageApiResult> {
  const { data } = await apiClient.put<LanguageApiResult>("/user/language", {
    language,
  });
  return data;
}

/** Request the email OTP that gates French. */
export async function requestFrenchOtp(): Promise<OtpRequestResult> {
  const { data } = await apiClient.post<OtpRequestResult>(
    "/user/language/french/request-otp"
  );
  return data;
}

/** Verify the OTP and commit French on success. */
export async function verifyFrenchOtp(otp: string): Promise<OtpVerifyResult> {
  const { data } = await apiClient.post<OtpVerifyResult>(
    "/user/language/french/verify-otp",
    { otp }
  );
  return data;
}
