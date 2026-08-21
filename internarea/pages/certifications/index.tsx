import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  Award,
  Calendar,
  Building2,
  Link as LinkIcon,
  IdCard,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import apiClient from "@/lib/apiClient";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Intern {
  _id: string;
  name: string;
  email: string;
}

interface Certification {
  _id: string;
  internId: string;
  certificationName: string;
  issuingOrganization: string;
  issueDate: string;
  expirationDate: string | null;
  credentialId: string;
  credentialUrl: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getStatus(
  cert: Certification
): { label: string; color: string } {
  if (!cert.expirationDate) {
    return { label: "Active", color: "bg-green-100 text-green-800" };
  }
  // Normalize both dates to YYYY-MM-DD for a fair date-only comparison,
  // avoiding timezone offset issues between local midnight and UTC midnight.
  const today = new Date().toISOString().slice(0, 10);
  const exp = cert.expirationDate.slice(0, 10);
  return today <= exp
    ? { label: "Active", color: "bg-green-100 text-green-800" }
    : { label: "Expired", color: "bg-red-100 text-red-800" };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const CertificationsPage: React.FC = () => {
  /* ————— state ————— */
  const [interns, setInterns] = useState<Intern[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loadingInterns, setLoadingInterns] = useState(true);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* form fields */
  const [selectedInternId, setSelectedInternId] = useState("");
  const [certName, setCertName] = useState("");
  const [org, setOrg] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [credentialUrl, setCredentialUrl] = useState("");

  /* validation */
  const [formErrors, setFormErrors] = useState<string[]>([]);

  /* ————— fetch interns ————— */
  const fetchInterns = useCallback(async () => {
    setLoadingInterns(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: Intern[] }>(
        "/interns"
      );
      setInterns(res.data.data || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.errors?.[0] ||
        "Failed to load interns. Please try again.";
      toast.error(msg);
      console.error("[certifications] fetch interns error:", err);
    } finally {
      setLoadingInterns(false);
    }
  }, []);

  /* ————— fetch certifications for selected intern ————— */
  const fetchCertifications = useCallback(async (internId: string) => {
    if (!internId) {
      setCertifications([]);
      return;
    }
    setLoadingCerts(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: Certification[];
      }>(`/certifications/${internId}`);
      setCertifications(res.data.data || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.errors?.[0] ||
        "Failed to load certifications.";
      toast.error(msg);
      console.error("[certifications] fetch certs error:", err);
      setCertifications([]);
    } finally {
      setLoadingCerts(false);
    }
  }, []);

  /* ————— on mount ————— */
  useEffect(() => {
    fetchInterns();
  }, [fetchInterns]);

  /* ————— re-fetch when selected intern changes ————— */
  useEffect(() => {
    fetchCertifications(selectedInternId);
  }, [selectedInternId, fetchCertifications]);

  /* ————— form validation ————— */
  const validateForm = (): boolean => {
    const errors: string[] = [];
    if (!selectedInternId) errors.push("Please select an intern.");
    if (!certName.trim()) errors.push("Certification name is required.");
    if (!org.trim()) errors.push("Issuing organization is required.");
    if (!issueDate) errors.push("Issue date is required.");
    setFormErrors(errors);
    return errors.length === 0;
  };

  /* ————— submit ————— */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        internId: selectedInternId,
        certificationName: certName.trim(),
        issuingOrganization: org.trim(),
        issueDate,
      };
      if (expirationDate) payload.expirationDate = expirationDate;
      if (credentialId.trim()) payload.credentialId = credentialId.trim();
      if (credentialUrl.trim()) payload.credentialUrl = credentialUrl.trim();

      await apiClient.post("/certifications", payload);
      toast.success("Certification added successfully!");

      // Reset form
      setCertName("");
      setOrg("");
      setIssueDate("");
      setExpirationDate("");
      setCredentialId("");
      setCredentialUrl("");
      setFormErrors([]);

      // Refresh list
      fetchCertifications(selectedInternId);
    } catch (err: any) {
      const errors = err?.response?.data?.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        setFormErrors(errors);
      } else {
        toast.error("Failed to add certification.");
      }
      console.error("[certifications] submit error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  /* ————— delete ————— */
  const handleDelete = async (certId: string) => {
    if (!window.confirm("Delete this certification?")) return;

    setDeletingId(certId);
    try {
      await apiClient.delete(`/certifications/${certId}`);
      toast.success("Certification deleted.");
      setCertifications((prev) => prev.filter((c) => c._id !== certId));
    } catch (err: any) {
      const msg =
        err?.response?.data?.errors?.[0] || "Failed to delete certification.";
      toast.error(msg);
      console.error("[certifications] delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  /* ————— render ————— */
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Award className="w-8 h-8 text-blue-600" />
            Professional Certifications
          </h1>
          <p className="mt-2 text-gray-600">
            Manage professional certifications for interns.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* ——— Left Panel: Form ——— */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Add Certification
              </h2>

              {formErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                    <ul className="text-sm text-red-700 list-disc list-inside">
                      {formErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Intern Select */}
                <div>
                  <label htmlFor="intern-select" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Intern <span className="text-red-500">*</span>
                  </label>
                  {loadingInterns ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading interns...
                    </div>
                  ) : (
                    <select
                      id="intern-select"
                      value={selectedInternId}
                      onChange={(e) => setSelectedInternId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                    >
                      <option value="">— Select an intern —</option>
                      {interns.map((intern) => (
                        <option key={intern._id} value={intern._id}>
                          {intern.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Certification Name */}
                <div>
                  <label
                    htmlFor="cert-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Certification Name{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cert-name"
                    value={certName}
                    onChange={(e) => setCertName(e.target.value)}
                    placeholder="e.g. AWS Certified Solutions Architect"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>

                {/* Issuing Organization */}
                <div>
                  <label
                    htmlFor="issuing-org"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Issuing Organization{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="issuing-org"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="e.g. Amazon Web Services"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>

                {/* Issue Date */}
                <div>
                  <label
                    htmlFor="issue-date"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Issue Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="issue-date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>

                {/* Expiration Date */}
                <div>
                  <label
                    htmlFor="expiration-date"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Expiration Date{" "}
                    <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="expiration-date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>

                {/* Credential ID */}
                <div>
                  <label
                    htmlFor="credential-id"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Credential ID{" "}
                    <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="credential-id"
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    placeholder="e.g. AWS-ASA-987654"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>

                {/* Credential URL */}
                <div>
                  <label
                    htmlFor="credential-url"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Credential URL{" "}
                    <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="credential-url"
                    value={credentialUrl}
                    onChange={(e) => setCredentialUrl(e.target.value)}
                    placeholder="https://example.com/verify/..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add Certification
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* ——— Right Panel: Certifications List ——— */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                Certifications
                {selectedInternId && !loadingCerts && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({certifications.length})
                  </span>
                )}
              </h2>

              {!selectedInternId ? (
                <div className="text-center py-12 text-gray-500">
                  <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Select an intern to view their certifications.</p>
                </div>
              ) : loadingCerts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : certifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No certifications found for this intern.</p>
                  <p className="text-sm mt-1">
                    Use the form to add one.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {certifications.map((cert) => {
                    const status = getStatus(cert);
                    return (
                      <div
                        key={cert._id}
                        className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {cert.certificationName}
                              </h3>
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}
                              >
                                {status.label}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1.5 text-sm text-gray-600">
                              <p className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                                {cert.issuingOrganization}
                              </p>
                              <p className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                                <span>
                                  Issued: {formatDate(cert.issueDate)}
                                </span>
                                {cert.expirationDate && (
                                  <span className="ml-3">
                                    Expires: {formatDate(cert.expirationDate)}
                                  </span>
                                )}
                              </p>
                              {cert.credentialId && (
                                <p className="flex items-center gap-2">
                                  <IdCard className="w-4 h-4 text-gray-400 shrink-0" />
                                  {cert.credentialId}
                                </p>
                              )}
                              {cert.credentialUrl && (
                                <p className="flex items-center gap-2">
                                  <LinkIcon className="w-4 h-4 text-gray-400 shrink-0" />
                                  <a
                                    href={cert.credentialUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                                  >
                                    View Credential
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleDelete(cert._id)}
                            disabled={deletingId === cert._id}
                            className="ml-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete certification"
                          >
                            {deletingId === cert._id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificationsPage;