import { useCallback, useState } from "react";

/**
 * Razorpay checkout helper.
 *
 * Loads the Razorpay checkout script on demand and opens the payment modal for
 * a real gateway. In dev mode (no RAZORPAY_KEY_ID configured) the backend issues
 * "order_dev_*" ids and the caller renders its own "Simulate payment" button —
 * this hook exposes the loading state and a helper to confirm with a dev
 * payment id.
 */

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface OpenOptions {
  keyId: string;
  amountPaise: number;
  orderId: string;
  name?: string;
  description?: string;
  email?: string;
  onSuccess: (res: RazorpayResponse) => void;
  onError?: (err: unknown) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout script."));
    document.body.appendChild(script);
  });
}

export function useRazorpay() {
  const [loading, setLoading] = useState(false);

  const openCheckout = useCallback(async (opts: OpenOptions) => {
    setLoading(true);
    try {
      await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable.");
      const rzp = new window.Razorpay({
        key: opts.keyId,
        amount: opts.amountPaise,
        currency: "INR",
        name: opts.name || "InternArea",
        description: opts.description || "",
        order_id: opts.orderId,
        handler: (res: RazorpayResponse) => opts.onSuccess(res),
        prefill: { email: opts.email || "" },
        theme: { color: "#1d4ed8" },
      });
      rzp.open();
    } catch (err) {
      opts.onError?.(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, openCheckout };
}
