import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en/common.json";
import es from "./locales/es/common.json";
import hi from "./locales/hi/common.json";
import pt from "./locales/pt/common.json";
import zh from "./locales/zh/common.json";
import fr from "./locales/fr/common.json";

/**
 * i18n engine.
 *
 * - The browser detector persists the active language to LocalStorage under
 *   `i18nextLng`, which satisfies every persistence requirement (refresh, logout,
 *   browser session) without any extra wiring. Logged-in users additionally have
 *   the DB value synced on top of this in the language service.
 * - Resources are bundled per language in src/i18n/locales/<code>/common.json.
 *   Adding a language = add a file + a row in src/constants/languages.ts.
 * - Changing language is synchronous and in-memory, so the UI updates instantly
 *   with no page reload.
 */
export const LANGUAGE_STORAGE_KEY = "i18nextLng";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      hi: { translation: hi },
      pt: { translation: pt },
      zh: { translation: zh },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "es", "hi", "pt", "zh", "fr"],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });

export default i18n;
