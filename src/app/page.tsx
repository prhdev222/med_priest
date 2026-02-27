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

function startOfWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
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

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return d.toISOString().slice(0, 10);
}

function getISOWeekValue(d: Date): string {
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const mon1 = new Date(jan4);
  mon1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const diff = Math.floor((d.getTime() - mon1.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.floor(diff / 7) + 1;
  if (week < 1) return `${year - 1}-W${String(getISOWeekNum(new Date(year - 1, 11, 31))).padStart(2, "0")}`;
  if (week > 52) {
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

/* ═══ Mock Data ═══ */

function buildMockRows() {
  const rows: { key: string; opd: number; er: number; consult: number; ipdAdmit: number; ipdDischarge: number }[] = [];
  const start = new Date("2026-01-06");
  for (let i = 0; i < 21; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const day = d.getDay();
    const base = day === 0 || day === 6 ? 12 : 22;
    rows.push({ key, opd: base + (i % 8), er: 3 + (i % 4), consult: 2 + (i % 3), ipdAdmit: 4 + (i % 4), ipdDischarge: 3 + (i % 4) });
  }
  return rows;
}
const mockRows = buildMockRows();

const WARD_COLORS = ["#2563eb", "#f59e0b", "#14b8a6", "#e11d48", "#8b5cf6", "#f97316", "#22c55e", "#ec4899"];

const mockWardStats = [
  { ward: "MED1", admit: 18, discharge: 15 },
  { ward: "MED2", admit: 16, discharge: 14 },
  { ward: "IMC", admit: 10, discharge: 9 },
  { ward: "Palliative", admit: 6, discharge: 5 },
  { ward: "ward90", admit: 8, discharge: 7 },
  { ward: "ICU", admit: 4, discharge: 4 },
];

function buildMockIpdByWardRows(): IpdByWardRow[] {
  const wards = ["MED1", "MED2", "IMC"] as const;
  const out: IpdByWardRow[] = [];
  mockRows.forEach((row, i) => {
    wards.forEach((ward, w) => {
      out.push({ key: row.key, ward, admit: 1 + ((i + w) % 3), discharge: 1 + ((i + w + 1) % 3), ao: (i + w) % 2 });
    });
  });
  return out;
}
const mockIpdByWardRows: IpdByWardRow[] = buildMockIpdByWardRows();

const mockProcedureStats: ProcedureStatsResponse = {
  rows: mockRows.map((r) => ({ key: r.key, total: 4 + (r.opd % 6) })),
  byProcedure: [
    { procedureKey: "egd", procedureLabel: "EGD", count: 28 },
    { procedureKey: "colonoscopy", procedureLabel: "Colonoscopy", count: 18 },
    { procedureKey: "bone_marrow", procedureLabel: "Bone marrow aspiration & biopsy", count: 12 },
    { procedureKey: "pleural_tapping", procedureLabel: "Pleural tapping", count: 10 },
    { procedureKey: "lumbar_puncture", procedureLabel: "Lumbar puncture", count: 8 },
    { procedureKey: "echocardiogram", procedureLabel: "Echocardiogram", count: 6 },
    { procedureKey: "other", procedureLabel: "Bedside US", count: 5 },
  ],
};

function buildMockProcForWard(ward: string): ProcedureStatsResponse {
  const seed = ward.length;
  const rows = mockRows.map((r, i) => ({ key: r.key, total: 1 + ((i + seed) % 4) }));
  const byMap: Record<string, { procedureKey: string; procedureLabel: string; count: number }[]> = {
    OPD: [
      { procedureKey: "echocardiogram", procedureLabel: "Echocardiogram", count: 15 },
      { procedureKey: "ekg12", procedureLabel: "EKG12leads", count: 12 },
      { procedureKey: "pft", procedureLabel: "PFT", count: 8 },
      { procedureKey: "fibroscan", procedureLabel: "Fibroscan", count: 6 },
      { procedureKey: "inbody", procedureLabel: "Inbody", count: 5 },
    ],
    ER: [
      { procedureKey: "intubation", procedureLabel: "Intubation", count: 10 },
      { procedureKey: "c_line", procedureLabel: "C-line", count: 8 },
      { procedureKey: "pleural_tapping", procedureLabel: "Pleural tapping", count: 6 },
      { procedureKey: "blood_transfusion", procedureLabel: "Blood transfusion", count: 5 },
      { procedureKey: "lumbar_puncture", procedureLabel: "Lumbar puncture", count: 3 },
    ],
  };
  const defaultProcs = [
    { procedureKey: "blood_transfusion", procedureLabel: "Blood transfusion", count: 8 },
    { procedureKey: "wound_care", procedureLabel: "Wound/Bedsore care", count: 6 },
    { procedureKey: "chemotherapy", procedureLabel: "Chemotherapy", count: 4 },
    { procedureKey: "bedside_ultrasound", procedureLabel: "Bed-side Ultrasound", count: 3 },
  ];
  return { rows, byProcedure: byMap[ward] || defaultProcs };
}

const mockProcOpdStats = buildMockProcForWard("OPD");
const mockProcErStats = buildMockProcForWard("ER");

const MOCK_LOS_BY_WARD: Record<string, number> = {
  MED1: 4.5, MED2: 3.8, IMC: 6.2, Palliative: 12.1, ward90: 5.0, ICU: 7.5,
};

/* ═══ Day Color Legend ═══ */

const DAY_COLORS = ["#dc2626", "#eab308", "#ec4899", "#22c55e", "#f97316", "#3b82f6", "#8b5cf6"];
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

/* ═══ Helpers ═══ */

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

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const currentIsoWeek = getISOWeekValue(new Date());
const currentYearMonth = `${CURRENT_YEAR}-${String(CURRENT_MONTH).padStart(2, "0")}`;

/* ═════════════════════════════════════════════════════
   Dashboard Component
   ═════════════════════════════════════════════════════ */

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
  const [procOpdStats, setProcOpdStats] = useState<ProcedureStatsResponse>({ rows: [], byProcedure: [] });
  const [procErStats, setProcErStats] = useState<ProcedureStatsResponse>({ rows: [], byProcedure: [] });
  const [ipdWardProcStats, setIpdWardProcStats] = useState<ProcedureStatsResponse>({ rows: [], byProcedure: [] });
  const [procedurePieOpen, setProcedurePieOpen] = useState(false);
  const [ipdProcPieOpen, setIpdProcPieOpen] = useState(false);
  const [pieFullscreen, setPieFullscreen] = useState<"ward" | "procedure" | "opdProc" | "erProc" | "ipdProc" | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }, []);
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
      return { from: `${a[1]}-${a[2]}-01`, to: lastDayOfMonth(parseInt(b[1], 10), parseInt(b[2], 10)) };
    }
    if (group === "week") {
      const a = isoWeekValueToFromTo(filterWeekFrom);
      const b = isoWeekValueToFromTo(filterWeekTo);
      return { from: a.from < b.from ? a.from : b.from, to: a.to > b.to ? a.to : b.to };
    }
    return { from: filterDayFrom, to: filterDayTo };
  }, [group, filterDayFrom, filterDayTo, filterWeekFrom, filterWeekTo, filterMonthFrom, filterMonthTo, filterYear, filterYearEnd]);

  const safeParse = (res: StatsResponse): StatsResponse => ({
    rows: Array.isArray(res?.rows) ? res.rows : [],
    wardStats: Array.isArray(res?.wardStats) ? res.wardStats : [],
    avgLosDays: Number(res?.avgLosDays || 0),
  });

  const fromReqRef = useMemo(() => group === "day" ? startOfWeekMonday(from) : from, [from, group]);

  /* ── Core fetch: only stats + ipdByWard (2 calls instead of 5) ── */
  const fetchData = useCallback(() => {
    if (useMock) return () => {};
    setLoading(true);
    setError("");

    const staleStats = getStatsCached(fromReqRef, to, group);
    if (staleStats) setData(safeParse(staleStats));
    const staleIpd = getIpdByWardCached(fromReqRef, to, group);
    if (staleIpd) setIpdByWardData(staleIpd);

    let mounted = true;
    Promise.all([
      getStats(fromReqRef, to, group),
      getIpdByWard(fromReqRef, to, group),
    ])
      .then(([statsRes, ipdRes]) => {
        if (!mounted) return;
        setData(safeParse(statsRes));
        setIpdByWardData({ rows: Array.isArray(ipdRes?.rows) ? ipdRes.rows : [] });
      })
      .catch((e) => mounted && setError((e as Error).message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [fromReqRef, to, group, useMock]);

  useEffect(() => { const cleanup = fetchData(); return cleanup; }, [fetchData]);

  /* ── Lazy fetch: load procedure data only when accordion sections are opened ── */
  const procFetchedRef = useMemo(() => ({ opd: "", er: "", proc: "" }), []);

  useEffect(() => {
    if (useMock) return;
    const cacheKey = `${fromReqRef}|${to}|${group}`;

    if (openSections.has("opd") && procFetchedRef.opd !== cacheKey) {
      procFetchedRef.opd = cacheKey;
      getProcedureStats(fromReqRef, to, group, "OPD")
        .then((r) => setProcOpdStats({ rows: r?.rows ?? [], byProcedure: r?.byProcedure ?? [] }))
        .catch(() => {});
    }
    if (openSections.has("er") && procFetchedRef.er !== cacheKey) {
      procFetchedRef.er = cacheKey;
      getProcedureStats(fromReqRef, to, group, "ER")
        .then((r) => setProcErStats({ rows: r?.rows ?? [], byProcedure: r?.byProcedure ?? [] }))
        .catch(() => {});
    }
    if (openSections.has("proc") && procFetchedRef.proc !== cacheKey) {
      procFetchedRef.proc = cacheKey;
      getProcedureStats(fromReqRef, to, group)
        .then((r) => setProcedureStats({ rows: r?.rows ?? [], byProcedure: r?.byProcedure ?? [] }))
        .catch(() => {});
    }
  }, [openSections, fromReqRef, to, group, useMock, procFetchedRef]);

  useEffect(() => {
    if (useMock || !ipdWard1 || ipdWard1 === "ทั้งหมด") {
      setIpdWardProcStats({ rows: [], byProcedure: [] });
      return;
    }
    getProcedureStats(fromReqRef, to, group, ipdWard1)
      .then((res) => setIpdWardProcStats({ rows: res?.rows ?? [], byProcedure: res?.byProcedure ?? [] }))
      .catch(() => setIpdWardProcStats({ rows: [], byProcedure: [] }));
  }, [ipdWard1, fromReqRef, to, group, useMock]);

  useEffect(() => {
    if (!pieFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPieFullscreen(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pieFullscreen]);

  /* ─── Derived data ─── */

  const safeRows = Array.isArray(data?.rows) ? data.rows : [];
  const safeWardStats = Array.isArray(data?.wardStats) ? data.wardStats : [];
  const viewRows = useMock ? mockRows : safeRows;
  const viewWardStats = useMock ? mockWardStats : safeWardStats;
  const viewLos = useMock ? 4.2 : Number(data.avgLosDays || 0);

  const aoByKey = useMemo(() => {
    const rows = useMock ? mockIpdByWardRows : ipdByWardData.rows;
    const m: Record<string, number> = {};
    for (const r of rows) m[String(r.key)] = (m[String(r.key)] ?? 0) + Number((r as { ao?: number }).ao ?? 0);
    return m;
  }, [useMock, ipdByWardData.rows]);

  const chartRows = useMemo(() => viewRows.map((r) => ({
    ...r, opd: r.opd ?? 0, er: r.er ?? 0, consult: r.consult ?? 0,
    ipdAdmit: r.ipdAdmit ?? 0, ipdDischarge: r.ipdDischarge ?? 0,
    ipdAo: aoByKey[r.key] ?? 0, label: shortLabel(r.key, group),
    dayIdx: group === "day" && r.key.length >= 10 ? getDayOfWeek(r.key) : -1,
  })), [viewRows, group, aoByKey]);

  const wardList = useMemo(() => {
    const fromStats = (viewWardStats as { ward?: string }[]).map((w) => w.ward as string).filter(Boolean);
    const fromIpdByWard = ipdByWardData.rows.map((r) => r.ward).filter(Boolean);
    return ["ทั้งหมด", ...Array.from(new Set([...fromStats, ...fromIpdByWard])).sort()];
  }, [viewWardStats, ipdByWardData.rows]);

  const effectiveIpdByWardRows = useMemo(() => {
    const src = useMock ? mockIpdByWardRows : ipdByWardData.rows;
    return src.map((x) => ({ key: String(x.key), ward: String(x.ward), admit: Number(x.admit ?? 0), discharge: Number(x.discharge ?? 0), ao: Number((x as { ao?: number }).ao ?? 0) }));
  }, [useMock, ipdByWardData.rows]);

  const getWardVal = useCallback(
    (key: string, ward: string, type: "admit" | "discharge" | "ao") => {
      const r = effectiveIpdByWardRows.find((x) => x.key === key && x.ward === ward);
      if (!r) return 0;
      return type === "admit" ? r.admit : type === "discharge" ? r.discharge : r.ao ?? 0;
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
    return viewWardStats.filter((w) => (w.admit as number) > 0).map((w) => ({
      name: w.ward as string, value: w.admit as number,
      pct: Math.round(((w.admit as number) / totalAdmit) * 100),
    }));
  }, [viewWardStats]);

  const viewProcedureStats = useMock ? mockProcedureStats : procedureStats;
  const viewProcOpdStats = useMock ? mockProcOpdStats : procOpdStats;
  const viewProcErStats = useMock ? mockProcErStats : procErStats;
  const viewIpdWardProcStats = useMemo(() => {
    if (useMock && ipdWard1 && ipdWard1 !== "ทั้งหมด") return buildMockProcForWard(ipdWard1);
    return ipdWardProcStats;
  }, [useMock, ipdWard1, ipdWardProcStats]);

  const viewIpdWardLos = useMemo(() => {
    if (useMock && ipdWard1 && ipdWard1 !== "ทั้งหมด") return MOCK_LOS_BY_WARD[ipdWard1] ?? 0;
    return viewLos;
  }, [useMock, ipdWard1, viewLos]);

  const procOpdPie = useMemo(() => procPieData(viewProcOpdStats.byProcedure), [viewProcOpdStats]);
  const procErPie = useMemo(() => procPieData(viewProcErStats.byProcedure), [viewProcErStats]);
  const procedurePieData = useMemo(() => procPieData(viewProcedureStats.byProcedure), [viewProcedureStats]);
  const ipdWardProcPie = useMemo(() => procPieData(viewIpdWardProcStats.byProcedure), [viewIpdWardProcStats]);

  const procedureChartRows = useMemo(() => viewProcedureStats.rows.map((r) => ({ ...r, label: shortLabel(r.key, group) })), [viewProcedureStats.rows, group]);
  const procOpdChartRows = useMemo(() => viewProcOpdStats.rows.map((r) => ({ ...r, label: shortLabel(r.key, group) })), [viewProcOpdStats.rows, group]);
  const procErChartRows = useMemo(() => viewProcErStats.rows.map((r) => ({ ...r, label: shortLabel(r.key, group) })), [viewProcErStats.rows, group]);
  const ipdWardProcChartRows = useMemo(() => viewIpdWardProcStats.rows.map((r) => ({ ...r, label: shortLabel(r.key, group) })), [viewIpdWardProcStats.rows, group]);

  const totals = useMemo(() => {
    return viewRows.reduce((acc, row) => {
      acc.opd += row.opd ?? 0; acc.er += row.er ?? 0; acc.consult += row.consult ?? 0;
      acc.ipdAdmit += row.ipdAdmit ?? 0; acc.ipdDischarge += row.ipdDischarge ?? 0;
      return acc;
    }, { opd: 0, er: 0, consult: 0, ipdAdmit: 0, ipdDischarge: 0 });
  }, [viewRows]);

  const totalProcOpd = viewProcOpdStats.rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const totalProcEr = viewProcErStats.rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const totalProcAll = viewProcedureStats.rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const totalProcWard = viewIpdWardProcStats.rows.reduce((s, r) => s + (r.total ?? 0), 0);

  const chartH = 260;
  const chartScrollWidth = Math.max(800, chartRows.length * 48);
  const rangeText = `${from} ถึง ${to}`;

  const hasNoData = !useMock && !loading &&
    (chartRows.length === 0 || (totals.opd === 0 && totals.er === 0 && totals.consult === 0 && totals.ipdAdmit === 0 && totals.ipdDischarge === 0));

  /* ─── Export ─── */

  function exportCsv() {
    const bom = "\uFEFF";
    const noteRow = hasNoData ? "หมายเหตุ: ไม่มีข้อมูลในช่วงวันที่เลือก\n" : "";
    const header = "วันที่,OPD,ER,Consult,IPD Admit,IPD D/C\n";
    const rows = chartRows.map((r) => `${r.key},${r.opd},${r.er},${r.consult},${r.ipdAdmit},${r.ipdDischarge}`).join("\n");
    const totalAo = chartRows.reduce((s, r) => s + (r.ipdAo ?? 0), 0);
    const summary = `\n\nสรุป ${from} ถึง ${to}\nOPD รวม,${totals.opd}\nER รวม,${totals.er}\nConsult รวม,${totals.consult}\nIPD Admit รวม,${totals.ipdAdmit}\nIPD D/C รวม,${totals.ipdDischarge}\nIPD A/O รวม,${totalAo}\nAvg LOS,${viewLos.toFixed(1)} วัน\nหัตถการ OPD,${totalProcOpd}\nหัตถการ ER,${totalProcEr}\nหัตถการ รวม,${totalProcAll}`;
    const blob = new Blob([bom + noteRow + header + rows + summary], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `MedPriest_Dashboard_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  /* ─── Reusable bar chart renderer ─── */
  function renderBarChart(rows: { key: string; total: number; label: string }[], color: string, name: string) {
    const sw = Math.max(800, rows.length * 48);
    return (
      <div className="chart-scroll-wrap" style={{ overflowX: "auto" }}>
        <div style={{ minWidth: sw }}>
          <ResponsiveContainer width="100%" height={chartH}>
            <BarChart data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} formatter={(v: number) => [`${v} ครั้ง`, name]} />
              <Bar dataKey="total" name={name} fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  function renderProcPie(data: { name: string; value: number; pct: number }[], fsKey: "opdProc" | "erProc" | "ipdProc" | "procedure") {
    if (data.length === 0) return <p style={{ textAlign: "center", color: "var(--muted)", padding: 12 }}>ไม่มีข้อมูลหัตถการในช่วงนี้</p>;
    return (
      <div role="button" tabIndex={0} className="pie-click-expand"
        onClick={() => setPieFullscreen(fsKey)} onKeyDown={(e) => e.key === "Enter" && setPieFullscreen(fsKey)} title="คลิกเพื่อขยายเต็มจอ">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name"
              label={({ name, pct }) => `${name} ${pct}%`}>
              {data.map((_, i) => <Cell key={i} fill={WARD_COLORS[i % WARD_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value: number, name: string) => [`${value} ครั้ง`, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="ward-legend">
          {data.map((w, i) => (
            <div key={w.name} className="ward-legend-item">
              <span className="ward-legend-dot" style={{ background: WARD_COLORS[i % WARD_COLORS.length] }} />
              <span className="ward-legend-name">{w.name}</span>
              <span className="ward-legend-val">{w.value} ครั้ง ({w.pct}%)</span>
            </div>
          ))}
        </div>
        <p className="pie-expand-hint">🖱️ คลิกเพื่อขยายเต็มจอ</p>
      </div>
    );
  }

  function renderFullscreenPie(data: { name: string; value: number; pct: number }[], unit = "ครั้ง") {
    if (data.length === 0) return null;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={80} outerRadius={160} paddingAngle={3} dataKey="value" nameKey="name"
            label={({ name, pct }) => `${name} ${pct}%`}>
            {data.map((_, i) => <Cell key={i} fill={WARD_COLORS[i % WARD_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [`${value} ${unit}`, name]} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const fullscreenTitle: Record<string, string> = {
    ward: "🏥 สัดส่วนผู้ป่วย IPD แยกตาม Ward",
    procedure: "🩺 สัดส่วนหัตถการทั้งหมด",
    opdProc: "🏥 สัดส่วนหัตถการ OPD",
    erProc: "🚑 สัดส่วนหัตถการ ER",
    ipdProc: `🛏️ สัดส่วนหัตถการ ${ipdWard1 || "IPD"}`,
  };

  const fullscreenPieDataMap: Record<string, { name: string; value: number; pct: number }[]> = {
    ward: wardPieData,
    procedure: procedurePieData,
    opdProc: procOpdPie,
    erProc: procErPie,
    ipdProc: ipdWardProcPie,
  };

  /* ═══ Render ═══ */

  return (
    <section>
      <LoadingOverlay show={loading && safeRows.length === 0} text="กำลังโหลดข้อมูล Dashboard..." />

      <div className="page-header" data-range={rangeText}>
        <h1>📊 Dashboard อายุรกรรม รพ.สงฆ์</h1>
        <p>สรุปจำนวนผู้ป่วย OPD / ER / Consult / IPD • หัตถการแยกตาม Ward</p>
        <p className="print-range">ข้อมูล: {rangeText}</p>
      </div>

      {/* ─── Controls ─── */}
      <div className="control-row">
        <label>แสดงกราฟแบบ
          <select value={group} onChange={(e) => setGroup(e.target.value as GroupBy)}>
            <option value="day">แยกเป็นวัน</option><option value="week">รวมเป็นสัปดาห์</option>
            <option value="month">รวมเป็นเดือน</option><option value="year">รวมเป็นปี</option>
          </select>
        </label>
        {group === "day" && (<>
          <label>ตั้งแต่วันที่ <input type="date" value={filterDayFrom} onChange={(e) => setFilterDayFrom(e.target.value)} /></label>
          <label>ถึงวันที่ <input type="date" value={filterDayTo} onChange={(e) => setFilterDayTo(e.target.value)} /></label>
        </>)}
        {group === "week" && (<>
          <label>ตั้งแต่สัปดาห์ <input type="week" value={filterWeekFrom} onChange={(e) => setFilterWeekFrom(e.target.value)} /></label>
          <label>ถึงสัปดาห์ <input type="week" value={filterWeekTo} onChange={(e) => setFilterWeekTo(e.target.value)} /></label>
        </>)}
        {group === "month" && (<>
          <label>ตั้งแต่เดือน <input type="month" value={filterMonthFrom} onChange={(e) => setFilterMonthFrom(e.target.value)} /></label>
          <label>ถึงเดือน <input type="month" value={filterMonthTo} onChange={(e) => setFilterMonthTo(e.target.value)} /></label>
        </>)}
        {group === "year" && (<>
          <label>ตั้งแต่ปี <input type="number" min={2020} max={2032} value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value) || CURRENT_YEAR)} style={{ width: 72 }} /></label>
          <label>ถึงปี <input type="number" min={2020} max={2032} value={filterYearEnd} onChange={(e) => setFilterYearEnd(Number(e.target.value) || CURRENT_YEAR)} style={{ width: 72 }} /></label>
        </>)}
        <label>โหมด
          <select value={useMock ? "mock" : "real"} onChange={(e) => setUseMock(e.target.value === "mock")}>
            <option value="real">ข้อมูลจริง</option><option value="mock">ตัวอย่าง</option>
          </select>
        </label>
        {loading && <span style={{ color: "var(--muted)", fontSize: 13, alignSelf: "center" }}>⏳ กำลังโหลด...</span>}
        <div className="export-buttons">
          <button className="btn-export" onClick={() => window.print()} title="พิมพ์">🖨️ Print</button>
          <button className="btn-export btn-export-csv" onClick={exportCsv} title="CSV">📥 Excel/CSV</button>
        </div>
      </div>

      {error && (
        <div className="entry-msg error" style={{ maxWidth: "none" }}>
          เกิดข้อผิดพลาด: {error} <button onClick={fetchData} style={{ marginLeft: 8, padding: "4px 14px", fontSize: "0.85rem" }}>ลองใหม่</button>
        </div>
      )}
      {hasNoData && (
        <div className="entry-msg" style={{ maxWidth: "none", background: "#fef3c7", color: "#92400e" }}>
          ไม่มีข้อมูลในช่วงวันที่เลือก — <a href="/data-entry" style={{ fontWeight: "bold", textDecoration: "underline" }}>กรอกข้อมูลจากหน้า Data Entry</a>
        </div>
      )}

      <div className="date-range-badge">📅 ช่วงข้อมูล: <strong>{from}</strong> ถึง <strong>{to}</strong></div>

      {/* ─── Stat cards ─── */}
      <div className="stat-grid">
        <div className="stat-card blue"><div className="stat-card-icon">🏥</div><div className="stat-card-label">OPD</div><div className="stat-card-value">{totals.opd.toLocaleString()}</div></div>
        <div className="stat-card orange"><div className="stat-card-icon">🚑</div><div className="stat-card-label">ER ผู้ป่วยนอก</div><div className="stat-card-value">{totals.er.toLocaleString()}</div></div>
        <div className="stat-card teal"><div className="stat-card-icon">📞</div><div className="stat-card-label">Consult</div><div className="stat-card-value">{totals.consult.toLocaleString()}</div></div>
        <div className="stat-card amber"><div className="stat-card-icon">🛏️</div><div className="stat-card-label">IPD Admit</div><div className="stat-card-value">{totals.ipdAdmit.toLocaleString()}</div></div>
        <div className="stat-card green"><div className="stat-card-icon">✅</div><div className="stat-card-label">IPD D/C</div><div className="stat-card-value">{totals.ipdDischarge.toLocaleString()}</div></div>
        <div className="stat-card purple"><div className="stat-card-icon">📅</div><div className="stat-card-label">Avg LOS</div><div className="stat-card-value">{viewLos.toFixed(1)} <span style={{ fontSize: "0.7em", fontWeight: 500 }}>วัน</span></div></div>
      </div>

      {/* ═══ Accordion Sections ═══ */}

      {/* ─── OPD ─── */}
      <button type="button" className={`dash-acc-header${openSections.has("opd") ? " open" : ""}`} onClick={() => toggleSection("opd")} style={{ "--acc-color": "#2563eb" } as React.CSSProperties}>
        <span className="dash-acc-icon">🏥</span>
        <span className="dash-acc-title">OPD ผู้ป่วยนอก</span>
        <span className="dash-acc-badge" style={{ background: "#2563eb" }}>{totals.opd.toLocaleString()} ราย</span>
        {totalProcOpd > 0 && <span className="dash-acc-badge" style={{ background: "#7c3aed" }}>{totalProcOpd} หัตถการ</span>}
        <span className={`dash-acc-chevron${openSections.has("opd") ? " open" : ""}`}>&#9654;</span>
      </button>
      {openSections.has("opd") && (
        <div className="dash-acc-body">
          <div className="chart-card">
            <h3 className="chart-title">จำนวน OPD <span className="chart-range">{rangeText}</span></h3>
            <div className="chart-scroll-wrap" style={{ overflowX: "auto" }}>
              <div style={{ minWidth: chartScrollWidth }}>
                <ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={chartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} />
                    <Bar dataKey="opd" name="OPD" radius={[4, 4, 0, 0]}>
                      {chartRows.map((entry, i) => <Cell key={i} fill={entry.dayIdx >= 0 ? DAY_COLORS[entry.dayIdx] : "#2563eb"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {group === "day" && <DayColorLegend />}
          </div>
          {procOpdChartRows.length > 0 && (
            <div className="chart-card">
              <h3 className="chart-title">หัตถการ OPD ({totalProcOpd} ครั้ง) <span className="chart-range">{rangeText}</span></h3>
              {renderBarChart(procOpdChartRows, "#2563eb", "หัตถการ OPD")}
            </div>
          )}
          {procOpdPie.length > 0 && (
            <div className="chart-card">
              <h3 className="chart-title">สัดส่วนหัตถการ OPD <span className="chart-range">{rangeText}</span></h3>
              {renderProcPie(procOpdPie, "opdProc")}
            </div>
          )}
        </div>
      )}

      {/* ─── ER ─── */}
      <button type="button" className={`dash-acc-header${openSections.has("er") ? " open" : ""}`} onClick={() => toggleSection("er")} style={{ "--acc-color": "#f97316" } as React.CSSProperties}>
        <span className="dash-acc-icon">🚑</span>
        <span className="dash-acc-title">ER ผู้ป่วยนอก</span>
        <span className="dash-acc-badge" style={{ background: "#f97316" }}>{totals.er.toLocaleString()} ราย</span>
        {totalProcEr > 0 && <span className="dash-acc-badge" style={{ background: "#7c3aed" }}>{totalProcEr} หัตถการ</span>}
        <span className={`dash-acc-chevron${openSections.has("er") ? " open" : ""}`}>&#9654;</span>
      </button>
      {openSections.has("er") && (
        <div className="dash-acc-body">
          <div className="chart-card">
            <h3 className="chart-title">จำนวน ER <span className="chart-range">{rangeText}</span></h3>
            <div className="chart-scroll-wrap" style={{ overflowX: "auto" }}>
              <div style={{ minWidth: chartScrollWidth }}>
                <ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={chartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} />
                    <Bar dataKey="er" name="ER" radius={[4, 4, 0, 0]}>
                      {chartRows.map((entry, i) => <Cell key={i} fill={entry.dayIdx >= 0 ? DAY_COLORS[entry.dayIdx] : "#f97316"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {group === "day" && <DayColorLegend />}
          </div>
          {procErChartRows.length > 0 && (
            <div className="chart-card">
              <h3 className="chart-title">หัตถการ ER ({totalProcEr} ครั้ง) <span className="chart-range">{rangeText}</span></h3>
              {renderBarChart(procErChartRows, "#f97316", "หัตถการ ER")}
            </div>
          )}
          {procErPie.length > 0 && (
            <div className="chart-card">
              <h3 className="chart-title">สัดส่วนหัตถการ ER <span className="chart-range">{rangeText}</span></h3>
              {renderProcPie(procErPie, "erProc")}
            </div>
          )}
        </div>
      )}

      {/* ─── Consult ─── */}
      <button type="button" className={`dash-acc-header${openSections.has("consult") ? " open" : ""}`} onClick={() => toggleSection("consult")} style={{ "--acc-color": "#0d9488" } as React.CSSProperties}>
        <span className="dash-acc-icon">📞</span>
        <span className="dash-acc-title">Consult นอกแผนก</span>
        <span className="dash-acc-badge" style={{ background: "#0d9488" }}>{totals.consult.toLocaleString()} ราย</span>
        <span className={`dash-acc-chevron${openSections.has("consult") ? " open" : ""}`}>&#9654;</span>
      </button>
      {openSections.has("consult") && (
        <div className="dash-acc-body">
          <div className="chart-card">
            <h3 className="chart-title">จำนวน Consult <span className="chart-range">{rangeText}</span></h3>
            <div className="chart-scroll-wrap" style={{ overflowX: "auto" }}>
              <div style={{ minWidth: chartScrollWidth }}>
                <ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={chartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} />
                    <Bar dataKey="consult" name="Consult" radius={[4, 4, 0, 0]}>
                      {chartRows.map((entry, i) => <Cell key={i} fill={entry.dayIdx >= 0 ? DAY_COLORS[entry.dayIdx] : "#14b8a6"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {group === "day" && <DayColorLegend />}
          </div>
        </div>
      )}

      {/* ─── IPD ─── */}
      <button type="button" className={`dash-acc-header${openSections.has("ipd") ? " open" : ""}`} onClick={() => toggleSection("ipd")} style={{ "--acc-color": "#d97706" } as React.CSSProperties}>
        <span className="dash-acc-icon">🛏️</span>
        <span className="dash-acc-title">IPD ผู้ป่วยใน</span>
        <span className="dash-acc-badge" style={{ background: "#d97706" }}>Admit {totals.ipdAdmit}</span>
        <span className="dash-acc-badge" style={{ background: "#16a34a" }}>D/C {totals.ipdDischarge}</span>
        <span className="dash-acc-badge" style={{ background: "#7c3aed" }}>LOS {viewLos.toFixed(1)} วัน</span>
        <span className={`dash-acc-chevron${openSections.has("ipd") ? " open" : ""}`}>&#9654;</span>
      </button>
      {openSections.has("ipd") && (
        <div className="dash-acc-body">
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">IPD {ipdViewLabel} <span className="chart-range">{rangeText}</span></h3>
              <div className="chart-filter" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Ward</span>
                  <select value={ipdWard1} onChange={(e) => setIpdWard1(e.target.value)} style={{ fontSize: 12, padding: "2px 6px" }}>
                    {wardList.map((w) => <option key={w} value={w === "ทั้งหมด" ? "" : w}>{w}</option>)}
                  </select>
                </label>
                <span style={{ fontSize: 12, marginRight: 4 }}>แสดง:</span>
                <button type="button" className={`chart-filter-btn${ipdShowAdmit ? " active" : ""}`} onClick={() => setIpdShowAdmit((v) => !v)}>Admit</button>
                <button type="button" className={`chart-filter-btn${ipdShowDc ? " active" : ""}`} onClick={() => setIpdShowDc((v) => !v)}>D/C</button>
                <button type="button" className={`chart-filter-btn${ipdShowAo ? " active" : ""}`} onClick={() => setIpdShowAo((v) => !v)}>A/O</button>
              </div>
            </div>
            <div className="chart-scroll-wrap" style={{ overflowX: "auto" }}>
              <div style={{ minWidth: chartScrollWidth }}>
                <ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={ipdChartRows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, "auto"]} />
                    <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.label ?? ""} />
                    {(!ipdWard1 || ipdWard1 === "ทั้งหมด") ? (<>
                      {(ipdShowAdmit || ipdShowDc || ipdShowAo) && <Legend wrapperStyle={{ fontSize: 12 }} />}
                      {ipdShowAdmit && <Bar dataKey="ipdAdmit" fill="#f59e0b" name="Admit" radius={[4, 4, 0, 0]} />}
                      {ipdShowDc && <Bar dataKey="ipdDischarge" fill="#22c55e" name="D/C" radius={[4, 4, 0, 0]} />}
                      {ipdShowAo && <Bar dataKey="ipdAo" fill="#8b5cf6" name="A/O" radius={[4, 4, 0, 0]} />}
                    </>) : (<>
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {ipdShowAdmit && <Bar dataKey={`${ipdWard1} (Admit)`} fill="#f59e0b" name={`${ipdWard1} (Admit)`} radius={[4, 4, 0, 0]} minPointSize={2} />}
                      {ipdShowDc && <Bar dataKey={`${ipdWard1} (D/C)`} fill="#22c55e" name={`${ipdWard1} (D/C)`} radius={[4, 4, 0, 0]} minPointSize={2} />}
                      {ipdShowAo && <Bar dataKey={`${ipdWard1} (A/O)`} fill="#8b5cf6" name={`${ipdWard1} (A/O)`} radius={[4, 4, 0, 0]} minPointSize={2} />}
                    </>)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="chart-card">
            <h3 className="chart-title">สัดส่วน IPD แยกตาม Ward <span className="chart-range">{rangeText}</span></h3>
            {wardPieData.length === 0
              ? <p style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>ไม่มีข้อมูล IPD</p>
              : (
                <div role="button" tabIndex={0} className="pie-click-expand"
                  onClick={() => setPieFullscreen("ward")} onKeyDown={(e) => e.key === "Enter" && setPieFullscreen("ward")} title="คลิกเพื่อขยายเต็มจอ">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={wardPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={3} dataKey="value" nameKey="name"
                        label={({ name, pct }) => `${name} ${pct}%`}>
                        {wardPieData.map((_, i) => <Cell key={i} fill={WARD_COLORS[i % WARD_COLORS.length]} />)}
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
                  <p className="pie-expand-hint">คลิกเพื่อขยายเต็มจอ</p>
                </div>
              )}
          </div>

          {ipdWard1 && ipdWard1 !== "ทั้งหมด" && (
            <div className="chart-card ipd-ward-detail">
              <h3 className="chart-title">รายละเอียด Ward: <strong style={{ color: "var(--primary)" }}>{ipdWard1}</strong></h3>
              <div className="ipd-ward-stats-row">
                <div className="ipd-ward-stat-card"><div className="ipd-ward-stat-label">Avg LOS</div><div className="ipd-ward-stat-value" style={{ color: "#7c3aed" }}>{viewIpdWardLos.toFixed(1)} <span style={{ fontSize: "0.6em" }}>วัน</span></div></div>
                <div className="ipd-ward-stat-card"><div className="ipd-ward-stat-label">หัตถการ รวม</div><div className="ipd-ward-stat-value" style={{ color: "#2563eb" }}>{totalProcWard} <span style={{ fontSize: "0.6em" }}>ครั้ง</span></div></div>
              </div>
              {ipdWardProcChartRows.length > 0 && (<>
                <h4 style={{ margin: "16px 0 8px", fontSize: "0.95rem", fontWeight: 600 }}>หัตถการ {ipdWard1} ต่อช่วง</h4>
                {renderBarChart(ipdWardProcChartRows, "#8b5cf6", `หัตถการ ${ipdWard1}`)}
              </>)}
              <button type="button" className="section-toggle-btn" onClick={() => setIpdProcPieOpen((v) => !v)}>
                {ipdProcPieOpen ? `▼ ซ่อนสัดส่วน` : `▶ ดูสัดส่วนหัตถการ ${ipdWard1}`}
              </button>
              {ipdProcPieOpen && renderProcPie(ipdWardProcPie, "ipdProc")}
            </div>
          )}
        </div>
      )}

      {/* ─── หัตถการรวม ─── */}
      <button type="button" className={`dash-acc-header${openSections.has("proc") ? " open" : ""}`} onClick={() => toggleSection("proc")} style={{ "--acc-color": "#7c3aed" } as React.CSSProperties}>
        <span className="dash-acc-icon">🩺</span>
        <span className="dash-acc-title">หัตถการเฉพาะ (รวมทั้งหมด)</span>
        <span className="dash-acc-badge" style={{ background: "#7c3aed" }}>{totalProcAll} ครั้ง</span>
        <span className={`dash-acc-chevron${openSections.has("proc") ? " open" : ""}`}>&#9654;</span>
      </button>
      {openSections.has("proc") && (
        <div className="dash-acc-body">
          <div className="chart-card">
            <h3 className="chart-title">จำนวนหัตถการทั้งหมด ({totalProcAll} ครั้ง) <span className="chart-range">{rangeText}</span></h3>
            {procedureChartRows.length === 0
              ? <p style={{ textAlign: "center", color: "var(--muted)", padding: 20 }}>ไม่มีข้อมูลหัตถการ</p>
              : renderBarChart(procedureChartRows, "#7c3aed", "หัตถการ (ครั้ง)")}
            <button type="button" className="section-toggle-btn" style={{ marginBottom: procedurePieOpen ? 10 : 0 }}
              onClick={() => setProcedurePieOpen((v) => !v)}>
              {procedurePieOpen ? "▼ ซ่อนสัดส่วน" : "▶ ดูสัดส่วนหัตถการทั้งหมด"}
            </button>
            {procedurePieOpen && renderProcPie(procedurePieData, "procedure")}
          </div>
        </div>
      )}

      {/* ─── Fullscreen Pie Overlay ─── */}
      {pieFullscreen && (
        <div className="pie-fullscreen-overlay" onClick={(e) => e.target === e.currentTarget && setPieFullscreen(null)} role="dialog" aria-label="กราฟวงกลมขยายเต็มจอ">
          <div className="pie-fullscreen-content">
            <button type="button" className="pie-fullscreen-close" onClick={() => setPieFullscreen(null)} aria-label="ปิด">✕</button>
            <h3 className="pie-fullscreen-title">{fullscreenTitle[pieFullscreen] || ""}</h3>
            <div className="pie-fullscreen-chart">
              {pieFullscreen === "ward" && renderFullscreenPie(wardPieData, "ราย")}
              {pieFullscreen === "procedure" && renderFullscreenPie(procedurePieData)}
              {pieFullscreen === "opdProc" && renderFullscreenPie(procOpdPie)}
              {pieFullscreen === "erProc" && renderFullscreenPie(procErPie)}
              {pieFullscreen === "ipdProc" && renderFullscreenPie(ipdWardProcPie)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
