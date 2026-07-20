import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "@/i18n/config";
import { useSelector } from "react-redux";
import { selectuser } from "@/Feature/Userslice";
import { LANGUAGES, VERIFICATION_LANGUAGE } from "@/constants/languages";
import {
  requestFrenchOtp,
  syncLanguage,
  updateLanguage,
  verifyFrenchOtp,
} from "@/services/languageService";

/**
 * Central language orchestration hook (single source of truth on the client).
 *
 * Responsibilities:
 *  - Instantly switch to any non-verified language (no reload).
 *  - Gate French behind email-OTP verification (or require login for guests).
 *  - Persist every choice to LocalStorage (survives refresh/logout/sessions).
 *  - On login, let the DB value OVERRIDE LocalStorage (per spec).
 *  - Keep <html lang> in sync for accessibility / SEO.
 *
 * The OTP modal is rendered by the caller (LanguageSelector / app shell); this
 * hook owns its open/loading/error state and the request/verify/retry logic.
 */

const OTP_TTL_SECONDS = 300; // 5 minutes, mirrors backend (code validity)
const RESEND_LOCK_SECONDS = 30; // client-side cooldown between resends

export interface OtpModalState {
  isOpen: boolean;
  email: string;
  loading: boolean; // request or verify in flight
  verifying: boolean;
  error: string | null;
  attemptsRemaining: number | null;
  countdown: number; // seconds left before the OTP code expires
  resendCountdown: number; // seconds left before resend is allowed
  resendDisabled: boolean;
  devMode: boolean;
}

const initialOtpState: OtpModalState = {
  isOpen: false,
  email: "",
  loading: false,
  verifying: false,
  error: null,
  attemptsRemaining: null,
  countdown: OTP_TTL_SECONDS,
  resendCountdown: 0,
  resendDisabled: true,
  devMode: false,
};

