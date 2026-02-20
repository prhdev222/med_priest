export type GroupBy = "day" | "week" | "month" | "year";

export interface StatsRow {
  key: string;
  opd: number;
  consult: number;
  ipdAdmit: number;
  ipdDischarge: number;
}

export interface WardStat {
  ward: string;
  admit: number;
  discharge: number;
}

export interface StatsResponse {
  rows: StatsRow[];
  wardStats: WardStat[];
  avgLosDays: number;
}

export interface ActivityItem {
  id: string;
  date: string;
  title: string;
  detail: string;
  type: string;
  imageUrl?: string;
  imageCaption?: string;
  youtubeUrl?: string;
  externalUrl?: string;
}

export interface EncouragementItem {
  id: string;
  date: string;
  name: string;
  message: string;
}

export interface IpdOpenCase {
  hn: string;
  ward: string;
  admitDate: string;
}

interface ApiError {
  error?: string;
  message?: string;
}

/* ─── Client-side stale cache ─── */
const clientCache = new Map<string, { data: unknown; ts: number }>();
const CLIENT_TTL = 45_000;

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let res: Response;

  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      const stale = clientCache.get(url);
      if (stale) return stale.data as T;
      throw new Error("การเชื่อมต่อช้าเกินไป กรุณาลองใหม่");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const raw = await res.text();
  let data: T | ApiError | null = null;

  try {
    data = raw ? (JSON.parse(raw) as T | ApiError) : null;
  } catch {
    if (!res.ok) {
      throw new Error(raw || `HTTP ${res.status}`);
    }
    return {} as T;
  }

  if (!res.ok) {
    const msg = (data as ApiError)?.error || (data as ApiError)?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if ((data as ApiError)?.error) {
    throw new Error((data as ApiError).error || "Unknown error");
  }

  if (!options?.method || options.method === "GET") {
    clientCache.set(url, { data, ts: Date.now() });
  }

  return data as T;
}

function getClientCached<T>(url: string): T | null {
  const entry = clientCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.ts > CLIENT_TTL) return null;
  return entry.data as T;
}

export async function getStats(from: string, to: string, group: GroupBy): Promise<StatsResponse> {
  return fetchApi(`/api/sheets?action=stats&from=${from}&to=${to}&group=${group}`);
}

export function getStatsCached(from: string, to: string, group: GroupBy): StatsResponse | null {
  return getClientCached<StatsResponse>(`/api/sheets?action=stats&from=${from}&to=${to}&group=${group}`);
}

export async function addStatsRow(payload: {
  code: string;
  sheetName: "OPD" | "Consult";
  date: string;
  count: number;
}) {
  return fetchApi("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addStatsRow", ...payload }),
  });
}

export async function addIpdAdmit(payload: { code: string; hn: string; ward: string; admitDate: string }) {
  return fetchApi("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addIpdAdmit", ...payload }),
  });
}

export async function addIpdDischarge(payload: { code: string; hn: string; dischargeDate: string }) {
  return fetchApi("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addIpdDischarge", ...payload }),
  });
}

export async function getIpdOpenCases(code: string): Promise<{ rows: IpdOpenCase[] }> {
  return fetchApi(`/api/sheets?action=ipdOpenCases&code=${encodeURIComponent(code)}`);
}

export async function getActivities() {
  const raw = await fetchApi<unknown>("/api/sheets?action=activities");
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { rows?: unknown[] })?.rows) ? (raw as { rows: unknown[] }).rows : [];
  const rows: ActivityItem[] = arr.map((item, idx) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id ?? row.rowId ?? `activity-${idx}`),
      date: String(row.date ?? row.datetime ?? ""),
      title: String(row.title ?? row.name ?? "กิจกรรม"),
      detail: String(row.detail ?? row.description ?? ""),
      type: String(row.type ?? ""),
      imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
      imageCaption: row.imageCaption ? String(row.imageCaption) : undefined,
      youtubeUrl: row.youtubeUrl ? String(row.youtubeUrl) : undefined,
      externalUrl: row.externalUrl ? String(row.externalUrl) : undefined,
    };
  });
  return { rows };
}

