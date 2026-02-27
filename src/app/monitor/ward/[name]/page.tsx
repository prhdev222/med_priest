"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  getStats,
  getIpdByWard,
  getProcedureStats,
  GroupBy,
  StatsResponse,
  IpdByWardRow,
  ProcedureStatsResponse,
  PROCEDURE_OPTIONS,
} from "@/lib/api";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const REFRESH_MS = 5 * 60 * 1000;
const PIE_COLORS = ["#3b82f6", "#f59e0b", "#14b8a6", "#e11d48", "#8b5cf6", "#f97316", "#22c55e", "#ec4899", "#06b6d4", "#84cc16"];

function todayIso() { return new Date().toISOString().slice(0, 10); }
function startOfMonthIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function fmtTime(d: Date) { return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }); }

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

export default function MonitorWard() {
  const params = useParams();
  const wardName = decodeURIComponent(String(params.name || ""));

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [ipdRows, setIpdRows] = useState<IpdByWardRow[]>([]);
  const [procStats, setProcStats] = useState<ProcedureStatsResponse>({ rows: [], byProcedure: [] });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [clock, setClock] = useState(new Date());
  const mountRef = useRef(true);

  const from = startOfMonthIso();
  const to = todayIso();
  const group: GroupBy = "day";

  const fetchAll = useCallback(async () => {
    if (!wardName) return;
    try {
      const [s, ipd, p] = await Promise.all([
        getStats(from, to, group),
        getIpdByWard(from, to, group),
        getProcedureStats(from, to, group, wardName),
      ]);
      if (!mountRef.current) return;
      setStats(s);
      setIpdRows(Array.isArray(ipd?.rows) ? ipd.rows : []);
      setProcStats({ rows: p?.rows ?? [], byProcedure: p?.byProcedure ?? [] });
      setLastUpdate(new Date());
    } catch { /* silent */ }
  }, [from, to, wardName]);

  useEffect(() => {
    mountRef.current = true;
    fetchAll();
    const iv = setInterval(fetchAll, REFRESH_MS);
    return () => { mountRef.current = false; clearInterval(iv); };
  }, [fetchAll]);

  useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const avgLos = stats?.avgLosDays ?? 0;

  const wardIpdRows = useMemo(() =>
    ipdRows.filter((r) => r.ward === wardName),
    [ipdRows, wardName],
  );

  const todayAdmit = wardIpdRows.find((r) => r.key === todayIso())?.admit ?? 0;
  const todayDc = wardIpdRows.find((r) => r.key === todayIso())?.discharge ?? 0;
  const monthAdmit = wardIpdRows.reduce((s, r) => s + (r.admit ?? 0), 0);
  const monthDc = wardIpdRows.reduce((s, r) => s + (r.discharge ?? 0), 0);
  const monthAo = wardIpdRows.reduce((s, r) => s + ((r as { ao?: number }).ao ?? 0), 0);

  const chartRows = useMemo(() => {
    const last14 = wardIpdRows.slice(-14);
    return last14.map((r) => ({
      label: String(r.key).slice(5),
      admit: r.admit ?? 0,
      dc: r.discharge ?? 0,
      ao: (r as { ao?: number }).ao ?? 0,
    }));
  }, [wardIpdRows]);

  const totalProc = procStats.rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const pieData = useMemo(() => procPieData(procStats.byProcedure), [procStats.byProcedure]);

  const procChartRows = useMemo(() => {
    const last14 = procStats.rows.slice(-14);
    return last14.map((r) => ({ label: String(r.key).slice(5), total: r.total ?? 0 }));
  }, [procStats.rows]);

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
          <span className="monitor-logo">🛏️</span>
          <h1 className="monitor-title">Ward {wardName} — อายุรกรรม รพ.สงฆ์</h1>
        </div>
        <div className="monitor-topbar-right">
          <span className="monitor-clock">{fmtTime(clock)}</span>
          <span className="monitor-date">{todayIso()}</span>
          <button className="monitor-fs-btn" onClick={toggleFullscreen} title="เต็มจอ">⛶</button>
        </div>
      </div>

      <div className="monitor-grid monitor-grid-ward">
        {/* Big Numbers */}
        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">Admit วันนี้</div>
          <div className="monitor-big-value" style={{ color: "#f59e0b" }}>{todayAdmit}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">D/C วันนี้</div>
          <div className="monitor-big-value" style={{ color: "#22c55e" }}>{todayDc}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">Admit เดือนนี้</div>
          <div className="monitor-big-value" style={{ color: "#3b82f6" }}>{monthAdmit}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">D/C เดือนนี้</div>
          <div className="monitor-big-value" style={{ color: "#14b8a6" }}>{monthDc}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">A/O เดือนนี้</div>
          <div className="monitor-big-value" style={{ color: "#8b5cf6" }}>{monthAo}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">Avg LOS</div>
          <div className="monitor-big-value" style={{ color: "#e11d48" }}>{avgLos.toFixed(1)}</div>
          <div className="monitor-big-sub">วัน</div>
        </div>

        {/* IPD Admit/DC Chart */}
        <div className="monitor-card monitor-chart-wide">
          <h3 className="monitor-chart-label">Admit / D/C — {wardName} (14 วันล่าสุด)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 13 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 13 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }} />
              <Bar dataKey="admit" name="Admit" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="dc" name="D/C" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ao" name="A/O" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Procedure Chart + Pie */}
        {totalProc > 0 && (
          <div className="monitor-card monitor-chart-wide">
            <h3 className="monitor-chart-label">หัตถการ {wardName} ({totalProc} ครั้ง)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={procChartRows} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 13 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 13 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                  formatter={(v: number) => [`${v} ครั้ง`, "หัตถการ"]} />
                <Bar dataKey="total" name="หัตถการ" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {pieData.length > 0 && (
          <div className="monitor-card monitor-chart-pie">
            <h3 className="monitor-chart-label">สัดส่วนหัตถการ {wardName}</h3>
            <div className="monitor-pie-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={100}
                    paddingAngle={3} dataKey="value" nameKey="name"
                    label={({ name, pct }) => `${name} ${pct}%`}
                    labelLine={{ stroke: "#64748b" }}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                    formatter={(value: number, name: string) => [`${value} ครั้ง`, name]} />
                </PieChart>
              </ResponsiveContainer>
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
        <span>อัพเดตล่าสุด: {fmtTime(lastUpdate)}</span>
        <span>Auto-refresh ทุก 5 นาที</span>
        <a href="/monitor" className="monitor-back-link">← เลือก Dashboard</a>
      </div>
    </div>
  );
}
