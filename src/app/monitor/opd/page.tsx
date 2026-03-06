"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getStats,
  getProcedureStats,
  GroupBy,
  StatsResponse,
  ProcedureStatsResponse,
  PROCEDURE_OPTIONS,
} from "@/lib/api";
import { localDateIso as localDateIsoFn, offsetDateIso } from "@/lib/date";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const AUTO_REFRESH_HOUR = 17;
const AUTO_REFRESH_MIN = 30;
const PIE_COLORS = ["#3b82f6", "#f59e0b", "#14b8a6", "#e11d48", "#8b5cf6", "#f97316", "#22c55e", "#ec4899", "#06b6d4", "#84cc16"];
const DAY_COLORS = ["#dc2626", "#eab308", "#ec4899", "#22c55e", "#f97316", "#3b82f6", "#8b5cf6"];

function todayIso() { return localDateIsoFn(); }

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay();
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function procPieData(byProcedure: ProcedureStatsResponse["byProcedure"]) {
  const total = byProcedure.reduce((s, p) => s + Number(p.count || 0), 0);
  if (total === 0) return [];
  return byProcedure.map((p) => {
    const name = p.procedureKey === "other"
      ? (p.procedureLabel ? `Other: ${p.procedureLabel}` : "Other")
      : (PROCEDURE_OPTIONS.find((o) => o.key === p.procedureKey)?.label ?? p.procedureKey);
    return { name, value: Number(p.count || 0), pct: Math.round((Number(p.count || 0) / total) * 100) };
  });
}

