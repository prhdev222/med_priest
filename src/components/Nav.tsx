"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const displayLinks = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/activities", label: "กิจกรรม", icon: "📋" },
  { href: "/encouragement", label: "ให้กำลังใจ", icon: "💛" },
];

const staffLinks = [
  { href: "/data-entry", label: "กรอกข้อมูล", icon: "📝" },
  { href: "/admin", label: "จัดการข้อมูล", icon: "⚙️" },
];

export default function Nav() {
  const pathname = usePathname();
  const [staffOpen, setStaffOpen] = useState(false);
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

  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <Link href="/" className="top-nav-brand">
          <span className="top-nav-brand-icon">🏥</span>
          <span className="top-nav-brand-text">MED Priest</span>
        </Link>

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
                {staffLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-dropdown-item${pathname === item.href ? " active" : ""}`}
                    onClick={() => setStaffOpen(false)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
