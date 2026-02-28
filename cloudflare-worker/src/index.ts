interface Env {
  DB: D1Database;
  UNIT_CODE: string;
  ADMIN_CODE: string;
}

type Body = Record<string, unknown>;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function checkUnit(env: Env, code: string) {
  if (!code || code !== env.UNIT_CODE) throw new Error("unit code ไม่ถูกต้อง");
}

function checkAdmin(env: Env, code: string) {
  if (!code || code !== env.ADMIN_CODE) throw new Error("admin code ไม่ถูกต้อง");
}

function first(...args: unknown[]): string {
  for (const a of args) {
    const s = String(a ?? "").trim();
    if (s) return s;
  }
  return "";
}

function periodExpr(group: string, col: string): string {
  switch (group) {
    case "month":
      return `substr(${col}, 1, 7)`;
    case "year":
      return `substr(${col}, 1, 4)`;
    case "week":
      return `strftime('%Y', ${col}) || '-W' || printf('%02d', (cast(strftime('%j', ${col}) as integer) + 6) / 7)`;
    default:
      return col;
  }
}

// ─── GET handlers ────────────────────────────────────────

async function getStats(db: D1Database, params: URLSearchParams) {
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const group = params.get("group") || "day";
  if (!from || !to) throw new Error("from/to ไม่ถูกต้อง");

  const pk = (col: string) => periodExpr(group, col);

  const admitFilter = "(stay_type = 'admit' OR stay_type IS NULL)";
  const [opdR, erR, conR, admR, dcR, wardR, losR] = await Promise.all([
    db.prepare(`SELECT ${pk("date")} as key, SUM(count) as total FROM opd WHERE date BETWEEN ?1 AND ?2 GROUP BY key ORDER BY key`).bind(from, to).all(),
    db.prepare(`SELECT ${pk("date")} as key, SUM(count) as total FROM er WHERE date BETWEEN ?1 AND ?2 GROUP BY key ORDER BY key`).bind(from, to).all(),
    db.prepare(`SELECT ${pk("date")} as key, SUM(count) as total FROM consult WHERE date BETWEEN ?1 AND ?2 GROUP BY key ORDER BY key`).bind(from, to).all(),
    db.prepare(`SELECT ${pk("admit_date")} as key, COUNT(*) as total FROM ipd_stays WHERE ${admitFilter} AND admit_date BETWEEN ?1 AND ?2 GROUP BY key ORDER BY key`).bind(from, to).all(),
    db.prepare(`SELECT ${pk("discharge_date")} as key, COUNT(*) as total FROM ipd_stays WHERE ${admitFilter} AND discharge_date BETWEEN ?1 AND ?2 AND discharge_date != '' GROUP BY key ORDER BY key`).bind(from, to).all(),
    db.prepare(`
      SELECT ward,
        SUM(CASE WHEN admit_date BETWEEN ?1 AND ?2 AND (stay_type = 'admit' OR stay_type IS NULL) THEN 1 ELSE 0 END) as admit,
        SUM(CASE WHEN discharge_date BETWEEN ?1 AND ?2 AND discharge_date != '' AND (stay_type = 'admit' OR stay_type IS NULL) THEN 1 ELSE 0 END) as discharge
      FROM ipd_stays
      WHERE (admit_date BETWEEN ?1 AND ?2) OR (discharge_date BETWEEN ?1 AND ?2 AND discharge_date != '')
      GROUP BY ward ORDER BY ward
    `).bind(from, to).all(),
    db.prepare(`SELECT AVG(los) as v FROM ipd_stays WHERE ${admitFilter} AND discharge_date BETWEEN ?1 AND ?2 AND discharge_date != '' AND los > 0`).bind(from, to).first<{ v: number | null }>(),
  ]);

  const map: Record<string, { key: string; opd: number; er: number; consult: number; ipdAdmit: number; ipdDischarge: number }> = {};
  const ensure = (k: string) => (map[k] ??= { key: k, opd: 0, er: 0, consult: 0, ipdAdmit: 0, ipdDischarge: 0 });

  for (const r of opdR.results) ensure(r.key as string).opd = r.total as number;
  for (const r of erR.results) ensure(r.key as string).er = r.total as number;
  for (const r of conR.results) ensure(r.key as string).consult = r.total as number;
  for (const r of admR.results) ensure(r.key as string).ipdAdmit = r.total as number;
  for (const r of dcR.results) ensure(r.key as string).ipdDischarge = r.total as number;

  return {
    rows: Object.keys(map).sort().map((k) => map[k]),
    wardStats: wardR.results.map((w) => ({ ward: w.ward, admit: w.admit, discharge: w.discharge })),
    avgLosDays: losR?.v ?? 0,
  };
}

