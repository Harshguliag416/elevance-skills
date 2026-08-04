import React, { useEffect, useRef, useState } from "react";
import { Loader2, Mail, ShieldCheck, X } from "lucide-react";

/**
 * Generic 6-digit OTP modal used by the resume-payment flow, subscription
 * checkout and the Chrome login gate. Mirrors the FrenchOtpModal UX.
 */
interface Props {
  open: boolean;
  email?: string;
  title: string;
  subtitle: string;
  submitLabel: string;
  error?: string | null;
  attemptsRemaining?: number | null;
  submitting?: boolean;
  devMode?: boolean;
  devCodeEnabled?: boolean;
  devCode?: string | null;
  onClose: () => void;
  onVerify: (code: string) => Promise<boolean>;
  onResend?: () => Promise<void>;
  resendDisabled?: boolean;
}

const OtpModal: React.FC<Props> = ({
  open,
  email,
  title,
  subtitle,
  submitLabel,
  error,
  attemptsRemaining,
  submitting = false,
  devMode = false,
  devCodeEnabled = false,
  devCode = null,
  onClose,
  onVerify,
  onResend,
  resendDisabled = false,
}) => {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    setDigits(Array(6).fill(""));
    setSuccess(false);
    setBusy(false);
    setTimeout(() => inputsRef.current[0]?.focus(), 50);
  }, [open]);

  if (!open) return null;

  const code = digits.join("");

  const handleChange = (idx: number, raw: string) => {
    const val = raw.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    if (val && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        setDigits((prev) => {
          const next = [...prev];
          next[idx] = "";
          return next;
        });
      } else if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();
        setDigits((prev) => {
          const next = [...prev];
          next[idx - 1] = "";
          return next;
        });
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(6).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    const ok = await onVerify(code);
    setBusy(false);
    if (ok) {
      setSuccess(true);
      setTimeout(onClose, 900);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-modal-title"
        className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 p-6 sm:p-8"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 id="otp-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg p-1 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {subtitle} {email ? <strong>{email}</strong> : null}
        </p>

        {(devMode || devCodeEnabled) && (
          <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <Mail className="h-3.5 w-3.5 inline mr-1" />
            {devCode
              ? `Dev mode: use code ${devCode}`
              : devCodeEnabled
                ? "Dev mode: enter the dev code shown to you."
                : "Dev mode: check the server console for the code."}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6">
          <label htmlFor="otp-0" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            {submitLabel}
          </label>
          <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <input
                key={idx}
                id={`otp-${idx}`}
                ref={(el) => {
                  inputsRef.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={idx === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digits[idx]}
                disabled={busy || success}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-12 h-14 text-center text-xl font-semibold rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
            ))}
          </div>

          <div aria-live="assertive" className="min-h-[1.25rem] mt-3 space-y-1">
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {attemptsRemaining != null && attemptsRemaining > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {attemptsRemaining} attempt(s) remaining
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={code.length !== 6 || busy || success}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
              </>
            ) : success ? (
              <>
                <ShieldCheck className="h-4 w-4" /> Verified
              </>
            ) : (
              "Verify"
            )}
          </button>
        </form>

        {onResend && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={onResend}
              disabled={resendDisabled || busy}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {resendDisabled ? "Resend in a moment…" : "Resend code"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OtpModal;
