import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth, provider } from "@/firebase/firebase";
import { login } from "@/Feature/Userslice";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail, User } from "lucide-react";

const LoginPage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, provider);
      sessionStorage.setItem("internareaAuthMethod", "google");
      toast.success(t("nav.loginSuccess"));
      window.dispatchEvent(new Event("user-logged-in"));
      router.push("/");
    } catch (error: any) {
      console.error(error);
      const code = error?.code || "";
      if (code === "auth/unauthorized-domain" || code === "auth/operation-not-supported-in-this-environment") {
        toast.error(
          `This domain isn't authorized for Google login. Add "${window.location.hostname}" in Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (code === "auth/popup-blocked") {
        toast.error(t("login.popupBlocked"));
      } else {
        toast.error(t("login.failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      toast.error(t("login.invalidInput"));
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        sessionStorage.setItem("internareaAuthMethod", "email");
        toast.success(t("nav.loginSuccess"));
      } else {
        if (!name.trim()) {
          toast.error(t("login.nameRequired"));
          setLoading(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // Persist the display name + phone to the Firebase profile.
        await updateProfile(cred.user, { displayName: name.trim() });
        window.dispatchEvent(new Event("user-logged-in"));
        // Save the optional phone to our backend profile for forgot-password lookup.
        try {
          const { default: apiClient } = await import("@/lib/apiClient");
          await apiClient.put("/user/profile", { phone, name: name.trim() });
        } catch (err) {
          console.warn("[login] could not save profile:", (err as Error)?.message);
        }
        toast.success(t("login.signupSuccess"));
      }
      window.dispatchEvent(new Event("user-logged-in"));
      router.push("/");
    } catch (error: any) {
      console.error(error);
      const code = error?.code || "";
      if (code === "auth/email-already-in-use") toast.error(t("login.emailInUse"));
      else if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential")
        toast.error(t("login.invalidCredentials"));
      else toast.error(t("login.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-gray-50 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-6 text-center">
            <h1 className="text-2xl font-bold text-white">
              {mode === "signin" ? t("login.title") : t("login.signupTitle")}
            </h1>
          </div>

          <div className="p-6">
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-6 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setMode("signin")}
                className={`py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === "signin" ? "bg-white shadow text-blue-600" : "text-gray-600"
                }`}
              >
                {t("login.signin")}
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === "signup" ? "bg-white shadow text-blue-600" : "text-gray-600"
                }`}
              >
                {t("login.signup")}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("login.name")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder={t("login.namePlaceholder")}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("login.email")}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("login.password")}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={t("login.togglePassword")}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t("login.phone")} <span className="text-gray-400">({t("login.optional")})</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
              )}

              {mode === "signin" && (
                <div className="flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {t("login.forgotPassword")}
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-3 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signin" ? t("login.signin") : t("login.signup")}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-sm text-gray-400">{t("login.or")}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-60"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-gray-700">{t("login.google")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