/** IPD แยกตาม key (วัน/สัปดาห์/เดือน/ปี) และ ward สำหรับกราฟเลือก Ward */
async function getIpdByWard(db: D1Database, params: URLSearchParams) {
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const group = params.get("group") || "day";
  if (!from || !to) throw new Error("from/to ไม่ถูกต้อง");
  const pk = (col: string) => periodExpr(group, col);

  const admitFilter = "(stay_type = 'admit' OR stay_type IS NULL)";
  const [admitR, dcR, aoR] = await Promise.all([
    db.prepare(
      `SELECT ${pk("admit_date")} as key, ward, COUNT(*) as total FROM ipd_stays WHERE ${admitFilter} AND admit_date BETWEEN ?1 AND ?2 GROUP BY 1, 2 ORDER BY 1, 2`
    ).bind(from, to).all(),
    db.prepare(
      `SELECT ${pk("discharge_date")} as key, ward, COUNT(*) as total FROM ipd_stays WHERE ${admitFilter} AND discharge_date BETWEEN ?1 AND ?2 AND discharge_date != '' GROUP BY 1, 2 ORDER BY 1, 2`
    ).bind(from, to).all(),
    db.prepare(
      `SELECT ${pk("admit_date")} as key, ward, COUNT(*) as total FROM ipd_stays WHERE stay_type = 'ao' AND admit_date BETWEEN ?1 AND ?2 GROUP BY 1, 2 ORDER BY 1, 2`
    ).bind(from, to).all(),
  ]);

  const wardMap: Record<string, Record<string, { admit: number; discharge: number; ao: number }>> = {};
  const ensure = (k: string, w: string) => {
    if (!wardMap[k]) wardMap[k] = {};
    if (!wardMap[k][w]) wardMap[k][w] = { admit: 0, discharge: 0, ao: 0 };
    return wardMap[k][w];
  };
  for (const r of admitR.results) ensure(r.key as string, r.ward as string).admit = r.total as number;
  for (const r of dcR.results) ensure(r.key as string, r.ward as string).discharge = r.total as number;
  for (const r of aoR.results) ensure(r.key as string, r.ward as string).ao = r.total as number;

  const rows: { key: string; ward: string; admit: number; discharge: number; ao: number }[] = [];
  for (const key of Object.keys(wardMap).sort()) {
    for (const ward of Object.keys(wardMap[key])) {
      rows.push({ key, ward, ...wardMap[key][ward] });
    }
  }
  return { rows };
}

/** หัตถการเฉพาะ: สถิติตามช่วง (สำหรับกราฟ) และแยกตามประเภท (pie) */
async function getProcedureStats(db: D1Database, params: URLSearchParams) {
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const group = params.get("group") || "day";
  const ward = params.get("ward") || "";
  if (!from || !to) throw new Error("from/to ไม่ถูกต้อง");
  const pk = (col: string) => periodExpr(group, col);

  const isConsult = ward === "Consult";
  const wardFilter = ward === "OPD"
    ? " AND (ward = ?3 OR ward = '' OR ward IS NULL)"
    : isConsult ? " AND ward LIKE 'Consult%'"
    : ward ? " AND ward = ?3" : "";
  const binds = isConsult ? [from, to] : ward ? [from, to, ward] : [from, to];

  const [rowsR, byProcR] = await Promise.all([
    db.prepare(
      `SELECT ${pk("date")} as key, SUM(count) as total FROM procedures WHERE date BETWEEN ?1 AND ?2${wardFilter} GROUP BY 1 ORDER BY 1`
    ).bind(...binds).all(),
    db.prepare(
      `SELECT procedure_key as procedureKey, procedure_label as procedureLabel, SUM(count) as count FROM procedures WHERE date BETWEEN ?1 AND ?2${wardFilter} GROUP BY procedure_key, procedure_label ORDER BY count DESC`
    ).bind(...binds).all(),
  ]);

  return {
    rows: rowsR.results.map((r) => ({ key: r.key, total: r.total })),
    byProcedure: byProcR.results.map((r) => ({ procedureKey: r.procedureKey, procedureLabel: r.procedureLabel, count: r.count })),
  };
}

