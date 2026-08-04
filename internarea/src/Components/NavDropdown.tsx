import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

/**
 * Navbar dropdown menu (e.g. Internships / Jobs) that lists category fields.
 * Each item links to the target page with a ?category=... query so the page's
 * filter preselects the chosen field.
 */
interface Props {
  label: string;
  items: { value: string; label: string }[];
  baseHref: string;
  className?: string;
}

const NavDropdown: React.FC<Props> = ({ label, items, baseHref, className = "" }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 focus:outline-none"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 w-56 rounded-xl bg-white shadow-lg ring-1 ring-black/5 py-1.5"
        >
          <Link
            href={baseHref}
            role="menuitem"
            className="block w-full text-left px-4 py-2 text-sm font-medium text-blue-600 hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            {label} — All
          </Link>
          <div className="my-1 h-px bg-gray-100" />
          {items.map((item) => (
            <Link
              key={item.value}
              href={`${baseHref}?category=${encodeURIComponent(item.value)}`}
              role="menuitem"
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-blue-600"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default NavDropdown;
