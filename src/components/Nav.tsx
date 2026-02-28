"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const displayLinks = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/monitor", label: "Monitor", icon: "📺" },
  { href: "/activities", label: "กิจกรรม", icon: "📋" },
  { href: "/encouragement", label: "ให้กำลังใจ", icon: "💛" },
];

const staffLinks = [
  { href: "/data-entry", label: "กรอกข้อมูล", icon: "📝" },
  { href: "/admin", label: "จัดการข้อมูล", icon: "⚙️" },
  { href: "https://prhmed-file.vercel.app/", label: "ไฟล์ของหน่วยงาน", icon: "📁", external: true },
  { href: "https://med-queue-prh.vercel.app/", label: "คิวรับ case กลางแพทย์", icon: "📋", external: true },
  { href: "https://med-duty.vercel.app/", label: "ระบบถามเวรเมด", icon: "🩺", external: true },
];

export default function Nav() {
  const pathname = usePathname();
  const [staffOpen, setStaffOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const isStaffPage = staffLinks.some((l) => pathname === l.href);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setStaffOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <nav className={`top-nav${mobileOpen ? " nav-mobile-open" : ""}`}>
      <div className="top-nav-inner">
        <Link href="/" className="top-nav-brand">
          <span className="top-nav-brand-icon">🏥</span>
          <span className="top-nav-brand-text">MED Priest</span>
        </Link>

        <button
          type="button"
          className="nav-hamburger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={mobileOpen}
        >
          <span className="nav-hamburger-line" />
          <span className="nav-hamburger-line" />
          <span className="nav-hamburger-line" />
        </button>

        <div className="top-nav-links">
          {displayLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`top-nav-link${pathname === item.href ? " active" : ""}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <div className="nav-dropdown" ref={dropRef}>
            <button
              className={`top-nav-link nav-dropdown-trigger${isStaffPage ? " active" : ""}`}
              onClick={() => setStaffOpen(!staffOpen)}
            >
              <span className="nav-icon">🔧</span>
              เจ้าหน้าที่
              <span className={`nav-chevron${staffOpen ? " open" : ""}`}>▾</span>
            </button>
            {staffOpen && (
              <div className="nav-dropdown-menu">
                {staffLinks.map((item) =>
                  (item as { external?: boolean }).external ? (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nav-dropdown-item"
                      onClick={() => setStaffOpen(false)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-dropdown-item${pathname === item.href ? " active" : ""}`}
                      onClick={() => setStaffOpen(false)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {item.label}
                    </Link>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="top-nav-mobile-menu">
        {displayLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`top-nav-mobile-link${pathname === item.href ? " active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <div className="top-nav-mobile-divider" />
        {staffLinks.map((item) =>
          (item as { external?: boolean }).external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="top-nav-mobile-link"
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </a>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={`top-nav-mobile-link${pathname === item.href ? " active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
