"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDivKpi, DivKpiResponse, DELAY_REASON_OPTIONS } from "@/lib/api";
import { localDateIso as localDateIsoFn, startOfMonthIso as startOfMonthIsoFn } from "@/lib/date";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PIE_COLORS = ["#e11d48", "#f59e0b", "#8b5cf6", "#64748b"];
function todayIso() { return localDateIsoFn(); }
function startOfMonthIso() { return startOfMonthIsoFn(); }
function fmtTime(d: Date) { return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }); }

function reasonLabel(key: string): string {
  const found = DELAY_REASON_OPTIONS.find((o) => o.key === key);
  return (found && found.label) || key || "อื่นๆ";
}

export default function MonitorDivPage() {
  const [kpi, setKpi] = useState<DivKpiResponse | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(new Date());
  const mountRef = useRef(true);

  const from = startOfMonthIso();
  const to = todayIso();

  const fetchKpi = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getDivKpi(from, to);
      if (!mountRef.current) return;
      setKpi(data);
      setLastUpdate(new Date());
    } catch { /* silent */ }
    finally { if (mountRef.current) setRefreshing(false); }
  }, [from, to]);

  useEffect(() => {
    mountRef.current = true;
    fetchKpi();
    return () => { mountRef.current = false; };
  }, [fetchKpi]);

  useEffect(() => {
    const iv = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(iv);
  }, []);

  const pieData = kpi?.delayByReason?.length
    ? kpi.delayByReason.map((r) => ({ name: reasonLabel(r.reason), value: r.count }))
    : [];

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div className="monitor-page">
      <div className="monitor-topbar">
        <div className="monitor-topbar-left">
          <span className="monitor-logo">📊</span>
          <h1 className="monitor-title">MED analysis — อายุรกรรม รพ.สงฆ์</h1>
        </div>
        <div className="monitor-topbar-right">
          <button className="monitor-refresh-btn" onClick={fetchKpi} disabled={refreshing} title="รีเฟรชข้อมูล">
            <span className={refreshing ? "monitor-spin" : ""}>&#x21bb;</span> {refreshing ? "กำลังโหลด..." : "Refresh"}
          </button>
          <span className="monitor-clock">{fmtTime(clock)}</span>
          <span className="monitor-date">{to}</span>
          <button className="monitor-fs-btn" onClick={toggleFullscreen} title="เต็มจอ">⛶</button>
        </div>
      </div>

      <div className="monitor-grid monitor-grid-ward">
        {/* KPI Cards */}
        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">ค่าเฉลี่ย OPD/วัน</div>
          <div className="monitor-big-value" style={{ color: "#3b82f6" }}>{kpi?.avgOpdPerDay ?? "—"}</div>
          <div className="monitor-big-sub">ราย (ช่วง {from} – {to})</div>
        </div>
        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">ค่าเฉลี่ย Admit IPD/วัน (MED1+MED2)</div>
          <div className="monitor-big-value" style={{ color: "#f59e0b" }}>{kpi?.avgIpdAdmitPerDay ?? "—"}</div>
          <div className="monitor-big-sub">ราย</div>
        </div>
        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">Admission Rate</div>
          <div className="monitor-big-value" style={{ color: "#14b8a6" }}>{kpi != null ? `${kpi.admissionRate}%` : "—"}</div>
          <div className="monitor-big-sub">Admit/(OPD+ER)</div>
        </div>
        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">Avg Delay Discharge (MED1+MED2)</div>
          <div className="monitor-big-value" style={{ color: "#e11d48" }}>{kpi?.avgDelayDischargeDays ?? "—"}</div>
          <div className="monitor-big-sub">วัน (เฉพาะที่ Delay)</div>
        </div>
        <div className="monitor-card monitor-big-num">
          <div className="monitor-big-label">Admit / D/C เดือนนี้ (MED1+MED2)</div>
          <div className="monitor-big-value" style={{ color: "#8b5cf6", fontSize: "1.8rem" }}>
            {kpi != null ? `${kpi.totalAdmit} / ${kpi.totalDischarge}` : "—"}
          </div>
          <div className="monitor-big-sub">ราย</div>
        </div>

        {/* Delay by Reason Pie */}
        <div className="monitor-card monitor-chart-pie">
          <h3 className="monitor-chart-label">สาเหตุ Delay Discharge (MED1+MED2)</h3>
          {pieData.length > 0 ? (
            <div className="monitor-pie-wrap">
              <div style={{ width: "100%", height: 220, overflow: "visible" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value, x, y, textAnchor }) => (
                        <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fill="#cbd5e1" fontSize={12} fontWeight={500}>
                          {name} {value}
                        </text>
                      )}
                      labelLine={{ stroke: "#64748b" }}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", color: "#f1f5f9" }} />
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
          ) : (
            <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>ไม่มีข้อมูล Delay ในช่วงนี้</p>
          )}
        </div>

        {/* Bed Occupancy */}
        <div className="monitor-card monitor-chart-wide">
          <h3 className="monitor-chart-label">Bed Occupancy วันนี้ (MED1 / MED2)</h3>
          {kpi?.occupancy?.length ? (
            <div className="div-occupancy-grid">
              {kpi.occupancy.map((o) => (
                <div key={o.ward} className="div-occupancy-item">
                  <span className="div-occupancy-ward">{o.ward}</span>
                  <span className="div-occupancy-val">{o.current} / {o.beds || "—"}</span>
                  <span className="div-occupancy-pct">{o.beds > 0 ? `${o.pct}%` : "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#64748b", textAlign: "center", padding: 16 }}>กรอกจำนวนเตียงใน Data Entry → D/C</p>
          )}
        </div>

        {/* Delayed list table */}
        <div className="monitor-card monitor-chart-wide" style={{ gridColumn: "span 2" }}>
          <h3 className="monitor-chart-label">รายการ Delayed Discharge — MED1+MED2 (50 รายล่าสุด)</h3>
          {kpi?.delayedList?.length ? (
            <div className="div-delayed-table-wrap">
              <table className="div-delayed-table">
                <thead>
                  <tr>
                    <th>HN</th>
                    <th>Ward</th>
                    <th>Fit D/C</th>
                    <th>Actual D/C</th>
                    <th>Delay (วัน)</th>
                    <th>สาเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {kpi.delayedList.map((r, i) => (
                    <tr key={i}>
                      <td><strong>{r.hn}</strong></td>
                      <td>{r.ward}</td>
                      <td>{r.fitDate || "—"}</td>
                      <td>{r.actualDate || "—"}</td>
                      <td>{r.delayDays}</td>
                      <td>{reasonLabel(r.reason)}{r.detail ? ` — ${r.detail}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>ไม่มีรายการ Delay ในช่วงนี้</p>
          )}
        </div>
      </div>

      <div className="monitor-footer">
        <span>อัพเดตล่าสุด: {lastUpdate ? fmtTime(lastUpdate) : "—"}</span>
        <a href="/monitor" className="monitor-back-link">← เลือก Dashboard</a>
      </div>
    </div>
  );
}
