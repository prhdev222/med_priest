"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getStats, getStatsCached, getIpdByWard, getIpdByWardCached, getProcedureStats, getProcedureStatsCached, GroupBy, StatsResponse, IpdByWardRow, PROCEDURE_OPTIONS, ProcedureStatsResponse } from "@/lib/api";
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

/** คืนวันจันทร์ของสัปดาห์ที่ตรงกับ dateStr (สัปดาห์เริ่มจันทร์) */
function startOfWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=อาทิตย์, 1=จันทร์, ...
  const back = (day + 6) % 7;
  d.setDate(d.getDate() - back);
  return d.toISOString().slice(0, 10);
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

/** สัปดาห์ที่ 1 = 1-7 ม.ค., สัปดาห์ที่ 2 = 8-14 ม.ค., ... */
function weekToFromTo(year: number, week: number): { from: string; to: string } {
  const jan1 = new Date(year, 0, 1);
  const start = new Date(jan1);
  start.setDate(1 + (week - 1) * 7);
  let end = new Date(start);
  end.setDate(end.getDate() + 6);
  const dec31 = new Date(year, 11, 31);
  if (end > dec31) end = dec31;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(start), to: fmt(end) };
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // day 0 of next month = last day of month
  return d.toISOString().slice(0, 10);
}

