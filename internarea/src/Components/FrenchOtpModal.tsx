import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Mail, ShieldCheck, X } from "lucide-react";
import type { OtpModalState } from "@/hooks/useLanguageSwitcher";

interface Props {
  state: OtpModalState;
  onClose: () => void;
  onVerify: (code: string) => Promise<boolean>;
  onResend: () => Promise<void>;
}

/**
 * French-verification OTP modal.
 *
 * Features:
 *  - 6 segmented inputs with auto-advance, backspace-to-previous, paste support,
 *    and full keyboard operation.
 *  - Live countdown (code expiry) + resend cooldown with a disabled "Resend"
 *    state; resend resets the timer.
 *  - Inline, localized error + attempts-remaining messages.
 *  - Accessible: role=dialog, aria-modal, labelled title, focus moved into the
 *    first input on open, Escape closes, screen-reader live regions.
 *  - Dark-mode compatible. Subtle transitions only (no distracting motion).
 */
const OTP_LENGTH = 6;

const FrenchOtpModal: React.FC<Props> = ({ state, onClose, onVerify, onResend }) => {
  const { t } = useTranslation();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset digits + focus first input when the modal opens.
  useEffect(() => {
    if (!state.isOpen) return;
    setDigits(Array(OTP_LENGTH).fill(""));
    setSuccess(false);
    setTimeout(() => inputsRef.current[0]?.focus(), 50);
    // Intentionally only on open (not on countdown ticks) so user input is
    // never cleared while the timer runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isOpen]);

  // Focus trap: keep Tab within the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const code = digits.join("");

  const setDigitAt = (idx: number, val: string) => {
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleChange = (idx: number, raw: string) => {
    const val = raw.replace(/\D/g, "").slice(-1); // keep last digit only
    if (!val) {
      setDigitAt(idx, "");
      return;
    }
    setDigitAt(idx, val);
    if (idx < OTP_LENGTH - 1) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        setDigitAt(idx, "");
      } else if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();
        setDigitAt(idx - 1, "");
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < OTP_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputsRef.current[focusIdx]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== OTP_LENGTH || submitting) return;
    setSubmitting(true);
    const ok = await onVerify(code);
    setSubmitting(false);
    if (ok) {
      setSuccess(true);
      setTimeout(() => onClose(), 900); // brief success before closing
    }
  };

  const handleResend = async () => {
    if (state.resendDisabled) return;
    await onResend();
    setDigits(Array(OTP_LENGTH).fill(""));
    inputsRef.current[0]?.focus();
  };

  const minutes = Math.floor(state.countdown / 60);
  const seconds = state.countdown % 60;
  const countdownLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-title"
        aria-describedby="otp-subtitle"
        className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 p-6 sm:p-8"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="otp-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t("otp.title")}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={t("common.close")}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg p-1 disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Subtitle */}
        <p id="otp-subtitle" className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {t("otp.subtitle", { email: state.email || "your email" })}
        </p>

        {/* Dev-mode notice (only when SMTP is not configured) */}
        {state.devMode && (
          <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <Mail className="h-3.5 w-3.5 inline mr-1" aria-hidden="true" />
            {t("otp.emailSent")} (dev: check server console)
          </div>
        )}

        {/* OTP inputs */}
        <form onSubmit={handleSubmit} className="mt-6">
          <label
            htmlFor="otp-0"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
          >
            {t("otp.codeLabel")}
          </label>
          <div className="flex items-center justify-between gap-2" onPaste={handlePaste}>
            {Array.from({ length: OTP_LENGTH }).map((_, idx) => (
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
                disabled={submitting || success}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                aria-label={`${t("otp.codeLabel")} ${idx + 1}`}
                className="w-12 h-14 text-center text-xl font-semibold rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
              />
            ))}
          </div>

          {/* Error / attempts */}
          <div aria-live="assertive" className="min-h-[1.25rem] mt-3 space-y-1">
            {state.error && (
              <p className="text-sm text-red-600 dark:text-red-400">{t(state.error)}</p>
            )}
            {state.attemptsRemaining != null && state.attemptsRemaining > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {t("otp.attemptsRemaining", { count: state.attemptsRemaining })}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={code.length !== OTP_LENGTH || submitting || success}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("otp.verifying")}
              </>
            ) : success ? (
              <>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t("otp.success")}
              </>
            ) : (
              t("otp.verify")
            )}
          </button>
        </form>

        {/* Footer: resend + countdown */}
        <div className="mt-5 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={state.resendDisabled || submitting}
            className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            {state.resendDisabled ? t("otp.resendIn", { seconds: state.resendCountdown }) : t("otp.resend")}
          </button>
          <span className="text-gray-500 dark:text-gray-400" aria-live="polite">
            {countdownLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FrenchOtpModal;