export async function getActivitiesAdmin(code: string) {
  const raw = await fetchApi<unknown>(
    `/api/sheets?action=activitiesAdmin&code=${encodeURIComponent(code)}`,
  );
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { rows?: unknown[] })?.rows) ? (raw as { rows: unknown[] }).rows : [];
  const rows: ActivityItem[] = arr.map((item, idx) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id ?? row.rowId ?? `activity-admin-${idx}`),
      date: String(row.date ?? row.datetime ?? ""),
      title: String(row.title ?? row.name ?? "กิจกรรม"),
      detail: String(row.detail ?? row.description ?? ""),
      type: String(row.type ?? ""),
      imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
      imageCaption: row.imageCaption ? String(row.imageCaption) : undefined,
      youtubeUrl: row.youtubeUrl ? String(row.youtubeUrl) : undefined,
      externalUrl: row.externalUrl ? String(row.externalUrl) : undefined,
    };
  });
  return { rows };
}

export async function addActivity(payload: Record<string, unknown>) {
  return fetchApi("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addActivity", ...payload }),
  });
}

export async function getEncouragement() {
  const raw = await fetchApi<unknown>("/api/sheets?action=encouragement");
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { rows?: unknown[] })?.rows) ? (raw as { rows: unknown[] }).rows : [];
  const rows: EncouragementItem[] = arr.map((item, idx) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id ?? row.rowId ?? `enc-${idx}`),
      date: String(row.date ?? row.datetime ?? ""),
      name: String(row.name ?? row.author ?? "ไม่ระบุชื่อ"),
      message: String(row.message ?? ""),
    };
  });
  return { rows };
}

export async function getEncouragementAdmin(code: string) {
  const raw = await fetchApi<unknown>(
    `/api/sheets?action=encouragementAdmin&code=${encodeURIComponent(code)}`,
  );
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { rows?: unknown[] })?.rows) ? (raw as { rows: unknown[] }).rows : [];
  const rows: EncouragementItem[] = arr.map((item, idx) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id ?? row.rowId ?? `enc-admin-${idx}`),
      date: String(row.date ?? row.datetime ?? ""),
      name: String(row.name ?? row.author ?? "ไม่ระบุชื่อ"),
      message: String(row.message ?? ""),
    };
  });
  return { rows };
}

export async function postEncouragement(payload: { code: string; name: string; message: string }) {
  return fetchApi("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "addEncouragement",
      ...payload,
      // รองรับ backend เก่าบางตัวที่ใช้ชื่อฟิลด์ต่างกัน
      author: payload.name,
      unitCode: payload.code,
    }),
  });
}

export interface OpdAdminItem { id: number; date: string; count: number; }
export interface ConsultAdminItem { id: number; date: string; count: number; }
export interface IpdAdminItem { id: number; hn: string; ward: string; admitDate: string; dischargeDate: string; los: number; }
export interface IpdOpenItem { id: number; hn: string; ward: string; admitDate: string; }
export interface PatientDataAdmin { ipdOpen: IpdOpenItem[]; opd: OpdAdminItem[]; consult: ConsultAdminItem[]; ipd: IpdAdminItem[]; }
export interface TodayEntries { opd: OpdAdminItem[]; consult: ConsultAdminItem[]; ipd: IpdAdminItem[]; }

export async function getPatientDataAdmin(code: string, date?: string): Promise<PatientDataAdmin> {
  let url = `/api/sheets?action=patientDataAdmin&code=${encodeURIComponent(code)}`;
  if (date) url += `&date=${date}`;
  const raw = await fetchApi<PatientDataAdmin>(url);
  return {
    ipdOpen: Array.isArray(raw?.ipdOpen) ? raw.ipdOpen : [],
    opd: Array.isArray(raw?.opd) ? raw.opd : [],
    consult: Array.isArray(raw?.consult) ? raw.consult : [],
    ipd: Array.isArray(raw?.ipd) ? raw.ipd : [],
  };
}

export async function getTodayEntries(code: string, date: string): Promise<TodayEntries> {
  const raw = await fetchApi<TodayEntries>(
    `/api/sheets?action=todayEntries&code=${encodeURIComponent(code)}&date=${date}`,
  );
  return {
    opd: Array.isArray(raw?.opd) ? raw.opd : [],
    consult: Array.isArray(raw?.consult) ? raw.consult : [],
    ipd: Array.isArray(raw?.ipd) ? raw.ipd : [],
  };
}

export async function updateTodayRow(payload: Record<string, unknown>) {
  return fetchApi("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "updateTodayRow", ...payload }),
  });
}

export async function deleteTodayRow(payload: { code: string; sheetType: string; rowId: string | number }) {
  return fetchApi("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deleteTodayRow", ...payload }),
  });
}

export async function deleteRow(payload: { code: string; sheetType: string; rowId: string | number }) {
  return fetchApi("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deleteRow", ...payload }),
  });
}

export async function updateRow(payload: Record<string, unknown>) {
  return fetchApi("/api/sheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "updateRow", ...payload }),
  });
}
