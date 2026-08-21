import React, { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { forgotPassword } from "@/services/authService";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, Phone } from "lucide-react";

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = identifier.trim();
    if (!value) {
      setError(t("forgot.enterIdentifier"));
      return;
    }
    setLoading(true);
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const payload = isEmail ? { email: value } : { phone: value };
      const res = await forgotPassword(payload);
      setSuccess(true);
      setError(null);
      setCooldown(!!res.cooldownMs);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (status === 429) {
        setError(msg || t("forgot.oncePerDay"));
        setCooldown(true);
      } else if (status === 404) {
        setError(msg || t("forgot.notFound"));
      } else if (status === 400) {
        setError(msg || t("forgot.invalidIdentifier"));
      } else {
        setError(t("forgot.genericError"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-gray-50 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-6 text-center">
            <h1 className="text-2xl font-bold text-white">{t("forgot.title")}</h1>
            <p className="text-blue-100 text-sm mt-1">{t("forgot.subtitle")}</p>
          </div>

          <div className="p-6">
            {success ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  {t("forgot.successTitle")}
                </h2>
                <p className="text-gray-600 text-sm mb-4">{t("forgot.successMessage")}</p>
                {cooldown && (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {t("forgot.oncePerDay")}
                  </p>
                )}
                <Link href="/login" className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium">
                  {t("forgot.backToLogin")}
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-5">{t("forgot.helper")}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("forgot.emailOrPhone")}
                    </label>
                    <div className="relative">
                      {identifier.includes("@") ? (
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      ) : (
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      )}
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                        placeholder={t("forgot.identifierPlaceholder")}
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    {t("forgot.submit")}
                  </button>
                </form>

                <div className="mt-4 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <strong>{t("forgot.note")}</strong> {t("forgot.noteText")}
                </div>
              </>
            )}

            <div className="mt-6">
              <Link href="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t("forgot.backToLogin")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
