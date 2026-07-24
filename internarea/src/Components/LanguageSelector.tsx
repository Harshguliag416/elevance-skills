import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Globe } from "lucide-react";
import { LANGUAGES } from "@/constants/languages";
import { useLanguageSwitcher } from "@/hooks/useLanguageSwitcher";
import FrenchOtpModal from "./FrenchOtpModal";

/**
 * Accessible language picker.
 *
 * - Shows the current language (endonym) + a globe icon.
 * - Dropdown lists all supported languages with native + English names.
 * - French is flagged with a small "OTP" hint (email verification required).
 * - Keyboard: Enter/Space toggles, Escape closes, focus returns to trigger,
 *   ARIA listbox roles + labels for screen readers.
 * - Dark-mode compatible (Tailwind neutral palette + focus ring).
 * - Non-verified languages switch instantly; French opens the OTP modal via
 *   the shared switcher hook. Guests selecting French are guided to sign in.
 */
const LanguageSelector: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { t, i18n } = useTranslation();
  const { changeLanguage, switching, otp, closeOtpModal, verifyOtp, resendOtp } =
    useLanguageSwitcher();
  const [open, setOpen] = useState(false);
  const [guestFrenchPrompt, setGuestFrenchPrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const current = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSelect = async (code: string) => {
    setOpen(false);
    buttonRef.current?.focus();

    const result = await changeLanguage(code);
    // Guests selecting French have no registered email to verify against, so
    // guide them to sign in. Signed-in users get the OTP modal instead.
    if (result === "guest") {
      setGuestFrenchPrompt(true);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language.label")}
        className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg px-2 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Globe className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline text-sm font-medium">{current.nativeName}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t("language.selectLanguage")}
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 py-1.5 max-h-80 overflow-auto"
        >
          {LANGUAGES.map((lang) => {
            const active = lang.code === current.code;
            return (
              <li key={lang.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="flex flex-col leading-tight">
                    <span className="font-medium">{lang.nativeName}</span>
                    <span className="text-xs text-gray-400">{lang.englishName}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {lang.verificationRequired && (
                      <span
                        className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        title={t("language.verificationRequired")}
                      >
                        OTP
                      </span>
                    )}
                    {active && <Check className="h-4 w-4 text-blue-600" aria-hidden="true" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {switching && (
        <span className="sr-only" role="status" aria-live="polite">
          {t("language.loading")}
        </span>
      )}

      {/* Guest choosing French: prompt to sign in */}
      {guestFrenchPrompt && (
        <div
          role="alertdialog"
          aria-label={t("language.verificationRequired")}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setGuestFrenchPrompt(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t("language.verificationRequired")}
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t("language.requiresLogin")}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setGuestFrenchPrompt(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP modal for French verification */}
      {otp.isOpen && (
        <FrenchOtpModal
          state={otp}
          onClose={closeOtpModal}
          onVerify={verifyOtp}
          onResend={resendOtp}
        />
      )}
    </div>
  );
};

export default LanguageSelector;
