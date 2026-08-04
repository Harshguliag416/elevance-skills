import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  Camera,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import { selectuser } from "@/Feature/Userslice";
import {
  createResumeOrder,
  getMyResume,
  requestResumeOtp,
  verifyResumeOtp,
  verifyResumePayment,
  type ResumeDoc,
  type ResumeFormData,
} from "@/services/resumeService";
import { useRazorpay } from "@/hooks/useRazorpay";
import OtpModal from "@/Components/OtpModal";

type Stage = "form" | "payment" | "done";

const RESUME_FEE = 50;

/** Downscale an image file to a compact base64 data-URI (max 400px). */
function fileToResizedDataUrl(file: File, maxSize = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

const ResumePage = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useSelector(selectuser);
  const { openCheckout } = useRazorpay();

  const [stage, setStage] = useState<Stage>("form");
  const [existing, setExisting] = useState<ResumeDoc | null>(null);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [resumeId, setResumeId] = useState("");

  const [form, setForm] = useState<ResumeFormData>({
    name: "",
    email: "",
    phone: "",
    photo: "",
    qualifications: "",
    experience: "",
    personalInfo: "",
    skills: [],
  });
  const [skillsInput, setSkillsInput] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  // OTP + payment state.
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpDevMode, setOtpDevMode] = useState(false);
  const [otpDevCodeEnabled, setOtpDevCodeEnabled] = useState(false);
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpAttempts, setOtpAttempts] = useState<number | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [order, setOrder] = useState<{ orderId: string; keyId: string | null; devMode: boolean; amount: number } | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    getMyResume()
      .then((r) => {
        setExisting(r);
        if (r) {
          setForm({
            name: r.name,
            email: r.email,
            phone: r.phone,
            photo: r.photo,
            qualifications: r.qualifications,
            experience: r.experience,
            personalInfo: r.personalInfo,
            skills: r.skills,
          });
          setSkillsInput(r.skills.join(", "));
        }
      })
      .catch(() => undefined);
  }, [user?.uid]);

  const set = (key: keyof ResumeFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch (err) {
      toast.error(t("resume.invalidPhoto"));
    }
  };

  const handleSkills = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSkillsInput(e.target.value);
    setForm((f) => ({
      ...f,
      skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
    }));
  };

  const validate = () => {
    if (!form.name.trim()) return t("resume.nameRequired");
    if (!form.email.trim()) return t("resume.emailRequired");
    if (!form.qualifications.trim()) return t("resume.qualificationsRequired");
    return null;
  };

  const requestOtp = async () => {
    setOtpError(null);
    setOtpAttempts(null);
    setOtpBusy(true);
    try {
      const res = await requestResumeOtp();
      setOtpDevMode(!!res.devMode);
      setOtpDevCodeEnabled(!!res.devCodeEnabled);
      setOtpDevCode(res.devCode || null);
      setOtpOpen(true);
      return true;
    } catch (err: any) {
      setOtpError(err?.response?.data?.error || t("otp.errorGeneric"));
      return false;
    } finally {
      setOtpBusy(false);
    }
  };

  const verifyOtp = useCallback(async (code: string) => {
    setOtpError(null);
    try {
      await verifyResumeOtp(code);
      setOtpOpen(false);
      await beginPayment();
      return true;
    } catch (err: any) {
      setOtpError(err?.response?.data?.error || t("otp.errorGeneric"));
      setOtpAttempts(err?.response?.data?.attemptsRemaining ?? null);
      return false;
    }
  }, []);

  const beginPayment = async () => {
    const res = await createResumeOrder();
    setOrder({ orderId: res.orderId, keyId: res.keyId, devMode: res.devMode, amount: res.amount });
    setStage("payment");
    if (!res.keyId) return; // dev mode → show simulate button
    await payWithRazorpay(res.orderId, res.keyId, res.amountPaise);
  };

  const payWithRazorpay = async (orderId: string, keyId: string, amountPaise: number) => {
    setPaying(true);
    openCheckout({
      keyId,
      amountPaise,
      orderId,
      name: "InternArea",
      description: "Professional resume (₹50)",
      email: form.email,
      onSuccess: (response) => confirmPayment(orderId, response.razorpay_payment_id, response.razorpay_signature, false),
      onError: () => {
        setPaying(false);
        toast.error(t("resume.paymentError"));
      },
    });
  };

  const simulatePayment = async () => {
    if (!order) return;
    setPaying(true);
    await confirmPayment(order.orderId, `pay_dev_${Date.now()}`, "", true);
  };

  const confirmPayment = async (orderId: string, paymentId: string, signature: string, dev: boolean) => {
    try {
      const res = await verifyResumePayment({
        orderId,
        paymentId,
        signature,
        dev,
        resumeData: form,
      });
      setGeneratedHtml(res.resume.generatedHtml);
      setResumeId(res.resume._id);
      setStage("done");
      toast.success(t("resume.paymentSuccess"));
    } catch (err: any) {
      setPaying(false);
      toast.error(err?.response?.data?.error || t("resume.paymentError"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validate();
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setStage("form");
    await requestOtp();
  };

  const printResume = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(generatedHtml);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const inputCls =
    "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("resume.title")}</h1>
            <p className="text-sm text-gray-500">{t("resume.subtitle")}</p>
          </div>
        </div>

        {existing && stage === "form" && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">{t("resume.hasResume")}</span>
            </div>
            <button
              onClick={printResume}
              disabled={!existing.generatedHtml}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg px-4 py-2"
            >
              <Download className="h-4 w-4" />
              {t("resume.download")}
            </button>
          </div>
        )}

        {stage !== "done" && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{t("resume.formTitle")}</h2>
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full px-3 py-1">
                <Lock className="h-3 w-3" /> ₹{RESUME_FEE}
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Photo */}
              <div className="md:col-span-2 flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 border flex items-center justify-center">
                  {form.photo ? (
                    <img src={form.photo} alt="preview" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <div>
                  <input
                    ref={photoRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhoto}
                    className="hidden"
                    id="resume-photo"
                  />
                  <label
                    htmlFor="resume-photo"
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-4 py-2 cursor-pointer"
                  >
                    <Camera className="h-4 w-4" />
                    {t("resume.uploadPhoto")}
                  </label>
                  <p className="text-xs text-gray-400 mt-1">{t("resume.photoHint")}</p>
                </div>
              </div>

              <div>
                <label className={labelCls}>{t("resume.name")}</label>
                <input value={form.name} onChange={set("name")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("resume.email")}</label>
                <input type="email" value={form.email} onChange={set("email")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("resume.phone")}</label>
                <input value={form.phone} onChange={set("phone")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("resume.skills")}</label>
                <input value={skillsInput} onChange={handleSkills} className={inputCls} placeholder="React, Node.js, MongoDB" />
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>{t("resume.qualifications")}</label>
                <textarea
                  rows={3}
                  value={form.qualifications}
                  onChange={set("qualifications")}
                  className={inputCls}
                  placeholder={t("resume.qualificationsPlaceholder")}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>{t("resume.experience")}</label>
                <textarea
                  rows={3}
                  value={form.experience}
                  onChange={set("experience")}
                  className={inputCls}
                  placeholder={t("resume.experiencePlaceholder")}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>{t("resume.personalInfo")}</label>
                <textarea
                  rows={3}
                  value={form.personalInfo}
                  onChange={set("personalInfo")}
                  className={inputCls}
                  placeholder={t("resume.personalInfoPlaceholder")}
                />
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                type="submit"
                disabled={otpBusy}
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-6 py-3 transition-colors disabled:opacity-60"
              >
                {otpBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {t("resume.generateCta")}
              </button>
              <p className="text-xs text-gray-400 text-center mt-3">{t("resume.premiumNote")}</p>
            </div>
          </form>
        )}

        {/* Payment step */}
        {stage === "payment" && order && (
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t("resume.paymentTitle")}</h2>
            <p className="text-sm text-gray-500 mb-4">
              {t("resume.paymentNote")} <strong>₹{order.amount}</strong>
            </p>
            {order.keyId ? (
              <p className="text-sm text-gray-600">{t("resume.paymentRedirect")}</p>
            ) : (
              <button
                onClick={simulatePayment}
                disabled={paying}
                className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg px-6 py-3 transition-colors disabled:opacity-60"
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t("resume.simulatePayment")}
              </button>
            )}
          </div>
        )}

        {/* Done: show generated resume */}
        {stage === "done" && generatedHtml && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{t("resume.ready")}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={printResume}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2"
                >
                  <Download className="h-4 w-4" />
                  {t("resume.download")}
                </button>
                <button
                  onClick={() => router.push("/profile")}
                  className="text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg px-4 py-2"
                >
                  {t("resume.goToProfile")}
                </button>
              </div>
            </div>
            <iframe title="resume" srcDoc={generatedHtml} className="w-full h-[70vh]" />
          </div>
        )}

        <OtpModal
          open={otpOpen}
          email={form.email || user?.email}
          title={t("resume.otpTitle")}
          subtitle={t("resume.otpSubtitle")}
          submitLabel={t("resume.otpCodeLabel")}
          error={otpError}
          attemptsRemaining={otpAttempts}
          submitting={otpBusy}
          devMode={otpDevMode}
          devCodeEnabled={otpDevCodeEnabled}
          devCode={otpDevCode}
          onClose={() => setOtpOpen(false)}
          onVerify={verifyOtp}
        />
      </div>
    </div>
  );
};

export default ResumePage;