async function getActivities(db: D1Database) {
  const r = await db.prepare(
    `SELECT id, date, title, detail, type, image_url as imageUrl, image_caption as imageCaption, youtube_url as youtubeUrl, external_url as externalUrl FROM activities ORDER BY date DESC`
  ).all();
  return { rows: r.results };
}

async function getEncouragement(db: D1Database) {
  const r = await db.prepare(`SELECT id, date, name, message FROM encouragement ORDER BY date DESC`).all();
  return { rows: r.results };
}

async function getIpdOpenCases(db: D1Database) {
  const r = await db.prepare(
    `SELECT hn, ward, admit_date as admitDate FROM ipd_stays WHERE (stay_type = 'admit' OR stay_type IS NULL) AND (discharge_date = '' OR discharge_date IS NULL) ORDER BY admit_date DESC`
  ).all();
  return { rows: r.results };
}

/** MED analysis: ค่าเฉลี่ย OPD, IPD เฉพาะ MED1/MED2, Admission rate, Delay discharge, Bed occupancy (MED1/MED2) */
const MED_WARDS = "('MED1','MED2')";

async function getDivKpi(db: D1Database, params: URLSearchParams) {
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  if (!from || !to) throw new Error("from/to ไม่ถูกต้อง");

  const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
  const admitFilter = "(stay_type = 'admit' OR stay_type IS NULL)";
  const medWardFilter = ` AND ward IN ${MED_WARDS}`;

  const [opdSumR, erSumR, admitCountR, dcCountR, delayR, delayByReasonR, delayedListR, openByWardR, wardBedsR] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(count),0) as v FROM opd WHERE date BETWEEN ?1 AND ?2`).bind(from, to).first<{ v: number }>(),
    db.prepare(`SELECT COALESCE(SUM(count),0) as v FROM er WHERE date BETWEEN ?1 AND ?2`).bind(from, to).first<{ v: number }>(),
    db.prepare(`SELECT COUNT(*) as v FROM ipd_stays WHERE ${admitFilter} AND admit_date BETWEEN ?1 AND ?2${medWardFilter}`).bind(from, to).first<{ v: number }>(),
    db.prepare(`SELECT COUNT(*) as v FROM ipd_stays WHERE ${admitFilter} AND discharge_date BETWEEN ?1 AND ?2 AND discharge_date != ''${medWardFilter}`).bind(from, to).first<{ v: number }>(),
    db.prepare(`SELECT AVG(delay_days) as v, COUNT(*) as n FROM discharge_plans WHERE actual_discharge_date BETWEEN ?1 AND ?2 AND delay_days > 0 AND ward IN ${MED_WARDS}`).bind(from, to).first<{ v: number | null; n: number }>(),
    db.prepare(`SELECT delay_reason as reason, COUNT(*) as count FROM discharge_plans WHERE actual_discharge_date BETWEEN ?1 AND ?2 AND delay_days > 0 AND delay_reason != '' AND ward IN ${MED_WARDS} GROUP BY delay_reason`).bind(from, to).all(),
    db.prepare(
      `SELECT hn, ward, fit_discharge_date as fitDate, actual_discharge_date as actualDate, delay_days as delayDays, delay_reason as reason, delay_detail as detail FROM discharge_plans WHERE actual_discharge_date BETWEEN ?1 AND ?2 AND delay_days > 0 AND ward IN ${MED_WARDS} ORDER BY actual_discharge_date DESC LIMIT 50`
    ).bind(from, to).all(),
    db.prepare(
      `SELECT ward, COUNT(*) as count FROM ipd_stays WHERE ${admitFilter} AND (discharge_date = '' OR discharge_date IS NULL)${medWardFilter} GROUP BY ward`
    ).all(),
    db.prepare(`SELECT ward, beds FROM ward_beds WHERE date = ?1 AND ward IN ${MED_WARDS}`).bind(to).all(),
  ]);

  const opdSum = opdSumR?.v ?? 0;
  const erSum = erSumR?.v ?? 0;
  const admitCount = admitCountR?.v ?? 0;
  const dcCount = dcCountR?.v ?? 0;
  const denom = opdSum + erSum || 1;
  const admissionRate = Math.round((admitCount / denom) * 1000) / 10;
  const avgDelayDays = delayR?.n ? (delayR.v ?? 0) : 0;

  const occupancy: { ward: string; current: number; beds: number; pct: number }[] = [];
  const bedsMap = new Map<string, number>((wardBedsR.results as { ward: string; beds: number }[]).map((r) => [r.ward, r.beds]));
  for (const r of openByWardR.results as { ward: string; count: number }[]) {
    const current = r.count;
    const beds = bedsMap.get(r.ward) ?? 0;
    occupancy.push({ ward: r.ward, current, beds, pct: beds > 0 ? Math.round((current / beds) * 1000) / 10 : 0 });
  }

  return {
    from,
    to,
    days,
    avgOpdPerDay: Math.round((opdSum / days) * 10) / 10,
    avgIpdAdmitPerDay: Math.round((admitCount / days) * 10) / 10,
    totalAdmit: admitCount,
    totalDischarge: dcCount,
    admissionRate,
    avgDelayDischargeDays: Math.round(avgDelayDays * 10) / 10,
    delayByReason: (delayByReasonR.results as { reason: string; count: number }[]).map((r) => ({ reason: r.reason || "อื่นๆ", count: r.count })),
    delayedList: delayedListR.results,
    occupancy,
  };
}

/** จำนวนเตียงที่ Ward กรอกต่อวัน (สำหรับ Bed Occupancy) */
async function getWardBeds(db: D1Database, params: URLSearchParams) {
  const date = params.get("date") || "";
  if (!date) throw new Error("date ไม่ถูกต้อง");
  const r = await db.prepare(`SELECT id, date, ward, beds FROM ward_beds WHERE date = ?1 ORDER BY ward`).bind(date).all();
  return { rows: r.results };
}

async function upsertWardBed(env: Env, body: Body) {
  checkUnit(env, first(body.code));
  const date = first(body.date) || todayStr();
  const ward = first(body.ward).slice(0, 50);
  const beds = Math.max(0, Math.min(999, Number(body.beds) || 0));
  if (!ward) throw new Error("กรุณาเลือก Ward");
  await env.DB.prepare(
    `INSERT INTO ward_beds (date, ward, beds) VALUES (?1, ?2, ?3) ON CONFLICT(date, ward) DO UPDATE SET beds = excluded.beds`
  )
    .bind(date, ward, beds)
    .run();
  return { ok: true };
}

async function getPatientDataAdmin(db: D1Database, params: URLSearchParams) {
  const searchDate = params.get("date") || "";

  const ipdOpenR = await db.prepare(
    `SELECT id, hn, ward, admit_date as admitDate FROM ipd_stays WHERE (stay_type = 'admit' OR stay_type IS NULL) AND (discharge_date = '' OR discharge_date IS NULL) ORDER BY admit_date DESC`
  ).all();

  if (!searchDate) {
    return { ipdOpen: ipdOpenR.results, opd: [], er: [], consult: [], ipd: [], procedures: [] };
  }

  const [opdR, erR, conR, ipdR, procR] = await Promise.all([
    db.prepare(`SELECT id, date, count FROM opd WHERE date = ?1 ORDER BY id DESC`).bind(searchDate).all(),
    db.prepare(`SELECT id, date, count FROM er WHERE date = ?1 ORDER BY id DESC`).bind(searchDate).all(),
    db.prepare(`SELECT id, date, count FROM consult WHERE date = ?1 ORDER BY id DESC`).bind(searchDate).all(),
    db.prepare(
      `SELECT id, hn, ward, admit_date as admitDate, discharge_date as dischargeDate, los, stay_type as stayType FROM ipd_stays WHERE admit_date = ?1 OR discharge_date = ?1 ORDER BY id DESC`
    ).bind(searchDate).all(),
    db.prepare(`SELECT id, date, procedure_key as procedureKey, procedure_label as procedureLabel, count, ward FROM procedures WHERE date = ?1 ORDER BY id DESC`).bind(searchDate).all(),
  ]);
  return { ipdOpen: ipdOpenR.results, opd: opdR.results, er: erR.results, consult: conR.results, ipd: ipdR.results, procedures: procR.results };
}

async function getTodayEntries(db: D1Database, today: string) {
  const [opdR, erR, conR, ipdR, procR] = await Promise.all([
    db.prepare(`SELECT id, date, count FROM opd WHERE date = ?1 ORDER BY id DESC`).bind(today).all(),
    db.prepare(`SELECT id, date, count FROM er WHERE date = ?1 ORDER BY id DESC`).bind(today).all(),
    db.prepare(`SELECT id, date, count FROM consult WHERE date = ?1 ORDER BY id DESC`).bind(today).all(),
    db.prepare(
      `SELECT id, hn, ward, admit_date as admitDate, discharge_date as dischargeDate, los, stay_type as stayType FROM ipd_stays WHERE admit_date = ?1 ORDER BY id DESC`
    ).bind(today).all(),
    db.prepare(`SELECT id, date, procedure_key as procedureKey, procedure_label as procedureLabel, count, ward FROM procedures WHERE date = ?1 ORDER BY id DESC`).bind(today).all(),
  ]);
  return { opd: opdR.results, er: erR.results, consult: conR.results, ipd: ipdR.results, procedures: procR.results };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function updateTodayRow(env: Env, body: Body) {
  checkUnit(env, first(body.code));
  const sheetType = first(body.sheetType);
  const rowId = first(body.rowId);
  const today = todayStr();
  if (!rowId) throw new Error("ไม่ระบุ rowId");

  if (sheetType === "opd" || sheetType === "consult" || sheetType === "er") {
    const table = sheetType === "opd" ? "opd" : sheetType === "er" ? "er" : "consult";
    const r = await env.DB.prepare(`UPDATE ${table} SET count=?1 WHERE id=?2 AND date=?3`)
      .bind(Number(body.count || 0), rowId, today).run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลวันนี้ที่ต้องการแก้ไข");
  } else if (sheetType === "procedure") {
    const r = await env.DB.prepare(`UPDATE procedures SET procedure_key=?1, procedure_label=?2, count=?3, ward=?4 WHERE id=?5 AND date=?6`)
      .bind(first(body.procedureKey), first(body.procedureLabel), Number(body.count || 1), first(body.ward), rowId, today).run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลวันนี้ที่ต้องการแก้ไข");
  } else if (sheetType === "ipd") {
    const stayType = first(body.stayType) || "admit";
    const hn = stayType === "ao" ? "" : first(body.hn);
    const ward = first(body.ward);
    const r = await env.DB.prepare(`UPDATE ipd_stays SET hn=?1, ward=?2, stay_type=?3 WHERE id=?4 AND admit_date=?5`)
      .bind(hn, ward, stayType, rowId, today).run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลวันนี้ที่ต้องการแก้ไข");
  } else {
    throw new Error("sheetType ไม่ถูกต้อง");
  }
  return { ok: true };
}

async function deleteTodayRow(env: Env, body: Body) {
  checkUnit(env, first(body.code));
  const sheetType = first(body.sheetType);
  const rowId = first(body.rowId);
  const today = todayStr();
  if (!rowId) throw new Error("ไม่ระบุ rowId");

  const tableMap: Record<string, { table: string; dateCol: string }> = {
    opd: { table: "opd", dateCol: "date" },
    er: { table: "er", dateCol: "date" },
    consult: { table: "consult", dateCol: "date" },
    ipd: { table: "ipd_stays", dateCol: "admit_date" },
    procedure: { table: "procedures", dateCol: "date" },
  };
  const m = tableMap[sheetType];
  if (!m) throw new Error("sheetType ไม่ถูกต้อง");

  const r = await env.DB.prepare(`DELETE FROM ${m.table} WHERE id = ?1 AND ${m.dateCol} = ?2`).bind(rowId, today).run();
  if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลวันนี้ที่ต้องการลบ");
  return { ok: true };
}

// ─── POST handlers ───────────────────────────────────────

async function addStatsRow(env: Env, body: Body) {
  checkUnit(env, first(body.code));
  const sheet = String(body.sheetName || "");
  const tableMap: Record<string, string> = { OPD: "opd", ER: "er", Consult: "consult" };
  const table = tableMap[sheet];
  if (!table) throw new Error("sheetName ไม่ถูกต้อง (OPD / ER / Consult)");
  await env.DB.prepare(`INSERT INTO ${table} (date, count) VALUES (?1, ?2)`)
    .bind(String(body.date || ""), Number(body.count || 0))
    .run();
  return { ok: true };
}

async function addProcedure(env: Env, body: Body) {
  checkUnit(env, first(body.code));
  const date = first(body.date) || todayStr();
  const procedureKey = first(body.procedureKey).slice(0, 100);
  if (!procedureKey) throw new Error("ระบุประเภทหัตถการ");
  const ward = first(body.ward).slice(0, 50);
  await env.DB.prepare(`INSERT INTO procedures (date, procedure_key, procedure_label, count, ward) VALUES (?1, ?2, ?3, ?4, ?5)`)
    .bind(date, procedureKey, first(body.procedureLabel).slice(0, 200), Number(body.count || 1), ward)
    .run();
  return { ok: true };
}

async function addIpdAdmit(env: Env, body: Body) {
  checkUnit(env, first(body.code));
  const stayType = first(body.stayType) || "admit";
  const ward = first(body.ward);
  const admitDate = first(body.admitDate);

  if (stayType === "ao") {
    if (!ward || !admitDate) throw new Error("กรุณาเลือก Ward และวันที่");
    const count = Math.max(1, Math.min(100, Number(body.count) || 1));
    for (let i = 0; i < count; i++) {
      await env.DB.prepare(`INSERT INTO ipd_stays (hn, ward, admit_date, stay_type) VALUES (?1, ?2, ?3, 'ao')`)
        .bind("", ward, admitDate)
        .run();
    }
    return { ok: true };
  }

  const hn = first(body.hn);
  if (!hn || !ward || !admitDate) throw new Error("ข้อมูลไม่ครบ (HN, Ward, วันที่ Admit)");
  await env.DB.prepare(`INSERT INTO ipd_stays (hn, ward, admit_date, stay_type) VALUES (?1, ?2, ?3, 'admit')`)
    .bind(hn, ward, admitDate)
    .run();
  return { ok: true };
}

async function addIpdDischarge(env: Env, body: Body) {
  checkUnit(env, first(body.code));
  const hn = first(body.hn);
  const dischargeDate = first(body.dischargeDate);
  const fitDischargeDate = first(body.fitDischargeDate);
  const delayReason = first(body.delayReason).slice(0, 80);
  const delayDetail = first(body.delayDetail).slice(0, 500);
  if (!hn || !dischargeDate) throw new Error("ข้อมูลไม่ครบ");

  const row = await env.DB.prepare(
    `SELECT id, admit_date, ward FROM ipd_stays WHERE hn = ?1 AND (stay_type = 'admit' OR stay_type IS NULL) AND (discharge_date = '' OR discharge_date IS NULL) ORDER BY admit_date DESC LIMIT 1`
  ).bind(hn).first<{ id: number; admit_date: string; ward: string }>();

  if (!row) throw new Error("ไม่พบเคสค้างของ HN นี้");

  const admit = new Date(row.admit_date);
  const dc = new Date(dischargeDate);
  const los = Math.max(1, Math.round((dc.getTime() - admit.getTime()) / 86400000));

  await env.DB.prepare(`UPDATE ipd_stays SET discharge_date = ?1, los = ?2 WHERE id = ?3`)
    .bind(dischargeDate, los, row.id)
    .run();

  let delayDays = 0;
  if (fitDischargeDate) {
    const fit = new Date(fitDischargeDate);
    delayDays = Math.max(0, Math.round((dc.getTime() - fit.getTime()) / 86400000));
    await env.DB.prepare(
      `INSERT INTO discharge_plans (ipd_stay_id, hn, ward, fit_discharge_date, actual_discharge_date, delay_days, delay_reason, delay_detail) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`
    )
      .bind(row.id, hn, row.ward || "", fitDischargeDate, dischargeDate, delayDays, delayReason, delayDetail)
      .run();
  }

  return { ok: true, los, delayDays };
}

async function addActivity(env: Env, body: Body) {
  checkAdmin(env, first(body.code, body.adminCode));
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO activities (id, date, title, detail, type, image_url, image_caption, youtube_url, external_url) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`
  )
    .bind(id, first(body.date).slice(0, 10), first(body.title).slice(0, 200), first(body.detail).slice(0, 2000), first(body.type).slice(0, 50), first(body.imageUrl).slice(0, 500), first(body.imageCaption).slice(0, 300), first(body.youtubeUrl).slice(0, 500), first(body.externalUrl).slice(0, 500))
    .run();
  return { ok: true };
}

