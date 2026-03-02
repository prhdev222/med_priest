"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStats, getIpdByWard, StatsResponse, IpdByWardRow } from "@/lib/api";
import { localDateIso as localDateIsoFn, startOfMonthIso as startOfMonthIsoFn } from "@/lib/date";
import Link from "next/link";

const MONITOR_WARDS = ["MED1", "MED2"];

function todayIso() { return localDateIsoFn(); }
function startOfMonthIso() { return startOfMonthIsoFn(); }

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

  const wardSummary = useMemo(() => {
    const today = todayIso();
    const map = new Map<string, { admit: number; dc: number }>();
    for (const w of MONITOR_WARDS) map.set(w, { admit: 0, dc: 0 });
    for (const r of ipdRows) {
      if (r.key !== today || !MONITOR_WARDS.includes(r.ward)) continue;
      const cur = map.get(r.ward);
      if (cur) {
        cur.admit += r.admit ?? 0;
        cur.dc += r.discharge ?? 0;
      }
    }
    return map;
  }, [ipdRows]);

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
        เลือก Dashboard ที่ต้องการแสดงบนจอ Monitor / TV — เปิดแบบเต็มจอ, Dark Theme
      </p>

      <div className="monitor-select-grid">
        <Link href="/monitor/div" className="monitor-select-card" style={{ "--sel-color": "#0d9488" } as React.CSSProperties}>
          <div className="monitor-select-icon">📊</div>
          <div className="monitor-select-name">MED analysis</div>
          <div className="monitor-select-stat">OPD, IPD (MED1/MED2), Admission rate, Delay D/C, Bed Occupancy</div>
        </Link>

        <Link href="/monitor/opd" className="monitor-select-card" style={{ "--sel-color": "#3b82f6" } as React.CSSProperties}>
          <div className="monitor-select-icon">🏥</div>
          <div className="monitor-select-name">OPD ผู้ป่วยนอก</div>
          <div className="monitor-select-stat">วันนี้: <strong>{todayOPD}</strong> ราย</div>
        </Link>

        {MONITOR_WARDS.map((w) => {
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