/** คืนค่า ISO week "YYYY-Www" ของวันที่ d (จันทร์–อาทิตย์) */
function getISOWeekValue(d: Date): string {
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const mon1 = new Date(jan4);
  mon1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const diff = Math.floor((d.getTime() - mon1.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.floor(diff / 7) + 1;
  if (week < 1) return `${year - 1}-W${String(getISOWeekNum(new Date(year - 1, 11, 31))).padStart(2, "0")}`;
  if (week > 52) {
    const dec31 = new Date(year, 11, 31);
    const nextJan4 = new Date(year + 1, 0, 4);
    if (d >= nextJan4) return `${year + 1}-W01`;
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  return `${year}-W${String(week).padStart(2, "0")}`;
}
function getISOWeekNum(d: Date): number {
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const mon1 = new Date(jan4);
  mon1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const diff = Math.floor((d.getTime() - mon1.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(53, Math.floor(diff / 7) + 1));
}

/** แปลงค่า input type="week" (YYYY-Www) เป็นช่วงจันทร์–อาทิตย์ */
function isoWeekValueToFromTo(weekValue: string): { from: string; to: string } {
  const match = weekValue.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return { from: todayIso(), to: todayIso() };
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const mon1 = new Date(jan4);
  mon1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const fromDate = new Date(mon1);
  fromDate.setDate(mon1.getDate() + (week - 1) * 7);
  const toDate = new Date(fromDate);
  toDate.setDate(toDate.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(fromDate), to: fmt(toDate) };
}

const MONTH_NAMES = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function getWeekOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return Math.min(52, Math.ceil(dayOfYear / 7));
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
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
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
  { key: "2026-02-10", opd: 22, er: 5, consult: 3, ipdAdmit: 5, ipdDischarge: 4 },
  { key: "2026-02-11", opd: 27, er: 6, consult: 4, ipdAdmit: 6, ipdDischarge: 5 },
  { key: "2026-02-12", opd: 24, er: 4, consult: 2, ipdAdmit: 4, ipdDischarge: 3 },
  { key: "2026-02-13", opd: 30, er: 7, consult: 5, ipdAdmit: 7, ipdDischarge: 6 },
  { key: "2026-02-14", opd: 26, er: 3, consult: 4, ipdAdmit: 5, ipdDischarge: 6 },
  { key: "2026-02-17", opd: 20, er: 5, consult: 3, ipdAdmit: 3, ipdDischarge: 2 },
  { key: "2026-02-18", opd: 25, er: 4, consult: 2, ipdAdmit: 4, ipdDischarge: 5 },
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

/** Mock IPD แยก Ward รวม A/O (key ต้องตรงกับ mockRows) */
const mockIpdByWardRows: IpdByWardRow[] = [
  { key: "2026-02-10", ward: "MED1", admit: 2, discharge: 1, ao: 1 },
  { key: "2026-02-10", ward: "MED2", admit: 1, discharge: 1, ao: 2 },
  { key: "2026-02-10", ward: "IMC", admit: 1, discharge: 1, ao: 0 },
  { key: "2026-02-11", ward: "MED1", admit: 2, discharge: 2, ao: 2 },
  { key: "2026-02-11", ward: "MED2", admit: 2, discharge: 1, ao: 1 },
  { key: "2026-02-11", ward: "IMC", admit: 1, discharge: 1, ao: 1 },
  { key: "2026-02-12", ward: "MED1", admit: 1, discharge: 1, ao: 1 },
  { key: "2026-02-12", ward: "MED2", admit: 2, discharge: 1, ao: 0 },
  { key: "2026-02-13", ward: "MED1", admit: 2, discharge: 2, ao: 2 },
  { key: "2026-02-13", ward: "MED2", admit: 2, discharge: 2, ao: 1 },
  { key: "2026-02-14", ward: "MED1", admit: 1, discharge: 2, ao: 1 },
  { key: "2026-02-14", ward: "Palliative", admit: 1, discharge: 1, ao: 1 },
  { key: "2026-02-17", ward: "MED1", admit: 1, discharge: 0, ao: 1 },
  { key: "2026-02-17", ward: "MED2", admit: 1, discharge: 1, ao: 0 },
  { key: "2026-02-18", ward: "MED1", admit: 2, discharge: 2, ao: 2 },
  { key: "2026-02-18", ward: "IMC", admit: 1, discharge: 1, ao: 1 },
];

/** Mock หัตถการเฉพาะ ต่อวัน + แยกตามประเภท */
const mockProcedureStats: ProcedureStatsResponse = {
  rows: [
    { key: "2026-02-10", total: 6 },
    { key: "2026-02-11", total: 8 },
    { key: "2026-02-12", total: 4 },
    { key: "2026-02-13", total: 10 },
    { key: "2026-02-14", total: 5 },
    { key: "2026-02-17", total: 7 },
    { key: "2026-02-18", total: 9 },
  ],
  byProcedure: [
    { procedureKey: "egd", procedureLabel: "EGD", count: 18 },
    { procedureKey: "colonoscopy", procedureLabel: "Colonoscopy", count: 12 },
    { procedureKey: "bone_marrow", procedureLabel: "Bone marrow aspiration & biopsy", count: 8 },
    { procedureKey: "pleural_tapping", procedureLabel: "Pleural tapping", count: 6 },
    { procedureKey: "lumbar_puncture", procedureLabel: "Lumbar puncture", count: 5 },
    { procedureKey: "echocardiogram", procedureLabel: "Echocardiogram", count: 4 },
    { procedureKey: "other", procedureLabel: "Bedside US", count: 4 },
  ],
};

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

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const currentIsoWeek = getISOWeekValue(new Date());
const currentYearMonth = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, "0")}`;

export default function DashboardPage() {
  const [group, setGroup] = useState<GroupBy>("day");
  const [filterDayFrom, setFilterDayFrom] = useState(startOfYearIso());
  const [filterDayTo, setFilterDayTo] = useState(todayIso());
  const [filterWeekFrom, setFilterWeekFrom] = useState(currentIsoWeek);
  const [filterWeekTo, setFilterWeekTo] = useState(currentIsoWeek);
  const [filterMonthFrom, setFilterMonthFrom] = useState(currentYearMonth);
  const [filterMonthTo, setFilterMonthTo] = useState(currentYearMonth);
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [filterYearEnd, setFilterYearEnd] = useState(CURRENT_YEAR);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useMock, setUseMock] = useState(false);
  const [ipdShowAdmit, setIpdShowAdmit] = useState(true);
  const [ipdShowDc, setIpdShowDc] = useState(true);
  const [ipdShowAo, setIpdShowAo] = useState(true);
  const [ipdWard1, setIpdWard1] = useState("");
  const [ipdByWardData, setIpdByWardData] = useState<{ rows: IpdByWardRow[] }>({ rows: [] });
  const [procedureStats, setProcedureStats] = useState<ProcedureStatsResponse>({ rows: [], byProcedure: [] });
  const [procedurePieOpen, setProcedurePieOpen] = useState(false);
  const emptyData: StatsResponse = { rows: [], wardStats: [], avgLosDays: 0 };
  const [data, setData] = useState<StatsResponse>(emptyData);

  const { from, to } = useMemo(() => {
    if (group === "year") {
      const y1 = Math.min(filterYear, filterYearEnd);
      const y2 = Math.max(filterYear, filterYearEnd);
      return { from: `${y1}-01-01`, to: `${y2}-12-31` };
    }
    if (group === "month") {
      const a = filterMonthFrom.match(/^(\d{4})-(\d{2})$/);
      const b = filterMonthTo.match(/^(\d{4})-(\d{2})$/);
      if (!a || !b) return { from: filterMonthFrom + "-01", to: filterMonthTo + "-01" };
      const fromStr = `${a[1]}-${a[2]}-01`;
      const toStr = lastDayOfMonth(parseInt(b[1], 10), parseInt(b[2], 10));
      return { from: fromStr, to: toStr };
    }
    if (group === "week") {
      const a = isoWeekValueToFromTo(filterWeekFrom);
      const b = isoWeekValueToFromTo(filterWeekTo);
      return {
        from: a.from < b.from ? a.from : b.from,
        to: a.to > b.to ? a.to : b.to,
      };
    }
    // day: ใช้ปฏิทิน (จาก–ถึง)
    return { from: filterDayFrom, to: filterDayTo };
  }, [group, filterDayFrom, filterDayTo, filterWeekFrom, filterWeekTo, filterMonthFrom, filterMonthTo, filterYear, filterYearEnd]);

  const safeParse = (res: StatsResponse): StatsResponse => ({
    rows: Array.isArray(res?.rows) ? res.rows : [],
    wardStats: Array.isArray(res?.wardStats) ? res.wardStats : [],
    avgLosDays: Number(res?.avgLosDays || 0),
  });

  const fetchData = useCallback(() => {
    if (useMock) return () => {};
    setLoading(true);
    setError("");
    const fromReq = group === "day" ? startOfWeekMonday(from) : from;

    /* แสดงข้อมูลจาก cache ทันที (ถ้ามี) — รู้สึกโหลดเร็วขึ้น */
    const staleStats = getStatsCached(fromReq, to, group);
    if (staleStats) setData(safeParse(staleStats));
    const staleIpd = getIpdByWardCached(fromReq, to, group);
    if (staleIpd) setIpdByWardData(staleIpd);
    const staleProc = getProcedureStatsCached(fromReq, to, group);
    if (staleProc) setProcedureStats(staleProc);

    let mounted = true;
    Promise.all([
      getStats(fromReq, to, group),
      getIpdByWard(fromReq, to, group),
      getProcedureStats(fromReq, to, group),
    ])
      .then(([statsRes, ipdRes, procRes]) => {
        if (!mounted) return;
        setData(safeParse(statsRes));
        setIpdByWardData({ rows: Array.isArray(ipdRes?.rows) ? ipdRes.rows : [] });
        setProcedureStats({
          rows: Array.isArray(procRes?.rows) ? procRes.rows : [],
          byProcedure: Array.isArray(procRes?.byProcedure) ? procRes.byProcedure : [],
        });
      })
      .catch((e) => mounted && setError((e as Error).message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [from, to, group, useMock]);

  useEffect(() => {
    const cleanup = fetchData();
    return cleanup;
  }, [fetchData]);

  const safeRows = Array.isArray(data?.rows) ? data.rows : [];
  const safeWardStats = Array.isArray(data?.wardStats) ? data.wardStats : [];
  const viewRows = useMock ? mockRows : safeRows;
  const viewWardStats = useMock ? mockWardStats : safeWardStats;
  const viewLos = useMock ? 4.2 : Number(data.avgLosDays || 0);

  const aoByKey = useMemo(() => {
    const rows = useMock ? mockIpdByWardRows : ipdByWardData.rows;
    const m: Record<string, number> = {};
    for (const r of rows) {
      const k = String(r.key);
      m[k] = (m[k] ?? 0) + Number((r as { ao?: number }).ao ?? 0);
    }
    return m;
  }, [useMock, ipdByWardData.rows]);

  const chartRows = useMemo(() => viewRows.map((r) => ({
    ...r,
    opd: r.opd ?? 0,
    er: r.er ?? 0,
    consult: r.consult ?? 0,
    ipdAdmit: r.ipdAdmit ?? 0,
    ipdDischarge: r.ipdDischarge ?? 0,
    ipdAo: aoByKey[r.key] ?? 0,
    label: shortLabel(r.key, group),
    dayIdx: group === "day" && r.key.length >= 10 ? getDayOfWeek(r.key) : -1,
  })), [viewRows, group, aoByKey]);

  const wardList = useMemo(() => {
    const fromStats = (viewWardStats as { ward?: string }[]).map((w) => w.ward as string).filter(Boolean);
    const fromIpdByWard = ipdByWardData.rows.map((r) => r.ward).filter(Boolean);
    const allWards = Array.from(new Set([...fromStats, ...fromIpdByWard])).sort();
    return ["ทั้งหมด", ...allWards];
  }, [viewWardStats, ipdByWardData.rows]);

  const effectiveIpdByWardRows = useMemo(() => {
    if (useMock) return mockIpdByWardRows.map((x) => ({
      key: String(x.key),
      ward: String(x.ward),
      admit: Number(x.admit ?? 0),
      discharge: Number(x.discharge ?? 0),
      ao: Number(x.ao ?? 0),
    }));
    return ipdByWardData.rows.map((x) => ({
      key: String(x.key),
      ward: String(x.ward),
      admit: Number(x.admit ?? 0),
      discharge: Number(x.discharge ?? 0),
      ao: Number((x as { ao?: number }).ao ?? 0),
    }));
  }, [useMock, chartRows, viewWardStats, ipdByWardData.rows]);

  const getWardVal = useCallback(
    (key: string, ward: string, type: "admit" | "discharge" | "ao") => {
      const r = effectiveIpdByWardRows.find((x) => String(x.key) === String(key) && String(x.ward) === String(ward));
      if (!r) return 0;
      if (type === "admit") return r.admit;
      if (type === "discharge") return r.discharge;
      return r.ao ?? 0;
    },
    [effectiveIpdByWardRows],
  );

  const ipdChartRows = useMemo(() => {
    const base = chartRows.map((r) => ({ ...r }));
    if (!ipdWard1 || ipdWard1 === "ทั้งหมด") return base;
    return base.map((row) => {
      const out = { ...row } as Record<string, unknown>;
      out[`${ipdWard1} (Admit)`] = getWardVal(row.key, ipdWard1, "admit");
      out[`${ipdWard1} (D/C)`] = getWardVal(row.key, ipdWard1, "discharge");
      out[`${ipdWard1} (A/O)`] = getWardVal(row.key, ipdWard1, "ao");
      return out;
    });
  }, [chartRows, ipdWard1, getWardVal]);

  const ipdWardChartHasData = useMemo(() => {
    if (!ipdWard1 || ipdWard1 === "ทั้งหมด") return true;
    const keys: string[] = [];
    if (ipdShowAdmit) keys.push(`${ipdWard1} (Admit)`);
    if (ipdShowDc) keys.push(`${ipdWard1} (D/C)`);
    if (ipdShowAo) keys.push(`${ipdWard1} (A/O)`);
    if (keys.length === 0) return true;
    const sum = ipdChartRows.reduce((s, row) => {
      const r = row as Record<string, unknown>;
      return s + keys.reduce((a, k) => a + (Number(r[k]) || 0), 0);
    }, 0);
    return sum > 0;
  }, [ipdChartRows, ipdWard1, ipdShowAdmit, ipdShowDc, ipdShowAo]);

  const ipdViewLabel = useMemo(() => {
    const parts: string[] = [];
    if (ipdShowAdmit) parts.push("Admit");
    if (ipdShowDc) parts.push("D/C");
    if (ipdShowAo) parts.push("A/O");
    return parts.length === 0 ? "—" : parts.join(" / ");
  }, [ipdShowAdmit, ipdShowDc, ipdShowAo]);

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

  const viewProcedureStats = useMock ? mockProcedureStats : procedureStats;

  const procedureChartRows = useMemo(() => {
    return viewProcedureStats.rows.map((r) => ({
      ...r,
      label: shortLabel(r.key, group),
    }));
  }, [viewProcedureStats.rows, group]);

  const procedurePieData = useMemo(() => {
    const list = viewProcedureStats.byProcedure;
    const total = list.reduce((s, p) => s + Number(p.count || 0), 0);
    if (total === 0) return [];
    return list.map((p) => {
      const name = p.procedureKey === "other"
        ? (p.procedureLabel ? `Other: ${p.procedureLabel}` : "Other")
        : (PROCEDURE_OPTIONS.find((o) => o.key === p.procedureKey)?.label ?? p.procedureKey);
      return {
        name,
        value: Number(p.count || 0),
        pct: Math.round((Number(p.count || 0) / total) * 100),
      };
    });
  }, [viewProcedureStats.byProcedure]);

  const totals = useMemo(() => {
    return viewRows.reduce(
      (acc, row) => {
        acc.opd += row.opd ?? 0;
        acc.er += row.er ?? 0;
        acc.consult += row.consult ?? 0;
        acc.ipdAdmit += row.ipdAdmit ?? 0;
        acc.ipdDischarge += row.ipdDischarge ?? 0;
        return acc;
      },
      { opd: 0, er: 0, consult: 0, ipdAdmit: 0, ipdDischarge: 0 },
    );
  }, [viewRows]);

  const chartH = 260;
  const rangeText = `${from} ถึง ${to}`;

  const hasNoData =
    !useMock &&
    !loading &&
    (chartRows.length === 0 ||
      (totals.opd === 0 && totals.er === 0 && totals.consult === 0 && totals.ipdAdmit === 0 && totals.ipdDischarge === 0));

  function exportCsv() {
    const bom = "\uFEFF";
    const noteRow =
      hasNoData
        ? "หมายเหตุ: ไม่มีข้อมูลในช่วงวันที่เลือก ให้กรอกข้อมูลจากหน้า Data Entry\n"
        : "";
    const header = "วันที่,OPD,ER ผู้ป่วยนอก,Consult,IPD Admit,IPD D/C,IPD A/O\n";
    const rows = chartRows.map((r) => `${r.key},${r.opd ?? 0},${r.er ?? 0},${r.consult ?? 0},${r.ipdAdmit ?? 0},${r.ipdDischarge ?? 0},${r.ipdAo ?? 0}`).join("\n");

    const wardAgg: Record<string, { admit: number; discharge: number; ao: number }> = {};
    for (const r of effectiveIpdByWardRows) {
      const ward = String(r.ward ?? "");
      if (!ward) continue;
      if (!wardAgg[ward]) wardAgg[ward] = { admit: 0, discharge: 0, ao: 0 };
      wardAgg[ward].admit += Number(r.admit ?? 0);
      wardAgg[ward].discharge += Number(r.discharge ?? 0);
      wardAgg[ward].ao += Number(r.ao ?? 0);
    }
    const wardHeader = "\n\nWard,Admit,D/C,A/O\n";
    const wardRows = Object.keys(wardAgg)
      .sort()
      .map((ward) => `${ward},${wardAgg[ward].admit},${wardAgg[ward].discharge},${wardAgg[ward].ao}`)
      .join("\n");

    const totalAo = chartRows.reduce((s, r) => s + (r.ipdAo ?? 0), 0);
    const totalProcedure = viewProcedureStats.rows.reduce((s, r) => s + (r.total ?? 0), 0);
    const summary = `\n\nสรุป ${from} ถึง ${to}\nOPD รวม,${totals.opd}\nER ผู้ป่วยนอก รวม,${totals.er}\nConsult รวม,${totals.consult}\nIPD Admit รวม,${totals.ipdAdmit}\nIPD D/C รวม,${totals.ipdDischarge}\nIPD A/O รวม,${totalAo}\nAvg LOS,${viewLos.toFixed(1)} วัน\nหัตถการเฉพาะ รวม,${totalProcedure} ครั้ง`;

    let procedureSection = "";
    if (viewProcedureStats.rows.length > 0) {
      procedureSection = "\n\nหัตถการเฉพาะ ต่อช่วง\nช่วง,จำนวนครั้ง\n" + viewProcedureStats.rows.map((r) => `${r.key},${r.total ?? 0}`).join("\n");
    }
    if (procedurePieData.length > 0) {
      procedureSection += "\n\nหัตถการเฉพาะ แยกตามประเภท\nประเภท,จำนวนครั้ง,สัดส่วน(%)\n" + procedurePieData.map((p) => `"${String(p.name).replace(/"/g, '""')}",${p.value},${p.pct}`).join("\n");
    }

    const blob = new Blob([bom + noteRow + header + rows + wardHeader + wardRows + procedureSection + summary], { type: "text/csv;charset=utf-8;" });
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
        <p>สรุปจำนวนผู้ป่วย OPD / ER ผู้ป่วยนอก / Consult / IPD</p>
        <p className="print-range">ข้อมูล: {rangeText}</p>
      </div>

      <div className="control-row" style={{ position: "relative", zIndex: 10000 }}>
        <label>
          แสดงกราฟแบบ
          <select value={group} onChange={(e) => setGroup(e.target.value as GroupBy)}>
            <option value="day">แยกเป็นวัน</option>
            <option value="week">รวมเป็นสัปดาห์</option>
            <option value="month">รวมเป็นเดือน</option>
            <option value="year">รวมเป็นปี</option>
          </select>
        </label>
        {/* ตัวกรองตามระดับ: วัน → เดือน, สัปดาห์ → สัปดาห์, เดือน → เดือน, ปี → ปี */}
        {group === "day" && (
          <>
            <label>ตั้งแต่วันที่ <input type="date" value={filterDayFrom} onChange={(e) => setFilterDayFrom(e.target.value)} /></label>
            <label>ถึงวันที่ <input type="date" value={filterDayTo} onChange={(e) => setFilterDayTo(e.target.value)} /></label>
          </>
        )}
        {group === "week" && (
          <>
            <label>ตั้งแต่สัปดาห์ <input type="week" value={filterWeekFrom} onChange={(e) => setFilterWeekFrom(e.target.value)} title="เลือกสัปดาห์" /></label>
            <label>ถึงสัปดาห์ <input type="week" value={filterWeekTo} onChange={(e) => setFilterWeekTo(e.target.value)} title="เลือกสัปดาห์" /></label>
          </>
        )}
        {group === "month" && (
          <>
            <label>ตั้งแต่เดือน <input type="month" value={filterMonthFrom} onChange={(e) => setFilterMonthFrom(e.target.value)} title="เลือกปี-เดือน" /></label>
            <label>ถึงเดือน <input type="month" value={filterMonthTo} onChange={(e) => setFilterMonthTo(e.target.value)} title="เลือกปี-เดือน" /></label>
          </>
        )}
        {group === "year" && (
          <>
            <label>ตั้งแต่ปี <input type="number" min={2020} max={2032} value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value) || CURRENT_YEAR)} style={{ width: 72 }} title="ปี พ.ศ. ลบ 543" /></label>
            <label>ถึงปี <input type="number" min={2020} max={2032} value={filterYearEnd} onChange={(e) => setFilterYearEnd(Number(e.target.value) || CURRENT_YEAR)} style={{ width: 72 }} title="ปี พ.ศ. ลบ 543" /></label>
          </>
        )}
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

      {hasNoData && (
        <div className="entry-msg" style={{ maxWidth: "none", background: "#fef3c7", color: "#92400e" }}>
          ไม่มีข้อมูลในช่วงวันที่เลือก ให้{" "}
          <a href="/data-entry" style={{ fontWeight: "bold", textDecoration: "underline" }}>กรอกข้อมูลจากหน้า Data Entry</a>
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
        <div className="stat-card orange">
          <div className="stat-card-icon">🚑</div>
          <div className="stat-card-label">ER ผู้ป่วยนอก</div>
          <div className="stat-card-value">{totals.er.toLocaleString()}</div>
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
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? payload?.[0]?.payload?.key ?? ""} />
            <Bar dataKey="opd" name="OPD" radius={[4, 4, 0, 0]}>
              {chartRows.map((entry, i) => (
                <Cell key={i} fill={entry.dayIdx >= 0 ? DAY_COLORS[entry.dayIdx] : "#2563eb"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {group === "day" && <DayColorLegend />}
      </div>

      {/* ─── Chart: ER ผู้ป่วยนอก ─── */}
      <div className="chart-card">
        <h3 className="chart-title">🚑 ER ผู้ป่วยนอก <span className="chart-range">{rangeText}</span></h3>
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={chartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? payload?.[0]?.payload?.key ?? ""} />
            <Bar dataKey="er" name="ER" radius={[4, 4, 0, 0]}>
              {chartRows.map((entry, i) => (
                <Cell key={i} fill={entry.dayIdx >= 0 ? DAY_COLORS[entry.dayIdx] : "#f97316"} />
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
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? payload?.[0]?.payload?.key ?? ""} />
            <Bar dataKey="consult" name="Consult" radius={[4, 4, 0, 0]}>
              {chartRows.map((entry, i) => (
                <Cell key={i} fill={entry.dayIdx >= 0 ? DAY_COLORS[entry.dayIdx] : "#14b8a6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {group === "day" && <DayColorLegend />}
      </div>

      {/* ─── Chart: IPD Admit/DC ตามช่วงเวลา (แยกตาม Ward ได้) ─── */}
      <div className="chart-card">
        <div className="chart-header">
          <h3 className="chart-title">🛏️ IPD {ipdViewLabel} <span className="chart-range">{rangeText}</span></h3>
          <div className="chart-filter" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12 }}>Ward</span>
              <select value={ipdWard1} onChange={(e) => setIpdWard1(e.target.value)} style={{ fontSize: 12, padding: "2px 6px" }}>
                {wardList.map((w) => (
                  <option key={w} value={w === "ทั้งหมด" ? "" : w}>{w}</option>
                ))}
              </select>
            </label>
            <span style={{ fontSize: 12, marginRight: 4 }}>แสดง:</span>
            <button type="button" className={`chart-filter-btn${ipdShowAdmit ? " active" : ""}`} onClick={() => setIpdShowAdmit((v) => !v)}>Admit</button>
            <button type="button" className={`chart-filter-btn${ipdShowDc ? " active" : ""}`} onClick={() => setIpdShowDc((v) => !v)}>D/C</button>
            <button type="button" className={`chart-filter-btn${ipdShowAo ? " active" : ""}`} onClick={() => setIpdShowAo((v) => !v)}>A/O</button>
          </div>
        </div>
        {!useMock && ipdWard1 && ipdWard1 !== "ทั้งหมด" && effectiveIpdByWardRows.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: 12, fontSize: 13 }}>
            ยังไม่มีข้อมูลแยก Ward — กรุณา deploy Worker ล่าสุด (มี action ipdByWard) แล้วรีเฟรช
          </p>
        )}
        {ipdWard1 && ipdWard1 !== "ทั้งหมด" && !ipdWardChartHasData && effectiveIpdByWardRows.length > 0 && (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: 12, fontSize: 13 }}>
            ไม่มีข้อมูล {ipdViewLabel} สำหรับ Ward ที่เลือกในช่วงนี้ ลองเปลี่ยน Ward หรือช่วงวันที่
          </p>
        )}
        <ResponsiveContainer width="100%" height={chartH}>
          <BarChart data={ipdChartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, "auto"]} />
            <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? payload?.[0]?.payload?.key ?? ""} />
            {(!ipdWard1 || ipdWard1 === "ทั้งหมด") ? (
              <>
                {(ipdShowAdmit || ipdShowDc || ipdShowAo) && <Legend wrapperStyle={{ fontSize: 12 }} />}
                {ipdShowAdmit && <Bar dataKey="ipdAdmit" fill="#f59e0b" name="Admit" radius={[4, 4, 0, 0]} />}
                {ipdShowDc && <Bar dataKey="ipdDischarge" fill="#22c55e" name="D/C" radius={[4, 4, 0, 0]} />}
                {ipdShowAo && <Bar dataKey="ipdAo" fill="#8b5cf6" name="A/O (รวมทุก Ward)" radius={[4, 4, 0, 0]} />}
              </>
            ) : (
              <>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {ipdShowAdmit && <Bar dataKey={`${ipdWard1} (Admit)`} fill="#f59e0b" name={`${ipdWard1} (Admit)`} radius={[4, 4, 0, 0]} minPointSize={2} />}
                {ipdShowDc && <Bar dataKey={`${ipdWard1} (D/C)`} fill="#22c55e" name={`${ipdWard1} (D/C)`} radius={[4, 4, 0, 0]} minPointSize={2} />}
                {ipdShowAo && <Bar dataKey={`${ipdWard1} (A/O)`} fill="#8b5cf6" name={`${ipdWard1} (A/O)`} radius={[4, 4, 0, 0]} minPointSize={2} />}
              </>
            )}
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

      {/* ─── Chart: หัตถการเฉพาะ ตามช่วงเวลา ─── */}
      <div className="chart-card">
        <h3 className="chart-title">🩺 จำนวนหัตถการเฉพาะ ต่อช่วงเวลา <span className="chart-range">{rangeText}</span></h3>
        {procedureChartRows.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>ไม่มีข้อมูลหัตถการในช่วงนี้</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={procedureChartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? payload?.[0]?.payload?.key ?? ""} formatter={(v: number) => [`${v} ครั้ง`, "หัตถการ"]} />
              <Bar dataKey="total" name="หัตถการ (ครั้ง)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ─── Pie Chart: สัดส่วนหัตถการ (พับได้) ─── */}
      <div className="chart-card">
        <button
          type="button"
          onClick={() => setProcedurePieOpen((v) => !v)}
          style={{
            width: "100%",
            textAlign: "left",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <h3 className="chart-title">
            🩺 สัดส่วนหัตถการเฉพาะ แยกตามประเภท <span className="chart-range">{rangeText}</span>
            <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>
              {procedurePieOpen ? "▼ คลิกเพื่อซ่อน" : "▶ คลิกเพื่อแสดง"}
            </span>
          </h3>
        </button>
        {procedurePieOpen && (
          <>
            {procedurePieData.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>ไม่มีข้อมูลหัตถการในช่วงนี้</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={procedurePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, pct }) => `${name} ${pct}%`}
                    >
                      {procedurePieData.map((_, i) => (
                        <Cell key={i} fill={WARD_COLORS[i % WARD_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value} ครั้ง`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="ward-legend">
                  {procedurePieData.map((w, i) => (
                    <div key={w.name} className="ward-legend-item">
                      <span className="ward-legend-dot" style={{ background: WARD_COLORS[i % WARD_COLORS.length] }} />
                      <span className="ward-legend-name">{w.name}</span>
                      <span className="ward-legend-val">{w.value} ครั้ง ({w.pct}%)</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
