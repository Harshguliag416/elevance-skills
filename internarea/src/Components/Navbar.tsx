import React from "react";
import Link from "next/link";
import { auth } from "../firebase/firebase";
import { Search } from "lucide-react";
import { signOut } from "firebase/auth";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { selectuser } from "@/Feature/Userslice";
import LanguageSelector from "./LanguageSelector";
import NavDropdown from "./NavDropdown";
interface User {
  name: string;
  email: string;
  photo: string;
}
const Navbar = () => {
  const user = useSelector(selectuser);
  const { t } = useTranslation();
  const handlelogout = () => {
    signOut(auth);
  };

  // Job/internship fields shown in the navbar dropdowns. `value` stays the
  // English DB category so filtering keeps working regardless of UI language.
  const fields = [
    { value: "Big Brands", key: "bigBrands" },
    { value: "Work From Home", key: "workFromHome" },
    { value: "Part-time", key: "partTime" },
    { value: "MBA", key: "mba" },
    { value: "Engineering", key: "engineering" },
    { value: "Media", key: "media" },
    { value: "Design", key: "design" },
    { value: "Data Science", key: "dataScience" },
  ].map((f) => ({ value: f.value, label: t(`home.category.${f.key}`) }));
  return (
    <div className="relative">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex-shrink-0">
              <a href="/" className="text-xl font-bold text-blue-600">
                <img src={"/logo.png"} alt="InternArea" className="h-16" />
              </a>
            </div>
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-8">
              <NavDropdown label={t("nav.internships")} items={fields} baseHref="/internship" />
              <NavDropdown label={t("nav.jobs")} items={fields} baseHref="/job" />
              <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
                <Link href={"/internarea/certifications"}>
                  <span>Certifications</span>
                </Link>
              </button>
              {user && (
                <>
                  <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
                    <Link href={"/public-space"}>
                      <span>{t("nav.publicSpace")}</span>
                    </Link>
                  </button>
                  <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
                    <Link href={"/resume"}>
                      <span>{t("nav.resume")}</span>
                    </Link>
                  </button>
                  <button className="flex items-center space-x-1 text-gray-700 hover:text-blue-600">
                    <Link href={"/subscription"}>
                      <span>{t("nav.subscription")}</span>
                    </Link>
                  </button>
                </>
              )}
              <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  placeholder={t("common.searchPlaceholder")}
                  aria-label={t("common.search")}
                  className="ml-2 bg-transparent focus:outline-none text-sm w-48"
                />
              </div>
              <LanguageSelector />
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-4">
              <LanguageSelector className="md:hidden" />
              {user ? (
                <div className="relative flex">
                  <button className="flex items-center space-x-2">
                    {" "}
                    <Link href={"/profile"}>
                      <img
                        src={user.photo}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    </Link>
                  </button>
                  <button
                    className="flex items-center w-full px-4 py-2  text-gray-700  hover:bg-gray-200 rounded-lg"
                    onClick={handlelogout}
                  >
                    {t("nav.logout")}
                  </button>
                </div>
              ) : (
                <>
                  <button className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 flex items-center justify-center space-x-2 hover:bg-gray-50 ">
                    <Link href={"/login"}>
                      <span className="text-gray-700">{t("nav.login")}</span>
                    </Link>
                  </button>
                  <a
                    href="/adminlogin"
                    className="text-gray-600 hover:text-gray-800"
                  >
                    {t("nav.admin")}
                  </a>
                </>
              )}
            </div>
          </div>{" "}
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
