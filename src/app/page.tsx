"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getStats, getStatsCached, GroupBy, StatsResponse } from "@/lib/api";
import LoadingOverlay from "@/components/LoadingOverlay";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function startOfYearIso() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

function weekToDateRange(year: number, week: number): string {
  const jan1 = new Date(year, 0, 1);
  const startDay = (week - 1) * 7 + 1;
  const endDay = week * 7;
  const start = new Date(jan1);
  start.setDate(startDay);
  const end = new Date(jan1);
  end.setDate(Math.min(endDay, 365 + (year % 4 === 0 ? 1 : 0)));
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return `${fmt(start)}-${fmt(end)}`;
}

const DAY_NAMES_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const DAY_COLORS = [
  "#dc2626", // อา - แดง
  "#eab308", // จ  - เหลือง
  "#ec4899", // อ  - ชมพู
  "#22c55e", // พ  - เขียว
  "#f97316", // พฤ - ส้ม
  "#3b82f6", // ศ  - ฟ้า
  "#8b5cf6", // ส  - ม่วง
];

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00");
  return d.getDay();
}

function shortLabel(key: string, group: string): string {
  if (key.length <= 5) return key;
  const parts = key.split("-");
  if (parts.length === 3 && group === "day") {
    const dow = getDayOfWeek(key);
    return `${DAY_NAMES_SHORT[dow]} ${parts[2]}/${parts[1]}`;
  }
  if (parts.length === 2 && parts[1]?.startsWith("W")) {
    const yr = Number(parts[0]);
    const wk = Number(parts[1].replace("W", ""));
    return `W${String(wk).padStart(2, "0")} (${weekToDateRange(yr, wk)})`;
  }
  if (parts.length === 2 && group === "month") {
    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const mi = Number(parts[1]) - 1;
    return monthNames[mi] || parts[1];
  }
  if (parts.length === 1 && group === "year") return `ปี ${key}`;
  return key.slice(-5);
}

const mockRows = [
  { key: "2026-02-10", opd: 22, consult: 3, ipdAdmit: 5, ipdDischarge: 4 },
  { key: "2026-02-11", opd: 27, consult: 4, ipdAdmit: 6, ipdDischarge: 5 },
  { key: "2026-02-12", opd: 24, consult: 2, ipdAdmit: 4, ipdDischarge: 3 },
  { key: "2026-02-13", opd: 30, consult: 5, ipdAdmit: 7, ipdDischarge: 6 },
  { key: "2026-02-14", opd: 26, consult: 4, ipdAdmit: 5, ipdDischarge: 6 },
  { key: "2026-02-17", opd: 20, consult: 3, ipdAdmit: 3, ipdDischarge: 2 },
  { key: "2026-02-18", opd: 25, consult: 2, ipdAdmit: 4, ipdDischarge: 5 },
];

const WARD_COLORS = ["#2563eb", "#f59e0b", "#14b8a6", "#e11d48", "#8b5cf6", "#f97316"];

const mockWardStats = [
  { ward: "MED1", admit: 8, discharge: 6 },
  { ward: "MED2", admit: 7, discharge: 5 },
  { ward: "IMC", admit: 4, discharge: 4 },
  { ward: "Palliative", admit: 3, discharge: 2 },
  { ward: "ward90", admit: 5, discharge: 4 },
  { ward: "ICU", admit: 2, discharge: 2 },
];

const DAY_LEGEND = [
  { name: "จันทร์", color: DAY_COLORS[1] },
  { name: "อังคาร", color: DAY_COLORS[2] },
  { name: "พุธ", color: DAY_COLORS[3] },
  { name: "พฤหัสฯ", color: DAY_COLORS[4] },
  { name: "ศุกร์", color: DAY_COLORS[5] },
  { name: "เสาร์", color: DAY_COLORS[6] },
  { name: "อาทิตย์", color: DAY_COLORS[0] },
];