async function addEncouragement(env: Env, body: Body) {
  checkUnit(env, first(body.code, body.unitCode));
  const name = first(body.name, body.author).slice(0, 100);
  const message = first(body.message).slice(0, 500);
  if (!message) throw new Error("กรุณาเขียนข้อความกำลังใจ");
  const id = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(`INSERT INTO encouragement (id, date, name, message) VALUES (?1,?2,?3,?4)`)
    .bind(id, today, name, message)
    .run();
  return { ok: true };
}

async function deleteRow(env: Env, body: Body) {
  checkAdmin(env, first(body.code, body.adminCode));
  const sheetType = first(body.sheetType);
  const rowId = first(body.rowId);
  if (!rowId) throw new Error("ไม่ระบุ rowId");

  const tableMap: Record<string, string> = {
    activities: "activities",
    encouragement: "encouragement",
    opd: "opd",
    er: "er",
    consult: "consult",
    ipd: "ipd_stays",
    procedure: "procedures",
  };
  const table = tableMap[sheetType];
  if (!table) throw new Error("sheetType ไม่ถูกต้อง");

  const r = await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?1`).bind(rowId).run();
  if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลที่ต้องการลบ");
  return { ok: true };
}

async function updateRow(env: Env, body: Body) {
  checkAdmin(env, first(body.code, body.adminCode));
  const sheetType = first(body.sheetType);
  const rowId = first(body.rowId);
  if (!rowId) throw new Error("ไม่ระบุ rowId");

  if (sheetType === "activities") {
    const r = await env.DB.prepare(
      `UPDATE activities SET date=?1, title=?2, detail=?3, type=?4, image_url=?5, image_caption=?6, youtube_url=?7, external_url=?8 WHERE id=?9`
    )
      .bind(first(body.date), first(body.title), first(body.detail), first(body.type), first(body.imageUrl), first(body.imageCaption), first(body.youtubeUrl), first(body.externalUrl), rowId)
      .run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
  } else if (sheetType === "encouragement") {
    const r = await env.DB.prepare(`UPDATE encouragement SET date=?1, name=?2, message=?3 WHERE id=?4`)
      .bind(first(body.date), first(body.name), first(body.message), rowId)
      .run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
  } else if (sheetType === "opd" || sheetType === "consult" || sheetType === "er") {
    const table = sheetType === "opd" ? "opd" : sheetType === "er" ? "er" : "consult";
    const r = await env.DB.prepare(`UPDATE ${table} SET date=?1, count=?2 WHERE id=?3`)
      .bind(first(body.date), Number(body.count || 0), rowId)
      .run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
  } else if (sheetType === "ipd") {
    const stayType = first(body.stayType) || "admit";
    const hn = stayType === "ao" ? "" : first(body.hn);
    const ward = first(body.ward);
    const admitDate = first(body.admitDate);
    const dischargeDate = stayType === "ao" ? "" : first(body.dischargeDate);
    const los = stayType === "ao" ? 0 : Number(body.los || 0);
    let finalLos = los;
    if (stayType !== "ao" && admitDate && dischargeDate) {
      const ad = new Date(admitDate);
      const dd = new Date(dischargeDate);
      finalLos = Math.max(1, Math.round((dd.getTime() - ad.getTime()) / 86400000));
    }
    const r = await env.DB.prepare(`UPDATE ipd_stays SET hn=?1, ward=?2, admit_date=?3, discharge_date=?4, los=?5, stay_type=?6 WHERE id=?7`)
      .bind(hn, ward, admitDate, dischargeDate, finalLos, stayType, rowId)
      .run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
  } else if (sheetType === "procedure") {
    const r = await env.DB.prepare(`UPDATE procedures SET date=?1, procedure_key=?2, procedure_label=?3, count=?4, ward=?5 WHERE id=?6`)
      .bind(first(body.date), first(body.procedureKey), first(body.procedureLabel), Number(body.count || 1), first(body.ward), rowId)
      .run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
  } else {
    throw new Error("sheetType ไม่ถูกต้อง");
  }
  return { ok: true };
}

// ─── Main handler ────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    try {
      if (request.method === "GET") {
        const url = new URL(request.url);
        const p = url.searchParams;
        const action = p.get("action") || "";

        switch (action) {
          case "stats":
            return json(await getStats(env.DB, p));
          case "ipdByWard":
            return json(await getIpdByWard(env.DB, p));
          case "procedureStats":
            return json(await getProcedureStats(env.DB, p));
          case "activities":
            return json(await getActivities(env.DB));
          case "activitiesAdmin":
            checkAdmin(env, first(p.get("code"), p.get("adminCode")));
            return json(await getActivities(env.DB));
          case "encouragement":
            return json(await getEncouragement(env.DB));
          case "encouragementAdmin":
            checkAdmin(env, first(p.get("code"), p.get("adminCode")));
            return json(await getEncouragement(env.DB));
          case "ipdOpenCases":
            checkUnit(env, first(p.get("code"), p.get("unitCode")));
            return json(await getIpdOpenCases(env.DB));
          case "patientDataAdmin":
            checkAdmin(env, first(p.get("code"), p.get("adminCode")));
            return json(await getPatientDataAdmin(env.DB, p));
          case "todayEntries":
            checkUnit(env, first(p.get("code"), p.get("unitCode")));
            return json(await getTodayEntries(env.DB, p.get("date") || todayStr()));
          case "divKpi":
            return json(await getDivKpi(env.DB, p));
          case "wardBeds":
            return json(await getWardBeds(env.DB, p));
          default:
            return json({ error: "unknown action" }, 400);
        }
      }

      if (request.method === "POST") {
        const body = (await request.json()) as Body;
        const action = first(body.action);

        switch (action) {
          case "addStatsRow":
            return json(await addStatsRow(env, body));
          case "addProcedure":
            return json(await addProcedure(env, body));
          case "addIpdAdmit":
            return json(await addIpdAdmit(env, body));
          case "addIpdDischarge":
            return json(await addIpdDischarge(env, body));
          case "addActivity":
            return json(await addActivity(env, body));
          case "addEncouragement":
            return json(await addEncouragement(env, body));
          case "deleteRow":
            return json(await deleteRow(env, body));
          case "updateRow":
            return json(await updateRow(env, body));
          case "updateTodayRow":
            return json(await updateTodayRow(env, body));
          case "deleteTodayRow":
            return json(await deleteTodayRow(env, body));
          case "upsertWardBed":
            return json(await upsertWardBed(env, body));
          default:
            return json({ error: "unknown action" }, 400);
        }
      }

      return json({ error: "Method not allowed" }, 405);
    } catch (err) {
      return json({ error: (err as Error).message || "Internal error" }, 400);
    }
  },
};
