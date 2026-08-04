import apiClient from "@/lib/apiClient";

/**
 * Resume builder API (Task 2).
 * Flow: request OTP → verify OTP → create Razorpay order → pay (or simulate) →
 * verify payment → server generates the professional resume.
 */

export interface OtpRequestResult {
  success: boolean;
  message?: string;
  expiresInSeconds?: number;
  devMode?: boolean;
  devCodeEnabled?: boolean;
  devCode?: string | null;
}

export interface OtpVerifyResult {
  success: boolean;
  message?: string;
  attemptsRemaining?: number;
  retryAfterSeconds?: number;
}

export interface ResumeOrderResult {
  success: boolean;
  orderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string | null;
  devMode: boolean;
}

export interface ResumeFormData {
  name: string;
  email: string;
  phone: string;
  photo: string;
  qualifications: string;
  experience: string;
  personalInfo: string;
  skills: string[];
}

export async function requestResumeOtp() {
  const { data } = await apiClient.post<OtpRequestResult>("/resume/request-otp");
  return data;
}

export async function verifyResumeOtp(otp: string) {
  const { data } = await apiClient.post<OtpVerifyResult>("/resume/verify-otp", { otp });
  return data;
}

export async function createResumeOrder() {
  const { data } = await apiClient.post<ResumeOrderResult>("/resume/create-order");
  return data;
}

export async function verifyResumePayment(payload: {
  orderId: string;
  paymentId?: string;
  signature?: string;
  dev?: boolean;
  resumeData: ResumeFormData;
}) {
  const { data } = await apiClient.post("/resume/verify-payment", payload);
  return data;
}

export interface ResumeDoc {
  _id: string;
  name: string;
  email: string;
  phone: string;
  qualifications: string;
  experience: string;
  personalInfo: string;
  skills: string[];
  photo: string;
  generatedHtml: string;
  createdAt: string;
}

export async function getMyResume() {
  const { data } = await apiClient.get<{ success: boolean; data: ResumeDoc | null }>(
    "/resume/me"
  );
  return data.data;
}