function DayColorLegend() {
  return (
    <div className="day-legend">
      {DAY_LEGEND.map((d) => (
        <span key={d.name} className="day-legend-item">
          <span className="day-legend-dot" style={{ background: d.color }} />
          {d.name}
        </span>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [from, setFrom] = useState(startOfYearIso());
  const [to, setTo] = useState(todayIso());
  const [group, setGroup] = useState<GroupBy>("day");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useMock, setUseMock] = useState(false);
  const [ipdView, setIpdView] = useState<"both" | "admit" | "dc">("both");
  const emptyData: StatsResponse = { rows: [], wardStats: [], avgLosDays: 0 };
  const [data, setData] = useState<StatsResponse>(emptyData);

  const safeParse = (res: StatsResponse): StatsResponse => ({
    rows: Array.isArray(res?.rows) ? res.rows : [],
    wardStats: Array.isArray(res?.wardStats) ? res.wardStats : [],
    avgLosDays: Number(res?.avgLosDays || 0),
  });

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");

    const stale = getStatsCached(from, to, group);
    if (stale) setData(safeParse(stale));

    let mounted = true;
    getStats(from, to, group)
      .then((res) => mounted && setData(safeParse(res)))
      .catch((e) => mounted && setError(e.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [from, to, group]);

  useEffect(() => {
    const cleanup = fetchData();
    return cleanup;
  }, [fetchData]);

  const safeRows = Array.isArray(data?.rows) ? data.rows : [];
  const safeWardStats = Array.isArray(data?.wardStats) ? data.wardStats : [];
  const viewRows = useMock ? mockRows : safeRows;
  const viewWardStats = useMock ? mockWardStats : safeWardStats;
  const viewLos = useMock ? 4.2 : Number(data.avgLosDays || 0);

  const chartRows = useMemo(() => viewRows.map((r) => ({
    ...r,
    label: shortLabel(r.key, group),
    dayIdx: group === "day" && r.key.length >= 10 ? getDayOfWeek(r.key) : -1,
  })), [viewRows, group]);

  const wardPieData = useMemo(() => {
    const totalAdmit = viewWardStats.reduce((s, w) => s + (w.admit as number), 0);
    if (totalAdmit === 0) return [];
    return viewWardStats
      .filter((w) => (w.admit as number) > 0)
      .map((w) => ({
        name: w.ward as string,
        value: w.admit as number,
        pct: Math.round(((w.admit as number) / totalAdmit) * 100),
      }));
  }, [viewWardStats]);

  const totals = useMemo(() => {
    return viewRows.reduce(
      (acc, row) => {
        acc.opd += row.opd;
        acc.consult += row.consult;
        acc.ipdAdmit += row.ipdAdmit;
        acc.ipdDischarge += row.ipdDischarge;
        return acc;
      },
      { opd: 0, consult: 0, ipdAdmit: 0, ipdDischarge: 0 },
    );
  }, [viewRows]);

  const chartH = 260;
  const rangeText = `${from} ถึง ${to}`;

  function exportCsv() {
    const bom = "\uFEFF";
    const header = "วันที่,OPD,Consult,IPD Admit,IPD D/C\n";
    const rows = viewRows.map((r) => `${r.key},${r.opd},${r.consult},${r.ipdAdmit},${r.ipdDischarge}`).join("\n");
    const wardHeader = "\n\nWard,Admit,D/C\n";
    const wardRows = viewWardStats.map((w) => `${w.ward},${w.admit},${w.discharge}`).join("\n");
    const summary = `\n\nสรุป ${from} ถึง ${to}\nOPD รวม,${totals.opd}\nConsult รวม,${totals.consult}\nIPD Admit รวม,${totals.ipdAdmit}\nIPD D/C รวม,${totals.ipdDischarge}\nAvg LOS,${viewLos.toFixed(1)} วัน`;
    const blob = new Blob([bom + header + rows + wardHeader + wardRows + summary], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MedPriest_Dashboard_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printPage() {
    window.print();
  }

  return (
    <section>
      <LoadingOverlay show={loading && safeRows.length === 0} text="กำลังโหลดข้อมูล Dashboard..." />

      <div className="page-header" data-range={rangeText}>
        <h1>📊 Dashboard อายุรกรรม รพ.สงฆ์</h1>
        <p>สรุปจำนวนผู้ป่วย OPD / Consult / IPD</p>
        <p className="print-range">ข้อมูล: {rangeText}</p>
      </div>

      <div className="control-row" style={{ position: "relative", zIndex: 10000 }}>
        <label>
          ตั้งแต่วันที่
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          ถึงวันที่
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          แสดงกราฟแบบ
          <select value={group} onChange={(e) => setGroup(e.target.value as GroupBy)}>
            <option value="day">แยกเป็นวัน</option>
            <option value="week">รวมเป็นสัปดาห์</option>
            <option value="month">รวมเป็นเดือน</option>
            <option value="year">รวมเป็นปี</option>
          </select>
        </label>
        <label>
          โหมด
          <select value={useMock ? "mock" : "real"} onChange={(e) => setUseMock(e.target.value === "mock")}>
            <option value="real">ข้อมูลจริง</option>
            <option value="mock">ตัวอย่าง</option>
          </select>
        </label>
        {loading && <span style={{ color: "var(--muted)", fontSize: 13, alignSelf: "center" }}>⏳ กำลังโหลด...</span>}
        <div className="export-buttons">
          <button className="btn-export" onClick={printPage} title="พิมพ์หน้านี้พร้อมกราฟ">🖨️ Print</button>
          <button className="btn-export btn-export-csv" onClick={exportCsv} title="ดาวน์โหลดเป็นไฟล์ CSV เปิดใน Excel ได้">📥 Excel/CSV</button>
        </div>
      </div>

      {error && (
        <div className="entry-msg error" style={{ maxWidth: "none" }}>
          เกิดข้อผิดพลาด: {error}{" "}
          <button onClick={fetchData} style={{ marginLeft: 8, padding: "4px 14px", fontSize: "0.85rem" }}>
            ลองใหม่
          </button>
        </div>
      )}

      {/* ─── Date range badge ─── */}
      <div className="date-range-badge">
        📅 ช่วงข้อมูล: <strong>{from}</strong> ถึง <strong>{to}</strong>
      </div>

      {/* ─── Stat cards ─── */}
      <div className="stat-grid">
        <div className="stat-card blue">
          <div className="stat-card-icon">🏥</div>
          <div className="stat-card-label">OPD</div>
          <div className="stat-card-value">{totals.opd.toLocaleString()}</div>
        </div>
        <div className="stat-card teal">
          <div className="stat-card-icon">📞</div>
          <div className="stat-card-label">Consult</div>
          <div className="stat-card-value">{totals.consult.toLocaleString()}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-icon">🛏️</div>
          <div className="stat-card-label">IPD Admit</div>
          <div className="stat-card-value">{totals.ipdAdmit.toLocaleString()}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-label">IPD D/C</div>
          <div className="stat-card-value">{totals.ipdDischarge.toLocaleString()}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-card-icon">📅</div>
          <div className="stat-card-label">Avg LOS</div>
          <div className="stat-card-value">{viewLos.toFixed(1)} <span style={{ fontSize: "0.7em", fontWeight: 500 }}>วัน</span></div>
        </div>
      </div>

      {/* ─── Chart: OPD ─── */}
      <div className="chart-card">
        <h3 className="chart-title">🏥 OPD ผู้ป่วยนอก <span className="chart-range">{rangeText}</span></h3>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={chartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.key || ""} />
            <Bar dataKey="opd" name="OPD" radius={[4, 4, 0, 0]}>
              {chartRows.map((entry, i) => (
                <Cell key={i} fill={entry.dayIdx >= 0 ? DAY_COLORS[entry.dayIdx] : "#2563eb"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {group === "day" && <DayColorLegend />}
      </div>

      {/* ─── Chart: Consult ─── */}
      <div className="chart-card">
        <h3 className="chart-title">📞 Consult นอกแผนก <span className="chart-range">{rangeText}</span></h3>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={chartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.key || ""} />
            <Bar dataKey="consult" name="Consult" radius={[4, 4, 0, 0]}>
              {chartRows.map((entry, i) => (
                <Cell key={i} fill={entry.dayIdx >= 0 ? DAY_COLORS[entry.dayIdx] : "#14b8a6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {group === "day" && <DayColorLegend />}
      </div>

      {/* ─── Chart: IPD Admit/DC ตามช่วงเวลา ─── */}
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">🛏️ IPD {ipdView === "both" ? "Admit / D/C" : ipdView === "admit" ? "Admit" : "D/C"} <span className="chart-range">{rangeText}</span></h3>
          <div className="chart-filter">
            <button className={`chart-filter-btn${ipdView === "both" ? " active" : ""}`} onClick={() => setIpdView("both")}>เทียบกัน</button>
            <button className={`chart-filter-btn${ipdView === "admit" ? " active" : ""}`} onClick={() => setIpdView("admit")}>Admit</button>
            <button className={`chart-filter-btn${ipdView === "dc" ? " active" : ""}`} onClick={() => setIpdView("dc")}>D/C</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={chartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.key || ""} />
            {ipdView === "both" && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {(ipdView === "both" || ipdView === "admit") && <Bar dataKey="ipdAdmit" fill="#f59e0b" name="Admit" radius={[4, 4, 0, 0]} />}
            {(ipdView === "both" || ipdView === "dc") && <Bar dataKey="ipdDischarge" fill="#22c55e" name="D/C" radius={[4, 4, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Pie Chart: สัดส่วน Ward ─── */}
      <div className="chart-card">
        <h3 className="chart-title">🏥 สัดส่วนผู้ป่วย IPD แยกตาม Ward <span className="chart-range">{rangeText}</span></h3>
        {wardPieData.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>ไม่มีข้อมูล IPD ในช่วงนี้</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={wardPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, pct }) => `${name} ${pct}%`}
                >
                  {wardPieData.map((_, i) => (
                    <Cell key={i} fill={WARD_COLORS[i % WARD_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} ราย`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="ward-legend">
              {wardPieData.map((w, i) => (
                <div key={w.name} className="ward-legend-item">
                  <span className="ward-legend-dot" style={{ background: WARD_COLORS[i % WARD_COLORS.length] }} />
                  <span className="ward-legend-name">{w.name}</span>
                  <span className="ward-legend-val">{w.value} ราย ({w.pct}%)</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
