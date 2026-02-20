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

  const [opdR, conR, admR, dcR, wardR, losR] = await Promise.all([
    db.prepare(`SELECT ${pk("date")} as key, SUM(count) as total FROM opd WHERE date BETWEEN ?1 AND ?2 GROUP BY key ORDER BY key`).bind(from, to).all(),
    db.prepare(`SELECT ${pk("date")} as key, SUM(count) as total FROM consult WHERE date BETWEEN ?1 AND ?2 GROUP BY key ORDER BY key`).bind(from, to).all(),
    db.prepare(`SELECT ${pk("admit_date")} as key, COUNT(*) as total FROM ipd_stays WHERE admit_date BETWEEN ?1 AND ?2 GROUP BY key ORDER BY key`).bind(from, to).all(),
    db.prepare(`SELECT ${pk("discharge_date")} as key, COUNT(*) as total FROM ipd_stays WHERE discharge_date BETWEEN ?1 AND ?2 AND discharge_date != '' GROUP BY key ORDER BY key`).bind(from, to).all(),
    db.prepare(`
      SELECT ward,
        SUM(CASE WHEN admit_date BETWEEN ?1 AND ?2 THEN 1 ELSE 0 END) as admit,
        SUM(CASE WHEN discharge_date BETWEEN ?1 AND ?2 AND discharge_date != '' THEN 1 ELSE 0 END) as discharge
      FROM ipd_stays
      WHERE (admit_date BETWEEN ?1 AND ?2) OR (discharge_date BETWEEN ?1 AND ?2 AND discharge_date != '')
      GROUP BY ward ORDER BY ward
    `).bind(from, to).all(),
    db.prepare(`SELECT AVG(los) as v FROM ipd_stays WHERE discharge_date BETWEEN ?1 AND ?2 AND discharge_date != '' AND los > 0`).bind(from, to).first<{ v: number | null }>(),
  ]);

  const map: Record<string, { key: string; opd: number; consult: number; ipdAdmit: number; ipdDischarge: number }> = {};
  const ensure = (k: string) => (map[k] ??= { key: k, opd: 0, consult: 0, ipdAdmit: 0, ipdDischarge: 0 });

  for (const r of opdR.results) ensure(r.key as string).opd = r.total as number;
  for (const r of conR.results) ensure(r.key as string).consult = r.total as number;
  for (const r of admR.results) ensure(r.key as string).ipdAdmit = r.total as number;
  for (const r of dcR.results) ensure(r.key as string).ipdDischarge = r.total as number;

  return {
    rows: Object.keys(map).sort().map((k) => map[k]),
    wardStats: wardR.results.map((w) => ({ ward: w.ward, admit: w.admit, discharge: w.discharge })),
    avgLosDays: losR?.v ?? 0,
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
    `SELECT hn, ward, admit_date as admitDate FROM ipd_stays WHERE discharge_date = '' OR discharge_date IS NULL ORDER BY admit_date DESC`
  ).all();
  return { rows: r.results };
}

async function getPatientDataAdmin(db: D1Database, params: URLSearchParams) {
  const searchDate = params.get("date") || "";

  const ipdOpenR = await db.prepare(
    `SELECT id, hn, ward, admit_date as admitDate FROM ipd_stays WHERE discharge_date = '' OR discharge_date IS NULL ORDER BY admit_date DESC`
  ).all();

  if (!searchDate) {
    return { ipdOpen: ipdOpenR.results, opd: [], consult: [], ipd: [] };
  }

  const [opdR, conR, ipdR] = await Promise.all([
    db.prepare(`SELECT id, date, count FROM opd WHERE date = ?1 ORDER BY id DESC`).bind(searchDate).all(),
    db.prepare(`SELECT id, date, count FROM consult WHERE date = ?1 ORDER BY id DESC`).bind(searchDate).all(),
    db.prepare(
      `SELECT id, hn, ward, admit_date as admitDate, discharge_date as dischargeDate, los FROM ipd_stays WHERE admit_date = ?1 OR discharge_date = ?1 ORDER BY id DESC`
    ).bind(searchDate).all(),
  ]);
  return { ipdOpen: ipdOpenR.results, opd: opdR.results, consult: conR.results, ipd: ipdR.results };
}

