import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { BadgeCheck, Check, Crown, Loader2, Timer, Zap } from "lucide-react";
import { selectuser } from "@/Feature/Userslice";
import {
  createSubscriptionOrder,
  getMySubscription,
  getPlans,
  verifySubscriptionPayment,
  type PlanInfo,
  type SubscriptionInfo,
} from "@/services/subscriptionService";
import { useRazorpay } from "@/hooks/useRazorpay";

const SubscriptionPage = () => {
  const { t } = useTranslation();
  const user = useSelector(selectuser);
  const { openCheckout } = useRazorpay();

  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [selected, setSelected] = useState<string>("bronze");
  const [paying, setPaying] = useState(false);
  const [order, setOrder] = useState<{ orderId: string; keyId: string | null; devMode: boolean } | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    getPlans().then(setPlans).catch(() => undefined);
    getMySubscription().then(setSub).catch(() => undefined);
  }, [user?.uid]);

  const payWithRazorpay = useCallback(
    (orderId: string, keyId: string, amountPaise: number, plan: string) => {
      setPaying(true);
      openCheckout({
        keyId,
        amountPaise,
        orderId,
        name: "InternArea",
        description: "Subscription plan",
        email: user?.email,
        onSuccess: (response) =>
          confirm(plan, orderId, response.razorpay_payment_id, response.razorpay_signature, false),
        onError: () => {
          setPaying(false);
          toast.error(t("subscription.paymentError"));
        },
      });
    },
    [openCheckout, user?.email]
  );

  const confirm = async (plan: string, orderId: string, paymentId: string, signature: string, dev: boolean) => {
    try {
      const res = await verifySubscriptionPayment({ plan, orderId, paymentId, signature, dev });
      setSub(res.data);
      setOrder(null);
      toast.success(t("subscription.activated"));
    } catch (err: any) {
      setPaying(false);
      toast.error(err?.response?.data?.error || t("subscription.paymentError"));
    }
  };

  const handlePurchase = async (planId: string) => {
    try {
      const res = await createSubscriptionOrder(planId);
      setOrder({ orderId: res.orderId, keyId: res.keyId, devMode: res.devMode });
      if (!res.keyId) {
        // dev mode → simulate
        toast.info(t("subscription.devSimulate"));
        await confirm(planId, res.orderId, `pay_dev_${Date.now()}`, "", true);
        return;
      }
      payWithRazorpay(res.orderId, res.keyId, res.amountPaise, planId);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (status === 403) {
        toast.error(msg || t("subscription.windowBlocked"));
      } else {
        toast.error(msg || t("subscription.paymentError"));
      }
    }
  };

  const planBadge = (id: string) => {
    if (id === "gold") return <Crown className="h-4 w-4 text-yellow-500" />;
    if (id === "silver") return <BadgeCheck className="h-4 w-4 text-gray-500" />;
    return <Zap className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t("subscription.title")}</h1>
          <p className="text-gray-500 mt-2">{t("subscription.subtitle")}</p>
        </div>

        {sub && (
          <div className="max-w-2xl mx-auto mb-8 bg-white rounded-xl shadow p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <BadgeCheck className="h-5 w-5 text-blue-600" />
              <span className="font-medium">{sub.planName}</span>
              <span className="text-gray-400">•</span>
              <span>
                {t("subscription.used")} {sub.applicationsUsed}
                {sub.unlimited ? "" : ` / ${sub.monthlyLimit}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Timer className="h-4 w-4" />
              {t("subscription.windowNote")}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const active = sub?.plan === plan.id;
            const isFree = plan.id === "free";
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl shadow-lg overflow-hidden border-2 transition-colors ${
                  active ? "border-blue-600" : "border-transparent"
                }`}
              >
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {planBadge(plan.id)}
                      {plan.name}
                    </h3>
                    {active && (
                      <span className="text-xs font-semibold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                        {t("subscription.current")}
                      </span>
                    )}
                  </div>
                  <p className="mt-3">
                    <span className="text-3xl font-extrabold text-gray-900">
                      {isFree ? "₹0" : `₹${plan.price}`}
                    </span>
                    <span className="text-sm text-gray-500"> / {t("subscription.month")}</span>
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    {plan.unlimited
                      ? t("subscription.unlimitedApps")
                      : t("subscription.appsPerMonth", { count: plan.monthlyLimit })}
                  </p>
                </div>
                <div className="p-6">
                  <button
                    onClick={() => (isFree ? undefined : handlePurchase(plan.id))}
                    disabled={active || isFree || paying}
                    className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                      active
                        ? "bg-gray-100 text-gray-500"
                        : isFree
                        ? "bg-gray-100 text-gray-400"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {active
                      ? t("subscription.activateMessage")
                      : isFree
                      ? t("subscription.defaultPlan")
                      : t("subscription.buyNow", { price: plan.price })}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-2xl mx-auto flex items-start gap-3">
          <Timer className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>{t("subscription.windowNote")}</strong> {t("subscription.windowText")}
          </div>
        </div>

        {paying && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl px-6 py-4 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-gray-700 text-sm">{t("subscription.processing")}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPage;
