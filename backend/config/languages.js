/**
 * Single source of truth for the languages supported by the platform.
 *
 * Keeping this in one place means adding a future language is a one-line change
 * that both the User model (enum) and the route validators pick up automatically.
 *
 * `verificationRequired` marks languages that may only be enabled after an
 * additional identity check (email OTP). Currently only French, per product spec.
 */

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", verificationRequired: false },
  { code: "es", name: "Spanish", verificationRequired: false },
  { code: "hi", name: "Hindi", verificationRequired: false },
  { code: "pt", name: "Portuguese", verificationRequired: false },
  { code: "zh", name: "Chinese", verificationRequired: false },
  { code: "fr", name: "French", verificationRequired: true },
];

const DEFAULT_LANGUAGE = "en";

const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

const isSupportedLanguage = (code) => SUPPORTED_LANGUAGE_CODES.includes(code);

const requiresVerification = (code) =>
  SUPPORTED_LANGUAGES.some((l) => l.code === code && l.verificationRequired);

module.exports = {
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  requiresVerification,
};
