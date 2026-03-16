"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  getStats,
  getIpdByWard,
  getProcedureStats,
  getProcedurePlansRange,
  GroupBy,
  StatsResponse,
  IpdByWardRow,
  ProcedureStatsResponse,
  ProcedurePlanRow,
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
function fmtTime(d: Date) { return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }); }

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay();
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

export default function MonitorWard() {
  const params = useParams();
  const wardName = decodeURIComponent(String(params.name || ""));

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [ipdRows, setIpdRows] = useState<IpdByWardRow[]>([]);
  const [procStats, setProcStats] = useState<ProcedureStatsResponse>({ rows: [], byProcedure: [] });
  const [planWeek, setPlanWeek] = useState<ProcedurePlanRow[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(new Date());
  const mountRef = useRef(true);
  const eveningDoneRef = useRef("");

  const todayKey = todayIso();
  const weekEndKey = offsetDateIso(6);
  // ใช้ช่วง 30 วันล่าสุดสำหรับตัวเลข Admit/D/C/AO “เดือนนี้” และหัตถการ
  const from = offsetDateIso(-30);
  const to = todayKey;
  const from7 = offsetDateIso(-6);
  const group: GroupBy = "day";

  const fetchAll = useCallback(async () => {
    if (!wardName) return;
    setRefreshing(true);
    try {
      const [s, ipd, p, pw] = await Promise.all([
        getStats(from, to, group),
        getIpdByWard(from, to, group),
        getProcedureStats(from, to, group, wardName),
        getProcedurePlansRange(todayKey, weekEndKey, wardName),
      ]);
      if (!mountRef.current) return;
      setStats(s);
      setIpdRows(Array.isArray(ipd?.rows) ? ipd.rows : []);
      setProcStats({ rows: p?.rows ?? [], byProcedure: p?.byProcedure ?? [] });
      setPlanWeek(Array.isArray(pw?.rows) ? pw.rows : []);
      setLastUpdate(new Date());
    } catch { /* silent */ }
    finally { if (mountRef.current) setRefreshing(false); }
  }, [from, to, wardName, todayKey, weekEndKey]);

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

  const avgLos = stats?.avgLosDays ?? 0;

  const wardIpdRows = useMemo(() =>
    ipdRows.filter((r) => r.ward === wardName),
    [ipdRows, wardName],
  );

  const last7Admit = wardIpdRows
    .filter((r) => String(r.key) >= from7 && String(r.key) <= todayKey)
    .reduce((s, r) => s + (r.admit ?? 0), 0);
  const last7Dc = wardIpdRows
    .filter((r) => String(r.key) >= from7 && String(r.key) <= todayKey)
    .reduce((s, r) => s + (r.discharge ?? 0), 0);
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
      dayIdx: getDayOfWeek(String(r.key)),
    }));
  }, [wardIpdRows]);

  const totalProc = procStats.rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const pieData = useMemo(() => procPieData(procStats.byProcedure), [procStats.byProcedure]);

  const procChartRows = useMemo(() => {
    const last14 = procStats.rows.slice(-14);
    return last14.map((r) => ({ label: String(r.key).slice(5), total: r.total ?? 0 }));
  }, [procStats.rows]);

  const weekdayLabel = (d: string) => {
    const dayIdx = getDayOfWeek(d); // 0=Sun..6=Sat
    const map = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
    return map[dayIdx] || "";
  };

  const weekdayColor = (d: string) => {
    const dayIdx = getDayOfWeek(d);
    switch (dayIdx) {
      case 1: return "#eab308"; // จันทร์ เหลือง
      case 2: return "#ec4899"; // อังคาร ชมพู
      case 3: return "#22c55e"; // พุธ เขียว
      case 4: return "#f97316"; // พฤ ส้ม
      case 5: return "#3b82f6"; // ศุกร์ ฟ้า
      case 6: return "#8b5cf6"; // เสาร์ ม่วง
      case 0:
      default:
        return "#64748b"; // อาทิตย์ เทา/น้ำเงินอ่อน
    }
  };

  const [visibleBlocks, setVisibleBlocks] = useState<Set<string>>(new Set(["summary", "ipd", "proc", "plan"]));
  const toggleBlock = (key: string) => {
    setVisibleBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          <button className="monitor-refresh-btn" onClick={fetchAll} disabled={refreshing} title="รีเฟรชข้อมูล">
            <span className={refreshing ? "monitor-spin" : ""}>&#x21bb;</span> {refreshing ? "กำลังโหลด..." : "Refresh"}
          </button>
          <span className="monitor-clock">{fmtTime(clock)}</span>
          <span className="monitor-date">{todayIso()}</span>
          <button className="monitor-fs-btn" onClick={toggleFullscreen} title="เต็มจอ">⛶</button>
        </div>
      </div>

      {/* Filter toggles (ใต้แถบบนสุด) */}
      <div style={{ padding: "10px 16px 0", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: "0.9rem", color: "#9ca3af" }}>ส่วนที่แสดง:</span>
        <button
          type="button"
          className={`monitor-toggle-chip${visibleBlocks.has("summary") ? " active" : ""}`}
          onClick={() => toggleBlock("summary")}
        >
          ตัวเลขสรุป
        </button>
        <button
          type="button"
          className={`monitor-toggle-chip${visibleBlocks.has("ipd") ? " active" : ""}`}
          onClick={() => toggleBlock("ipd")}
        >
          IPD / D/C
        </button>
        <button
          type="button"
          className={`monitor-toggle-chip${visibleBlocks.has("proc") ? " active" : ""}`}
          onClick={() => toggleBlock("proc")}
        >
          หัตถการ (สถิติ)
        </button>
        <button
          type="button"
          className={`monitor-toggle-chip${visibleBlocks.has("plan") ? " active" : ""}`}
          onClick={() => toggleBlock("plan")}
        >
          แผนหัตถการ (รายเตียง)
        </button>
      </div>

      <div className="monitor-grid monitor-grid-ward">
        {/* Big Numbers */}
        {visibleBlocks.has("summary") && (
        <>
        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">Admit 7 วันล่าสุด</div>
          <div className="monitor-big-value" style={{ color: "#f59e0b" }}>{last7Admit}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">D/C 7 วันล่าสุด</div>
          <div className="monitor-big-value" style={{ color: "#22c55e" }}>{last7Dc}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">Admit 30 วันล่าสุด</div>
          <div className="monitor-big-value" style={{ color: "#3b82f6" }}>{monthAdmit}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">D/C 30 วันล่าสุด</div>
          <div className="monitor-big-value" style={{ color: "#14b8a6" }}>{monthDc}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">A/O 30 วันล่าสุด</div>
          <div className="monitor-big-value" style={{ color: "#8b5cf6" }}>{monthAo}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">Avg LOS</div>
          <div className="monitor-big-value" style={{ color: "#e11d48" }}>{avgLos.toFixed(1)}</div>
          <div className="monitor-big-sub">วัน</div>
        </div>
        </>
        )}

        {/* IPD Admit/DC Chart */}
        {visibleBlocks.has("ipd") && (
        <div className="monitor-card monitor-chart-wide">
          <h3 className="monitor-chart-label">Admit / D/C / A/O — {wardName} (14 วันล่าสุด) <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#64748b" }}>(จำนวนผู้ป่วยใน — ราย)</span></h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 24, right: 12, left: -8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 13 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 13 }} allowDecimals={false}
                label={{ value: "ราย", position: "top", offset: 12, fill: "#94a3b8", fontSize: 13 }} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }} />
              <Bar dataKey="admit" name="Admit (ราย)" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="admit" position="top" fill="#fbbf24" fontSize={13} fontWeight={600} />
                {chartRows.map((row, i) => (
                  <Cell
                    key={i}
                    fill={typeof row.dayIdx === "number" && row.dayIdx >= 0 ? DAY_COLORS[row.dayIdx] : "#f59e0b"}
                  />
                ))}
              </Bar>
              <Bar dataKey="dc" name="D/C (ราย)" fill="#22c55e" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="dc" position="top" fill="#4ade80" fontSize={13} fontWeight={600} />
                {chartRows.map((row, i) => (
                  <Cell
                    key={i}
                    fill={typeof row.dayIdx === "number" && row.dayIdx >= 0 ? DAY_COLORS[row.dayIdx] : "#22c55e"}
                  />
                ))}
              </Bar>
              <Bar dataKey="ao" name="A/O (ราย)" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="ao" position="top" fill="#a78bfa" fontSize={13} fontWeight={600} />
                {chartRows.map((row, i) => (
                  <Cell
                    key={i}
                    fill={typeof row.dayIdx === "number" && row.dayIdx >= 0 ? DAY_COLORS[row.dayIdx] : "#8b5cf6"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Procedure Chart + Pie */}
        {totalProc > 0 && visibleBlocks.has("proc") && (
          <div className="monitor-card monitor-chart-wide">
            <h3 className="monitor-chart-label">หัตถการ {wardName} ({totalProc} ครั้ง) <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "#64748b" }}>(จำนวนหัตถการ — ครั้ง)</span></h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={procChartRows} margin={{ top: 24, right: 12, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 13 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 13 }} allowDecimals={false}
                  label={{ value: "ครั้ง", position: "top", offset: 12, fill: "#94a3b8", fontSize: 13 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }}
                  formatter={(v: number) => [`${v} ครั้ง`, "หัตถการ"]} />
                <Bar dataKey="total" name="หัตถการ (ครั้ง)" fill="#8b5cf6" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="total" position="top" fill="#e2e8f0" fontSize={14} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {pieData.length > 0 && visibleBlocks.has("proc") && (
          <div className="monitor-card monitor-chart-pie">
            <h3 className="monitor-chart-label">สัดส่วนหัตถการ {wardName}</h3>
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
                      labelLine={{ stroke: "#64748b" }}>
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

        {/* Planned Procedures (Today/Tomorrow) */}
        {planWeek.length > 0 && visibleBlocks.has("plan") && (
          <div className="monitor-card monitor-chart-wide">
            <h3 className="monitor-chart-label">แผนหัตถการ {wardName} (สัปดาห์นี้, รายเตียง)</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {planWeek.map((r) => {
                const d = r.planDate || "";
                const label = weekdayLabel(d);
                const color = weekdayColor(d);
                return (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#111827", border: "1px solid #1f2937" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                      <span style={{ fontWeight: 800, color: "#f59e0b" }}>เตียง {r.bed || "-"}</span>
                      <span style={{ color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.procedureKey === "other"
                          ? (r.procedureLabel ? `Other: ${r.procedureLabel}` : "Other")
                          : (PROCEDURE_OPTIONS.find((o) => o.key === r.procedureKey)?.label ?? r.procedureKey)}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: color, color: "#0f172a", fontSize: "0.8rem", fontWeight: 700 }}>
                        {label} {d.slice(5)}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: "0.8rem", color: r.status === "done" ? "#22c55e" : "#94a3b8" }}>
                        {r.status === "done" ? "ทำแล้ว" : "แผน"}
                      </span>
                    </div>
                  </div>
                );
              })}
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