export function useLanguageSwitcher() {
  const user = useSelector(selectuser);
  const [switching, setSwitching] = useState(false);
  const [otp, setOtp] = useState<OtpModalState>(initialOtpState);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendLockRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- helpers ----------------------------------------------------------
  const setHtmlLang = useCallback((code: string) => {
    if (typeof document !== "undefined") {
      const meta = LANGUAGES.find((l) => l.code === code);
      document.documentElement.lang = meta?.locale || code;
    }
  }, []);

  const applyLanguage = useCallback(
    (code: string) => {
      i18n.changeLanguage(code);
      try {
        localStorage.setItem("i18nextLng", code);
      } catch {
        /* storage may be unavailable (private mode) — non-fatal */
      }
      setHtmlLang(code);
    },
    [setHtmlLang]
  );

  const clearTimers = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (resendLockRef.current) {
      clearTimeout(resendLockRef.current);
      resendLockRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (seconds: number, onExpire?: () => void) => {
      clearTimers();
      setOtp((s) => ({ ...s, countdown: seconds }));
      countdownRef.current = setInterval(() => {
        setOtp((s) => {
          const next = s.countdown - 1;
          if (next <= 0) {
            clearInterval(countdownRef.current as ReturnType<typeof setInterval>);
            countdownRef.current = null;
            onExpire?.();
            return { ...s, countdown: 0 };
          }
          return { ...s, countdown: next };
        });
      }, 1000);
    },
    [clearTimers]
  );

  const startResendLock = useCallback((seconds: number) => {
    if (resendLockRef.current) clearTimeout(resendLockRef.current);
    setOtp((s) => ({ ...s, resendDisabled: true, resendCountdown: seconds }));
    resendLockRef.current = setInterval(() => {
      setOtp((s) => {
        const next = s.resendCountdown - 1;
        if (next <= 0) {
          clearTimeout(resendLockRef.current as ReturnType<typeof setTimeout>);
          resendLockRef.current = null;
          return { ...s, resendCountdown: 0, resendDisabled: false };
        }
        return { ...s, resendCountdown: next };
      });
    }, 1000);
  }, []);

  // ---- OTP request ------------------------------------------------------
  const requestOtp = useCallback(async () => {
    setOtp((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await requestFrenchOtp();
      setOtp((s) => ({
        ...s,
        loading: false,
        email: user?.email || s.email,
        devMode: !!res.devMode,
        error: null,
        attemptsRemaining: null,
      }));
      startCountdown(OTP_TTL_SECONDS); // code expiry countdown
      startResendLock(RESEND_LOCK_SECONDS); // resend cooldown
      return true;
    } catch (err: any) {
      const status = err?.response?.status;
      let errorKey = "otp.errorGeneric";
      if (err?.isNetworkError) errorKey = "otp.errorNetwork";
      else if (status === 502) errorKey = "otp.errorEmail";
      else if (status === 429) errorKey = "otp.errorLimit";
      else if (status === 400) errorKey = "otp.errorEmail";
      setOtp((s) => ({ ...s, loading: false, error: errorKey }));
      return false;
    }
  }, [startCountdown, startResendLock, user?.email]);

  // ---- OTP verify -------------------------------------------------------
  const verifyOtp = useCallback(
    async (code: string) => {
      setOtp((s) => ({ ...s, verifying: true, error: null }));
      try {
        const res = await verifyFrenchOtp(code);
        clearTimers();
        applyLanguage(VERIFICATION_LANGUAGE);
        setOtp((s) => ({ ...s, verifying: false, isOpen: false }));
        return true;
      } catch (err: any) {
        const status = err?.response?.status;
        const body = err?.response?.data || {};
        let errorKey = "otp.errorGeneric";
        if (err?.isNetworkError) errorKey = "otp.errorNetwork";
        else if (status === 400 && body.expired) errorKey = "otp.errorExpired";
        else if (status === 400) errorKey = "otp.errorInvalid";
        else if (status === 429) errorKey = "otp.errorLocked";
        setOtp((s) => ({
          ...s,
          verifying: false,
          error: errorKey,
          attemptsRemaining: body.attemptsRemaining ?? null,
        }));
        return false;
      }
    },
    [applyLanguage, clearTimers]
  );

  const resendOtp = useCallback(async () => {
    if (otp.resendDisabled) return;
    await requestOtp();
  }, [otp.resendDisabled, requestOtp]);

  const closeOtpModal = useCallback(() => {
    clearTimers();
    setOtp(initialOtpState);
  }, [clearTimers]);

  // ---- main entry point -------------------------------------------------
  const changeLanguage = useCallback(
    async (code: string) => {
      const lang = LANGUAGES.find((l) => l.code === code);
      if (!lang) return;

      // Already active — no-op.
      if (i18n.language === code) return;

      // Non-verified language: switch instantly + persist.
      if (!lang.verificationRequired) {
        setSwitching(true);
        try {
          applyLanguage(code);
          if (user?.uid) {
            try {
              await updateLanguage(code);
            } catch (err) {
              // Backend save failed (e.g. credentials/network). The LocalStorage
              // preference still holds so the UX is correct; log for observability.
              console.warn("[language] could not persist to DB:", (err as Error)?.message);
            }
          }
        } finally {
          setSwitching(false);
        }
        return;
      }

      // French: gate.
      if (!user?.uid) {
        // Guest — no registered email. Prompt to sign in.
        // (Caller may also surface the requiresLogin message.)
        return;
      }

      // Open the OTP modal and immediately request a code.
      setOtp((s) => ({
        ...s,
        isOpen: true,
        email: user.email || "",
        error: null,
        attemptsRemaining: null,
      }));
      await requestOtp();
    },
    [applyLanguage, requestOtp, user?.uid, user?.email]
  );

  // ---- on login: DB overrides LocalStorage ------------------------------
  const syncFromDb = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const res = await syncLanguage(); // POST /user/sync
      if (res?.preferredLanguage) {
        applyLanguage(res.preferredLanguage);
      }
    } catch (err) {
      console.warn("[language] DB sync failed (using local value):", (err as Error)?.message);
    }
  }, [applyLanguage, user?.uid]);

  // Sync from DB whenever a user logs in (either via the auth listener or the
  // explicit login event fired by the Navbar right after Google sign-in).
  useEffect(() => {
    if (user?.uid) {
      syncFromDb();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    const onLogin = () => {
      if (user?.uid) syncFromDb();
    };
    window.addEventListener("user-logged-in", onLogin);
    return () => window.removeEventListener("user-logged-in", onLogin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, syncFromDb]);

  // Initialize <html lang> on first mount.
  useEffect(() => {
    setHtmlLang(i18n.language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup timers on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  return {
    currentLanguage: i18n.language,
    switching,
    changeLanguage,
    // OTP modal surface
    otp,
    requestOtp,
    verifyOtp,
    resendOtp,
    closeOtpModal,
    // external triggers
    syncFromDb,
  };
}

export default useLanguageSwitcher;
