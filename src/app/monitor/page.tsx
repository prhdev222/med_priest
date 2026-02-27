"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStats, getIpdByWard, StatsResponse, IpdByWardRow } from "@/lib/api";
import Link from "next/link";

function todayIso() { return new Date().toISOString().slice(0, 10); }
function startOfMonthIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }

export default function MonitorIndex() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [ipdRows, setIpdRows] = useState<IpdByWardRow[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const from = startOfMonthIso();
    const to = todayIso();
    Promise.all([
      getStats(from, to, "day"),
      getIpdByWard(from, to, "day"),
    ]).then(([s, ipd]) => {
      setStats(s);
      setIpdRows(Array.isArray(ipd?.rows) ? ipd.rows : []);
    }).catch(() => {});
  }, []);

  const rows = useMemo(() => Array.isArray(stats?.rows) ? stats!.rows : [], [stats]);
  const todayOPD = rows.find((r) => r.key === todayIso())?.opd ?? 0;
  const todayER = rows.find((r) => r.key === todayIso())?.er ?? 0;

  const wards = useMemo(() => {
    const wSet = new Set<string>();
    for (const r of ipdRows) if (r.ward) wSet.add(r.ward);
    const statsWards = stats?.wardStats ?? [];
    for (const w of statsWards) if (w.ward) wSet.add(w.ward);
    return Array.from(wSet).sort();
  }, [ipdRows, stats]);

  const wardSummary = useMemo(() => {
    const today = todayIso();
    const map = new Map<string, { admit: number; dc: number }>();
    for (const w of wards) map.set(w, { admit: 0, dc: 0 });
    for (const r of ipdRows) {
      if (r.key !== today) continue;
      const cur = map.get(r.ward);
      if (cur) {
        cur.admit += r.admit ?? 0;
        cur.dc += r.discharge ?? 0;
      }
    }
    return map;
  }, [wards, ipdRows]);

  return (
    <div className="monitor-page monitor-select-page">
      <div className="monitor-topbar">
        <div className="monitor-topbar-left">
          <span className="monitor-logo">📺</span>
          <h1 className="monitor-title">เลือก Monitor Dashboard</h1>
        </div>
        <div className="monitor-topbar-right">
          <a href="/" className="monitor-back-link" style={{ color: "#94a3b8" }}>← กลับหน้าหลัก</a>
        </div>
      </div>

      <p className="monitor-select-desc">
        เลือก Dashboard ที่ต้องการแสดงบนจอ Monitor / TV — เปิดแบบเต็มจอ, Dark Theme, Auto-Refresh
      </p>

      <div className="monitor-select-grid">
        {/* OPD */}
        <Link href="/monitor/opd" className="monitor-select-card" style={{ "--sel-color": "#3b82f6" } as React.CSSProperties}>
          <div className="monitor-select-icon">🏥</div>
          <div className="monitor-select-name">OPD ผู้ป่วยนอก</div>
          <div className="monitor-select-stat">วันนี้: <strong>{todayOPD}</strong> ราย</div>
        </Link>

        {/* ER */}
        <Link href="/monitor/ward/ER" className="monitor-select-card" style={{ "--sel-color": "#f97316" } as React.CSSProperties}>
          <div className="monitor-select-icon">🚑</div>
          <div className="monitor-select-name">ER ฉุกเฉิน</div>
          <div className="monitor-select-stat">วันนี้: <strong>{todayER}</strong> ราย</div>
        </Link>

        {/* Ward Cards */}
        {wards.filter((w) => w !== "ER").map((w) => {
          const s = wardSummary.get(w);
          return (
            <Link key={w} href={`/monitor/ward/${encodeURIComponent(w)}`} className="monitor-select-card" style={{ "--sel-color": "#8b5cf6" } as React.CSSProperties}>
              <div className="monitor-select-icon">🛏️</div>
              <div className="monitor-select-name">{w}</div>
              <div className="monitor-select-stat">
                วันนี้: Admit <strong>{s?.admit ?? 0}</strong> | D/C <strong>{s?.dc ?? 0}</strong>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="monitor-footer" style={{ marginTop: 40 }}>
        <span>กดเลือก Dashboard แล้วกดปุ่ม ⛶ เพื่อเข้าสู่โหมดเต็มจอ</span>
      </div>
    </div>
  );
}
