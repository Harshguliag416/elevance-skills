import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { auth } from "@/firebase/firebase";
import { signOut } from "firebase/auth";
import { selectuser } from "@/Feature/Userslice";
import {
  recordLogin,
  requestChromeOtp,
  verifyChromeOtp,
} from "@/services/authService";
import OtpModal from "@/Components/OtpModal";
import { Loader2, LogOut, ShieldCheck, Timer } from "lucide-react";

type GateState = "idle" | "checking" | "otp" | "blocked" | "granted";

/** Best-effort Chrome detection (Edge/Opera embed Chromium but are not "Chrome"). */
function detectChrome() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Chrome|CriOS/.test(ua) && !/Edg/.test(ua) && !/OPR/.test(ua);
}

function readMethod() {
  try {
    return sessionStorage.getItem("internareaAuthMethod") || "google";
  } catch {
    return "google";
  }
}

/**
 * Login security gate (Task 5).
 *
 * Every login is recorded with browser/OS/device/IP. Access rules:
 *  - Google Chrome users gain access only after email-OTP verification.
 *  - Mobile devices may only log in between 10:00 AM and 1:00 PM IST
 *    (enforced server-side; a 403 here shows the blocked screen).
 */
const SecurityGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const user = useSelector(selectuser);
  const [state, setState] = useState<GateState>("idle");
  const decidedUid = useRef<string | null>(null);

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpDevMode, setOtpDevMode] = useState(false);
  const [otpDevCodeEnabled, setOtpDevCodeEnabled] = useState(false);
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpAttempts, setOtpAttempts] = useState<number | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  const grant = useCallback((uid: string) => {
    decidedUid.current = uid;
    setState("granted");
    try {
      sessionStorage.setItem(`internareaGate_${uid}`, "granted");
    } catch {
      /* non-fatal */
    }
  }, []);

  const runGate = useCallback(async (uid: string, email: string) => {
    // Chrome requires email OTP before access.
    if (detectChrome()) {
      setState("otp");
      setOtpError(null);
      setOtpBusy(true);
      try {
                  const res = await requestChromeOtp();
                  setOtpDevMode(!!res.devMode);
                  setOtpDevCodeEnabled(!!res.devCodeEnabled);
                  setOtpDevCode(res.devCode || null);
                  setOtpOpen(true);
      } catch (err: any) {
        setOtpError(err?.response?.data?.error || t("otp.errorGeneric"));
      } finally {
        setOtpBusy(false);
      }
      return;
    }

    // Record the login (mobile window enforced server-side).
    try {
      await recordLogin(readMethod());
      grant(uid);
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setState("blocked");
        return;
      }
      // Network failure → fail open so the app stays usable, but don't persist.
      decidedUid.current = uid;
      setState("granted");
    }
  }, [grant, t]);

  useEffect(() => {
    if (!user?.uid) {
      decidedUid.current = null;
      setState("idle");
      return;
    }
    if (decidedUid.current === user.uid) return;

    // A fresh login for this uid.
    let cached = "";
    try {
      cached = sessionStorage.getItem(`internareaGate_${user.uid}`) || "";
    } catch {
      /* non-fatal */
    }
    if (cached === "granted") {
      decidedUid.current = user.uid;
      setState("granted");
      return;
    }
    setState("checking");
    runGate(user.uid, user.email || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const verify = useCallback(
    async (code: string) => {
      setOtpError(null);
      try {
        await verifyChromeOtp(code);
        setOtpOpen(false);
        if (user?.uid) grant(user.uid);
        return true;
      } catch (err: any) {
        setOtpError(err?.response?.data?.error || t("otp.errorGeneric"));
        setOtpAttempts(err?.response?.data?.attemptsRemaining ?? null);
        return false;
      }
    },
    [grant, user?.uid, t]
  );

  const resend = useCallback(async () => {
    setOtpError(null);
    try {
      const res = await requestChromeOtp();
      setOtpDevMode(!!res.devMode);
      setOtpDevCodeEnabled(!!res.devCodeEnabled);
      setOtpDevCode(res.devCode || null);
    } catch (err: any) {
      setOtpError(err?.response?.data?.error || t("otp.errorGeneric"));
    }
  }, [t]);

  const handleSignOut = async () => {
    try {
      sessionStorage.removeItem(`internareaGate_${user?.uid}`);
    } catch {
      /* non-fatal */
    }
    await signOut(auth);
  };

  // No user or already granted → render normally.
  if (!user?.uid || state === "granted") {
    return <>{children}</>;
  }

  // Full-screen gate screens.
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        {state === "checking" && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">{t("gate.checking")}</h2>
          </>
        )}

        {state === "blocked" && (
          <>
            <Timer className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("gate.blockedTitle")}</h2>
            <p className="text-sm text-gray-600 mb-6">{t("gate.blockedText")}</p>
            <p className="text-sm bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 mb-6">
              10:00 AM – 1:00 PM IST
            </p>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg px-5 py-2.5"
            >
              <LogOut className="h-4 w-4" /> {t("nav.logout")}
            </button>
          </>
        )}

        {state === "otp" && (
          <>
            <ShieldCheck className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("gate.otpTitle")}</h2>
            <p className="text-sm text-gray-600 mb-6">{t("gate.otpText")}</p>
            {otpError && !otpOpen && (
              <p className="text-sm text-red-600 mb-4">{otpError}</p>
            )}
            {otpDevCode && !otpOpen && (
              <p className="text-sm bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 mb-4">
                Dev mode: use code <strong>{otpDevCode}</strong>
              </p>
            )}
            <button
              onClick={async () => {
                setOtpError(null);
                setOtpBusy(true);
                try {
                  const res = await requestChromeOtp();
                  setOtpDevMode(!!res.devMode);
                  setOtpDevCodeEnabled(!!res.devCodeEnabled);
                  setOtpDevCode(res.devCode || null);
                  setOtpOpen(true);
                } catch (err: any) {
                  setOtpError(err?.response?.data?.error || t("otp.errorGeneric"));
                } finally {
                  setOtpBusy(false);
                }
              }}
              disabled={otpBusy}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-5 py-2.5 disabled:opacity-60"
            >
              {otpBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t("gate.sendCode")}
            </button>
          </>
        )}
      </div>

      <OtpModal
        open={otpOpen}
        email={user?.email}
        title={t("gate.otpTitle")}
        subtitle={t("gate.otpSubtitle")}
        submitLabel={t("gate.otpCodeLabel")}
        error={otpError}
        attemptsRemaining={otpAttempts}
        submitting={otpBusy}
        devMode={otpDevMode}
        devCodeEnabled={otpDevCodeEnabled}
        devCode={otpDevCode}
        onClose={() => setOtpOpen(false)}
        onVerify={verify}
        onResend={resend}
        resendDisabled={otpBusy}
      />
    </div>
  );
};

export default SecurityGate;
