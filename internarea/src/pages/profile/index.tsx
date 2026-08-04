import { selectuser } from "@/Feature/Userslice";
import { ExternalLink, FileText, Mail, Monitor, Smartphone, Tablet, User } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { getLoginHistory, LoginHistoryRow } from "@/services/authService";

const index = () => {
  const user = useSelector(selectuser);
  const { t } = useTranslation();
  const [history, setHistory] = useState<LoginHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    let alive = true;
    getLoginHistory()
      .then((rows) => alive && setHistory(rows))
      .catch(() => alive && setHistory([]))
      .finally(() => alive && setHistoryLoading(false));
    return () => {
      alive = false;
    };
  }, [user?.uid]);

  const deviceIcon = (deviceType: string) => {
    if (deviceType === "mobile") return <Smartphone className="h-4 w-4" />;
    if (deviceType === "tablet") return <Tablet className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Profile Header */}
          <div className="relative h-32 bg-gradient-to-r from-blue-500 to-blue-600">
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
              {user?.photo ? (
                <img
                  src={user?.photo}
                  alt={user?.name}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
                  <User className="h-12 w-12 text-gray-400" />
                </div>
              )}
            </div>
          </div>

          {/* Profile Content */}
          <div className="pt-16 pb-8 px-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">{user?.name}</h1>
              <div className="mt-2 flex items-center justify-center text-gray-500">
                <Mail className="h-4 w-4 mr-2" />
                <span>{user?.email}</span>
              </div>
            </div>

            {/* Profile Details */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <span className="text-blue-600 font-semibold text-2xl">
                    0
                  </span>
                  <p className="text-blue-600 text-sm mt-1">
                    {t("profile.activeApplications")}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <span className="text-green-600 font-semibold text-2xl">
                    0
                  </span>
                  <p className="text-green-600 text-sm mt-1">
                    {t("profile.acceptedApplications")}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-center gap-3 pt-4">
                <Link
                  href="/userapplication"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  {t("profile.viewApplications")}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="/resume"
                  className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {t("profile.viewResume")}
                </Link>
              </div>
            </div>

            {/* Login History (Task 5) */}
            <div className="mt-10">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("profile.loginHistory")}
              </h2>
              {historyLoading ? (
                <p className="text-sm text-gray-400">{t("profile.loadingHistory")}</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400">{t("profile.noHistory")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="py-2 pr-3">{t("profile.hDate")}</th>
                        <th className="py-2 pr-3">{t("profile.hMethod")}</th>
                        <th className="py-2 pr-3">{t("profile.hDevice")}</th>
                        <th className="py-2 pr-3">{t("profile.hStatus")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row._id} className="border-b border-gray-100">
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                            {fmt(row.createdAt)}
                          </td>
                          <td className="py-2 pr-3 text-gray-700">{row.method}</td>
                          <td className="py-2 pr-3 text-gray-700">
                            <span className="inline-flex items-center gap-1.5">
                              {deviceIcon(row.deviceType)}
                              {row.browser} · {row.os}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                row.status === "success"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {row.status}
                            </span>
                            {row.reason && (
                              <p className="text-xs text-gray-400 mt-0.5">{row.reason}</p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default index;