export default function MonitorOPD() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [procStats, setProcStats] = useState<ProcedureStatsResponse>({ rows: [], byProcedure: [] });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(new Date());
  const mountRef = useRef(true);
  const eveningDoneRef = useRef("");

  // ดึงข้อมูลย้อนหลังอย่างน้อย 30 วัน เพื่อให้กราฟ OPD 14 วันล่าสุดข้ามเดือนก่อนหน้าได้
  const todayKey = todayIso();
  const from = offsetDateIso(-30);
  const to = todayKey;
  const from7 = offsetDateIso(-6);
  const group: GroupBy = "day";

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [s, p] = await Promise.all([
        getStats(from, to, group),
        getProcedureStats(from, to, group, "OPD"),
      ]);
      if (!mountRef.current) return;
      setStats(s);
      setProcStats({ rows: p?.rows ?? [], byProcedure: p?.byProcedure ?? [] });
      setLastUpdate(new Date());
    } catch { /* silent */ }
    finally { if (mountRef.current) setRefreshing(false); }
  }, [from, to]);

  useEffect(() => {
    mountRef.current = true;
    fetchAll();
    return () => { mountRef.current = false; };
  }, [fetchAll]);

  useEffect(() => {
    const iv = setInterval(() => {
      setClock(new Date());
      const now = new Date();
      const h = now.getHours(), m = now.getMinutes();
      const todayKey = todayIso();
      if (h === AUTO_REFRESH_HOUR && m >= AUTO_REFRESH_MIN && m < AUTO_REFRESH_MIN + 10 && eveningDoneRef.current !== todayKey) {
        eveningDoneRef.current = todayKey;
        fetchAll();
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  const rows = useMemo(() => Array.isArray(stats?.rows) ? stats!.rows : [], [stats]);
  const last7OPD = rows
    .filter((r) => typeof r.key === "string" && r.key >= from7 && r.key <= todayKey)
    .reduce((s, r) => s + (r.opd ?? 0), 0);
  // “เดือนนี้” แสดงยอดรวม 30 วันล่าสุดตามช่วง from–to
  const monthOPD = rows.reduce((s, r) => s + (r.opd ?? 0), 0);

  const chartRows = useMemo(() => {
    const last14 = rows.slice(-14);
    return last14.map((r) => ({
      label: r.key.slice(5),
      opd: r.opd ?? 0,
      dayIdx: getDayOfWeek(String(r.key)),
    }));
  }, [rows]);

  const totalProc = procStats.rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const pieData = useMemo(() => procPieData(procStats.byProcedure), [procStats.byProcedure]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div className="monitor-page">
      <div className="monitor-topbar">
        <div className="monitor-topbar-left">
          <span className="monitor-logo">🏥</span>
          <h1 className="monitor-title">OPD อายุรกรรม — รพ.สงฆ์</h1>
        </div>
        <div className="monitor-topbar-right">
          <button className="monitor-refresh-btn" onClick={fetchAll} disabled={refreshing} title="รีเฟรชข้อมูล">
            <span className={refreshing ? "monitor-spin" : ""}>&#x21bb;</span> {refreshing ? "กำลังโหลด..." : "Refresh"}
          </button>
          <span className="monitor-clock">{fmtTime(clock)}</span>
          <span className="monitor-date">{todayIso()}</span>
          <button className="monitor-fs-btn" onClick={toggleFullscreen} title="เต็มจอ">⛶</button>
        </div>
      </div>

      <div className="monitor-grid monitor-grid-opd">
        {/* Big Number */}
        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">OPD 7 วันล่าสุด</div>
          <div className="monitor-big-value">{last7OPD.toLocaleString()}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">OPD 30 วันล่าสุด</div>
          <div className="monitor-big-value" style={{ color: "#3b82f6" }}>{monthOPD.toLocaleString()}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">หัตถการ OPD 30 วันล่าสุด</div>
          <div className="monitor-big-value" style={{ color: "#8b5cf6" }}>{totalProc.toLocaleString()}</div>
          <div className="monitor-big-sub">ครั้ง</div>
        </div>

        {/* Bar Chart */}
        <div className="monitor-card monitor-chart-wide">
          <h3 className="monitor-chart-label">OPD 14 วันล่าสุด <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#64748b" }}>(จำนวนผู้ป่วยนอก — ราย)</span></h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 24, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 13 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 13 }} allowDecimals={false}
                label={{ value: "ราย", position: "top", offset: 12, fill: "#94a3b8", fontSize: 13 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                formatter={(v: number) => [`${v} ราย`, "OPD"]} />
              <Bar dataKey="opd" name="OPD (ราย)" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="opd" position="top" fill="#e2e8f0" fontSize={14} fontWeight={600} />
                {chartRows.map((row, i) => (
                  <Cell
                    key={i}
                    fill={typeof row.dayIdx === "number" && row.dayIdx >= 0 ? DAY_COLORS[row.dayIdx] : "#3b82f6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <div className="monitor-card monitor-chart-pie">
            <h3 className="monitor-chart-label">สัดส่วนหัตถการ OPD</h3>
            <div className="monitor-pie-wrap">
              <div style={{ width: "100%", height: 280, overflow: "visible" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 20, right: 30, bottom: 10, left: 30 }}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={80}
                      paddingAngle={3} dataKey="value" nameKey="name"
                      label={({ name, pct, x, y, textAnchor }) => (
                        <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central"
                          fill="#cbd5e1" fontSize={13} fontWeight={500}>
                          {`${name} ${pct}%`}
                        </text>
                      )}
                      labelLine={{ stroke: "#64748b" }}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                      formatter={(value: number, name: string) => [`${value} ครั้ง`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="monitor-pie-legend">
                {pieData.map((p, i) => (
                  <div key={p.name} className="monitor-pie-legend-item">
                    <span className="monitor-pie-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span>{p.name}</span>
                    <span className="monitor-pie-val">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="monitor-footer">
        <span>อัพเดตล่าสุด: {lastUpdate ? fmtTime(lastUpdate) : "—"}</span>
        <span>Auto-refresh ทุกวัน 17:30</span>
        <a href="/monitor" className="monitor-back-link">← เลือก Dashboard</a>
      </div>
    </div>
  );
}
