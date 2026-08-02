import apiClient from "@/lib/apiClient";

/**
 * Subscription API (Task 6).
 * Plans: Free (1 app/mo), Bronze ₹100 (3), Silver ₹300 (5), Gold ₹1000 (unlimited).
 * Payments only between 10:00–11:00 AM IST (enforced server-side).
 */

export interface PlanInfo {
  id: string;
  name: string;
  price: number;
  pricePaise: number;
  monthlyLimit: number | string;
  unlimited: boolean;
}

export interface SubscriptionInfo {
  plan: string;
  planName: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  applicationsUsed: number;
  monthlyLimit: number;
  unlimited: boolean;
  remaining: number;
  invoiceNo: string;
  amount: number;
}

export async function getPlans() {
  const { data } = await apiClient.get<{ success: boolean; plans: PlanInfo[] }>(
    "/subscription/plans"
  );
  return data.plans;
}

export async function getMySubscription() {
  const { data } = await apiClient.get<{ success: boolean; data: SubscriptionInfo }>(
    "/subscription/me"
  );
  return data.data;
}

export async function createSubscriptionOrder(plan: string) {
  const { data } = await apiClient.post("/subscription/create-order", { plan });
  return data;
}

export async function verifySubscriptionPayment(payload: {
  plan: string;
  orderId: string;
  paymentId?: string;
  signature?: string;
  dev?: boolean;
}) {
  const { data } = await apiClient.post("/subscription/verify-payment", payload);
  return data;
}
