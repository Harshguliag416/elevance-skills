/**
 * Frontend mirror of the backend supported-language list (backend/config/languages.js).
 * Kept in sync manually. The `code` values MUST match the backend enum and the
 * locale file names under src/i18n/locales/<code>/common.json.
 */
export interface LanguageOption {
  code: string;
  /** Endonym — the language's name in its own script, for the selector. */
  nativeName: string;
  /** English name, used as the accessible label. */
  englishName: string;
  /** BCP-47 locale for <html lang> + formatting. */
  locale: string;
  /** Requires email-OTP verification before it can be activated. */
  verificationRequired: boolean;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", nativeName: "English", englishName: "English", locale: "en", verificationRequired: false },
  { code: "es", nativeName: "Español", englishName: "Spanish", locale: "es", verificationRequired: false },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", locale: "hi", verificationRequired: false },
  { code: "pt", nativeName: "Português", englishName: "Portuguese", locale: "pt", verificationRequired: false },
  { code: "zh", nativeName: "中文", englishName: "Chinese", locale: "zh", verificationRequired: false },
  { code: "fr", nativeName: "Français", englishName: "French", locale: "fr", verificationRequired: true },
];

export const DEFAULT_LANGUAGE = "en";

export const getLanguage = (code: string) =>
  LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];

export const VERIFICATION_LANGUAGE = "fr";