async function getTodayEntries(db: D1Database, today: string) {
  const [opdR, conR, ipdR] = await Promise.all([
    db.prepare(`SELECT id, date, count FROM opd WHERE date = ?1 ORDER BY id DESC`).bind(today).all(),
    db.prepare(`SELECT id, date, count FROM consult WHERE date = ?1 ORDER BY id DESC`).bind(today).all(),
    db.prepare(
      `SELECT id, hn, ward, admit_date as admitDate, discharge_date as dischargeDate, los FROM ipd_stays WHERE admit_date = ?1 ORDER BY id DESC`
    ).bind(today).all(),
  ]);
  return { opd: opdR.results, consult: conR.results, ipd: ipdR.results };
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

  if (sheetType === "opd" || sheetType === "consult") {
    const table = sheetType === "opd" ? "opd" : "consult";
    const r = await env.DB.prepare(`UPDATE ${table} SET count=?1 WHERE id=?2 AND date=?3`)
      .bind(Number(body.count || 0), rowId, today).run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลวันนี้ที่ต้องการแก้ไข");
  } else if (sheetType === "ipd") {
    const hn = first(body.hn);
    const ward = first(body.ward);
    const r = await env.DB.prepare(`UPDATE ipd_stays SET hn=?1, ward=?2 WHERE id=?3 AND admit_date=?4`)
      .bind(hn, ward, rowId, today).run();
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
    consult: { table: "consult", dateCol: "date" },
    ipd: { table: "ipd_stays", dateCol: "admit_date" },
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
  if (sheet !== "OPD" && sheet !== "Consult") throw new Error("sheetName ไม่ถูกต้อง");
  const table = sheet === "OPD" ? "opd" : "consult";
  await env.DB.prepare(`INSERT INTO ${table} (date, count) VALUES (?1, ?2)`)
    .bind(String(body.date || ""), Number(body.count || 0))
    .run();
  return { ok: true };
}

async function addIpdAdmit(env: Env, body: Body) {
  checkUnit(env, first(body.code));
  const hn = first(body.hn);
  const ward = first(body.ward);
  const admitDate = first(body.admitDate);
  if (!hn || !ward || !admitDate) throw new Error("ข้อมูลไม่ครบ");
  await env.DB.prepare(`INSERT INTO ipd_stays (hn, ward, admit_date) VALUES (?1, ?2, ?3)`)
    .bind(hn, ward, admitDate)
    .run();
  return { ok: true };
}

async function addIpdDischarge(env: Env, body: Body) {
  checkUnit(env, first(body.code));
  const hn = first(body.hn);
  const dischargeDate = first(body.dischargeDate);
  if (!hn || !dischargeDate) throw new Error("ข้อมูลไม่ครบ");

  const row = await env.DB.prepare(
    `SELECT id, admit_date FROM ipd_stays WHERE hn = ?1 AND (discharge_date = '' OR discharge_date IS NULL) ORDER BY admit_date DESC LIMIT 1`
  ).bind(hn).first<{ id: number; admit_date: string }>();

  if (!row) throw new Error("ไม่พบเคสค้างของ HN นี้");

  const admit = new Date(row.admit_date);
  const dc = new Date(dischargeDate);
  const los = Math.max(1, Math.round((dc.getTime() - admit.getTime()) / 86400000));

  await env.DB.prepare(`UPDATE ipd_stays SET discharge_date = ?1, los = ?2 WHERE id = ?3`)
    .bind(dischargeDate, los, row.id)
    .run();
  return { ok: true, los };
}

async function addActivity(env: Env, body: Body) {
  checkAdmin(env, first(body.code, body.adminCode));
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO activities (id, date, title, detail, type, image_url, image_caption, youtube_url, external_url) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`
  )
    .bind(id, first(body.date), first(body.title), first(body.detail), first(body.type), first(body.imageUrl), first(body.imageCaption), first(body.youtubeUrl), first(body.externalUrl))
    .run();
  return { ok: true };
}

async function addEncouragement(env: Env, body: Body) {
  checkUnit(env, first(body.code, body.unitCode));
  const name = first(body.name, body.author);
  const id = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(`INSERT INTO encouragement (id, date, name, message) VALUES (?1,?2,?3,?4)`)
    .bind(id, today, name, first(body.message))
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
    consult: "consult",
    ipd: "ipd_stays",
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
  } else if (sheetType === "opd" || sheetType === "consult") {
    const table = sheetType === "opd" ? "opd" : "consult";
    const r = await env.DB.prepare(`UPDATE ${table} SET date=?1, count=?2 WHERE id=?3`)
      .bind(first(body.date), Number(body.count || 0), rowId)
      .run();
    if (r.meta.changes === 0) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
  } else if (sheetType === "ipd") {
    const hn = first(body.hn);
    const ward = first(body.ward);
    const admitDate = first(body.admitDate);
    const dischargeDate = first(body.dischargeDate);
    let los = Number(body.los || 0);
    if (admitDate && dischargeDate) {
      const ad = new Date(admitDate);
      const dd = new Date(dischargeDate);
      los = Math.max(1, Math.round((dd.getTime() - ad.getTime()) / 86400000));
    }
    const r = await env.DB.prepare(`UPDATE ipd_stays SET hn=?1, ward=?2, admit_date=?3, discharge_date=?4, los=?5 WHERE id=?6`)
      .bind(hn, ward, admitDate, dischargeDate, los, rowId)
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
