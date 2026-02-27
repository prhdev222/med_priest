"use client";

import { FormEvent, useState, useCallback } from "react";
import {
  addIpdAdmit, addIpdDischarge, addStatsRow, addProcedure,
  getIpdOpenCases, getTodayEntries, updateTodayRow, deleteTodayRow,
  IpdOpenCase, OpdAdminItem, ErAdminItem, ConsultAdminItem, IpdAdminItem, ProcedureAdminItem,
  PROCEDURE_OPTIONS,
} from "@/lib/api";

const wards = ["MED1", "MED2", "IMC", "Palliative", "ward90", "ICU", "__other__"];
const PROC_WARD_OPTIONS = ["OPD", "ER", "MED1", "MED2", "IMC", "Palliative", "ward90", "ICU", "__other__"];
const todayIso = () => new Date().toISOString().slice(0, 10);

type Section = "opd" | "admit" | "ao" | "dc" | "proc" | "today" | null;

const SECTIONS: { key: Section; icon: string; label: string; desc: string; color: string }[] = [
  { key: "opd", icon: "🏥", label: "OPD / ER / Consult", desc: "บันทึกจำนวนผู้ป่วยนอกรายวัน", color: "#2563eb" },
  { key: "admit", icon: "🛏️", label: "IPD Admit", desc: "เพิ่มผู้ป่วยใน (มี HN)", color: "#d97706" },
  { key: "ao", icon: "🛏️", label: "IPD A/O", desc: "บันทึกจำนวน A/O รายวัน", color: "#0d9488" },
  { key: "dc", icon: "✅", label: "D/C จำหน่าย", desc: "จำหน่ายผู้ป่วยออกจาก Ward", color: "#16a34a" },
  { key: "proc", icon: "🩺", label: "หัตถการเฉพาะ", desc: "บันทึกหัตถการที่ทำ", color: "#7c3aed" },
  { key: "today", icon: "📅", label: "ข้อมูลวันนี้", desc: "ดู / แก้ไข / ลบข้อมูลที่กรอกวันนี้", color: "#dc2626" },
];

export default function DataEntryPage() {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>(null);
  const [date, setDate] = useState(todayIso());
  const [opd, setOpd] = useState(0);
  const [er, setEr] = useState(0);
  const [consult, setConsult] = useState(0);
  const [admitHn, setAdmitHn] = useState("");
  const [admitWard, setAdmitWard] = useState(wards[0]);
  const [admitWardCustom, setAdmitWardCustom] = useState("");
  const [admitDate, setAdmitDate] = useState(todayIso());
  const [aoWard, setAoWard] = useState(wards[0]);
  const [aoWardCustom, setAoWardCustom] = useState("");
  const [aoDate, setAoDate] = useState(todayIso());
  const [aoCount, setAoCount] = useState(1);
  const [dcHn, setDcHn] = useState("");
  const [dcDate, setDcDate] = useState(todayIso());
  const [openCases, setOpenCases] = useState<IpdOpenCase[]>([]);
  const [dcFilterWard, setDcFilterWard] = useState("__all__");
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");
  const [verifying, setVerifying] = useState(false);

  const [todayOpd, setTodayOpd] = useState<OpdAdminItem[]>([]);
  const [todayEr, setTodayEr] = useState<ErAdminItem[]>([]);
  const [todayCon, setTodayCon] = useState<ConsultAdminItem[]>([]);
  const [todayIpd, setTodayIpd] = useState<IpdAdminItem[]>([]);
  const [todayProcedures, setTodayProcedures] = useState<ProcedureAdminItem[]>([]);
  const [procKey, setProcKey] = useState("");
  const [procLabel, setProcLabel] = useState("");
  const [procCount, setProcCount] = useState(1);
  const [procWard, setProcWard] = useState("OPD");
  const [procWardOther, setProcWardOther] = useState("");
  const [editProcId, setEditProcId] = useState<number | null>(null);
  const [editProcKey, setEditProcKey] = useState("");
  const [editProcLabel, setEditProcLabel] = useState("");
  const [editProcCount, setEditProcCount] = useState(1);
  const [editOpdId, setEditOpdId] = useState<number | null>(null);
  const [editOpdVal, setEditOpdVal] = useState(0);
  const [editErId, setEditErId] = useState<number | null>(null);
  const [editErVal, setEditErVal] = useState(0);
  const [editConId, setEditConId] = useState<number | null>(null);
  const [editConVal, setEditConVal] = useState(0);
  const [editIpdId, setEditIpdId] = useState<number | null>(null);
  const [editIpdForm, setEditIpdForm] = useState<{ hn: string; ward: string; stayType?: string }>({ hn: "", ward: wards[0] });
  const [editIpdWardCustom, setEditIpdWardCustom] = useState("");

  function flash(text: string, type: "success" | "error" = "success") {
    setMsg(text); setMsgType(type);
    if (type === "success") setTimeout(() => setMsg(""), 4000);
  }

  const loadOpenCases = useCallback(async (c: string) => {
    if (!c) return;
    try { const res = await getIpdOpenCases(c); setOpenCases(res.rows || []); } catch { setOpenCases([]); }
  }, []);

  const loadToday = useCallback(async (c: string) => {
    if (!c) return;
    try {
      const res = await getTodayEntries(c, todayIso());
      setTodayOpd(res.opd || []); setTodayEr(res.er || []);
      setTodayCon(res.consult || []); setTodayIpd(res.ipd || []);
      setTodayProcedures(res.procedures || []);
    } catch { /* ignore */ }
  }, []);

  async function unlockWithCode(e?: FormEvent) {
    e?.preventDefault();
    const c = code.trim();
    if (!c) { flash("กรุณากรอกรหัสหน่วยงาน", "error"); return; }
    setVerifying(true); setMsg("");
    try {
      await getTodayEntries(c, todayIso());
      setUnlocked(true);
      await Promise.all([loadOpenCases(c), loadToday(c)]);
      flash("ยืนยันรหัสสำเร็จ — เลือกหมวดหมู่เพื่อเริ่มกรอกข้อมูล");
    } catch (err) {
      flash((err as Error).message || "รหัสไม่ถูกต้อง กรุณาลองใหม่", "error");
    } finally { setVerifying(false); }
  }

  const resolveWard = (selected: string, custom: string) =>
    selected === "__other__" ? custom.trim() || "Other" : selected;

  async function submitDaily(e: FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await addStatsRow({ code, sheetName: "OPD", date, count: Number(opd) || 0 });
      await addStatsRow({ code, sheetName: "ER", date, count: Number(er) || 0 });
      await addStatsRow({ code, sheetName: "Consult", date, count: Number(consult) || 0 });
      flash("บันทึก OPD / ER / Consult สำเร็จ"); await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitAdmit(e: FormEvent) {
    e.preventDefault(); setMsg("");
    const ward = resolveWard(admitWard, admitWardCustom);
    try {
      await addIpdAdmit({ code, hn: admitHn, ward, admitDate, stayType: "admit" });
      setAdmitHn(""); setAdmitWardCustom("");
      flash("บันทึก Admit สำเร็จ");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitAo(e: FormEvent) {
    e.preventDefault(); setMsg("");
    const ward = resolveWard(aoWard, aoWardCustom);
    try {
      await addIpdAdmit({ code, stayType: "ao", ward, admitDate: aoDate, count: aoCount });
      setAoWardCustom("");
      flash(`บันทึก A/O ${aoCount} ราย สำเร็จ`); await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitProcedure(e: FormEvent) {
    e.preventDefault(); setMsg("");
    if (!procKey) { flash("เลือกประเภทหัตถการ", "error"); return; }
    if (procWard === "__other__" && !procWardOther.trim()) { flash("กรุณาระบุชื่อ Ward", "error"); return; }
    const wardValue = procWard === "__other__" ? `Consult(${procWardOther.trim()})` : procWard;
    try {
      await addProcedure({ code, date, procedureKey: procKey, procedureLabel: procKey === "other" ? procLabel : undefined, count: procCount, ward: wardValue });
      setProcKey(""); setProcLabel(""); setProcCount(1); setProcWardOther("");
      flash("บันทึกหัตถการสำเร็จ"); await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function doDc(hn: string) {
    if (!confirm(`ยืนยัน D/C HN ${hn} วันที่ ${dcDate}?`)) return;
    setMsg("");
    try {
      await addIpdDischarge({ code, hn, dischargeDate: dcDate });
      flash("บันทึก D/C สำเร็จ");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitDcByForm() {
    if (!dcHn.trim()) return; setMsg("");
    try {
      await addIpdDischarge({ code, hn: dcHn.trim(), dischargeDate: dcDate });
      setDcHn(""); flash("บันทึก D/C สำเร็จ");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function saveEditProc() {
    if (editProcId === null) return;
    try {
      await updateTodayRow({ code, sheetType: "procedure", rowId: String(editProcId), procedureKey: editProcKey, procedureLabel: editProcKey === "other" ? editProcLabel : "", count: editProcCount });
      setEditProcId(null); flash("แก้ไขหัตถการสำเร็จ"); await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }
  async function saveEditOpd() {
    if (editOpdId === null) return;
    try { await updateTodayRow({ code, sheetType: "opd", rowId: String(editOpdId), count: editOpdVal }); setEditOpdId(null); flash("แก้ไข OPD สำเร็จ"); await loadToday(code); } catch (error) { flash((error as Error).message, "error"); }
  }
  async function saveEditEr() {
    if (editErId === null) return;
    try { await updateTodayRow({ code, sheetType: "er", rowId: String(editErId), count: editErVal }); setEditErId(null); flash("แก้ไข ER สำเร็จ"); await loadToday(code); } catch (error) { flash((error as Error).message, "error"); }
  }
  async function saveEditCon() {
    if (editConId === null) return;
    try { await updateTodayRow({ code, sheetType: "consult", rowId: String(editConId), count: editConVal }); setEditConId(null); flash("แก้ไข Consult สำเร็จ"); await loadToday(code); } catch (error) { flash((error as Error).message, "error"); }
  }
  async function saveEditIpd() {
    if (editIpdId === null) return;
    const ward = resolveWard(editIpdForm.ward, editIpdWardCustom);
    try { await updateTodayRow({ code, sheetType: "ipd", rowId: String(editIpdId), ...editIpdForm, ward }); setEditIpdId(null); setEditIpdWardCustom(""); flash("แก้ไข IPD สำเร็จ"); await Promise.all([loadOpenCases(code), loadToday(code)]); } catch (error) { flash((error as Error).message, "error"); }
  }
  async function delToday(type: string, id: number) {
    if (!confirm("ต้องการลบรายการนี้?")) return;
    try { await deleteTodayRow({ code, sheetType: type, rowId: String(id) }); flash("ลบสำเร็จ"); await Promise.all([loadOpenCases(code), loadToday(code)]); } catch (error) { flash((error as Error).message, "error"); }
  }

  function getProcedureLabel(item: ProcedureAdminItem): string {
    if (item.procedureKey === "other") return item.procedureLabel ? `Other: ${item.procedureLabel}` : "Other";
    const opt = PROCEDURE_OPTIONS.find((o) => o.key === item.procedureKey);
    return opt?.label ?? item.procedureKey;
  }

  const todayTotalCount = todayOpd.length + todayEr.length + todayCon.length + todayIpd.length + todayProcedures.length;

  const wardSelect = (val: string, onChange: (v: string) => void, style?: React.CSSProperties) => (
    <select value={val} onChange={(e) => onChange(e.target.value)} style={style}>
      {wards.map((w) => <option key={w} value={w}>{w === "__other__" ? "Other (พิมพ์เอง)" : w}</option>)}
    </select>
  );

  const backBtn = (
    <button type="button" className="de-back-btn" onClick={() => { setActiveSection(null); setMsg(""); }}>
      ← กลับเมนูหลัก
    </button>
  );

  return (
    <section className="entry-section">
      <div className="page-header">
        <h1>📝 กรอกข้อมูลผู้ป่วย</h1>
        <p>เลือกหมวดหมู่ แล้วกรอกข้อมูล — กรอกวันนี้แก้ไขได้ทันที</p>
      </div>

      {/* ── Unlock ── */}
      <div className="de-unlock-card">
        <form onSubmit={unlockWithCode} className="de-unlock-form">
          <div className="field-group" style={{ flex: "1 1 200px" }}>
            <label>🔑 รหัสหน่วยงาน</label>
            <input type="password" placeholder="ใส่รหัสเพื่อเริ่มกรอกข้อมูล" value={code} onChange={(e) => setCode(e.target.value)} disabled={unlocked} />
          </div>
          {!unlocked ? (
            <button type="submit" disabled={verifying} style={{ minHeight: 42 }}>
              {verifying ? "กำลังตรวจสอบ..." : "ยืนยัน"}
            </button>
          ) : (
            <span className="de-unlocked-badge">✓ เปิดใช้งานแล้ว</span>
          )}
        </form>
      </div>

      {msg && <div className={`entry-msg ${msgType}`} style={{ maxWidth: 600 }}>{msg}</div>}

      {!unlocked && (
        <p style={{ color: "var(--muted)", marginTop: 8 }}>กรอกรหัสหน่วยงานเพื่อเริ่มใช้งาน</p>
      )}

      {unlocked && activeSection === null && (
        <div className="de-menu-grid">
          {SECTIONS.map((s) => (
            <button key={s.key} className="de-menu-card" onClick={() => setActiveSection(s.key)} style={{ "--card-accent": s.color } as React.CSSProperties}>
              <span className="de-menu-icon">{s.icon}</span>
              <div className="de-menu-text">
                <span className="de-menu-label">{s.label}</span>
                <span className="de-menu-desc">{s.desc}</span>
              </div>
              {s.key === "dc" && openCases.length > 0 && (
                <span className="de-menu-badge">{openCases.length}</span>
              )}
              {s.key === "today" && todayTotalCount > 0 && (
                <span className="de-menu-badge">{todayTotalCount}</span>
              )}
              <span className="de-menu-arrow">›</span>
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════ OPD / ER / Consult ══════════════════ */}
      {unlocked && activeSection === "opd" && (
        <div className="de-panel">
          {backBtn}
          <div className="de-panel-header" style={{ "--card-accent": "#2563eb" } as React.CSSProperties}>
            <span>🏥</span><h2>OPD / ER / Consult รายวัน</h2>
          </div>
          <form onSubmit={submitDaily} className="entry-form">
            <div className="field-group"><label>วันที่</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div className="field-grid-2">
              <div className="field-group"><label>จำนวน OPD</label><input type="number" min={0} value={opd} onChange={(e) => setOpd(Number(e.target.value))} required /></div>
              <div className="field-group"><label>จำนวน ER ผู้ป่วยนอก</label><input type="number" min={0} value={er} onChange={(e) => setEr(Number(e.target.value))} required /></div>
              <div className="field-group"><label>จำนวน Consult</label><input type="number" min={0} value={consult} onChange={(e) => setConsult(Number(e.target.value))} required /></div>
            </div>
            <button type="submit" className="de-submit-btn">บันทึก OPD / ER / Consult</button>
          </form>

          {(todayOpd.length > 0 || todayEr.length > 0 || todayCon.length > 0) && (
            <div className="de-today-mini">
              <h3>ข้อมูลที่กรอกวันนี้</h3>
              {todayOpd.map((r) => (
                <div key={r.id} className="de-row-item">
                  {editOpdId === r.id ? (
                    <><input type="number" min={0} value={editOpdVal} onChange={(e) => setEditOpdVal(Number(e.target.value))} style={{ width: 80 }} />
                      <button className="btn-sm" onClick={saveEditOpd}>💾</button>
                      <button className="btn-sm btn-secondary" onClick={() => setEditOpdId(null)}>ยกเลิก</button></>
                  ) : (
                    <><span className="de-row-badge" style={{ background: "#2563eb" }}>OPD</span><span>จำนวน: <strong>{r.count}</strong></span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditOpdId(r.id); setEditOpdVal(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("opd", r.id)}>ลบ</button></>
                  )}
                </div>
              ))}
              {todayEr.map((r) => (
                <div key={r.id} className="de-row-item">
                  {editErId === r.id ? (
                    <><input type="number" min={0} value={editErVal} onChange={(e) => setEditErVal(Number(e.target.value))} style={{ width: 80 }} />
                      <button className="btn-sm" onClick={saveEditEr}>💾</button>
                      <button className="btn-sm btn-secondary" onClick={() => setEditErId(null)}>ยกเลิก</button></>
                  ) : (
                    <><span className="de-row-badge" style={{ background: "#f97316" }}>ER</span><span>จำนวน: <strong>{r.count}</strong></span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditErId(r.id); setEditErVal(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("er", r.id)}>ลบ</button></>
                  )}
                </div>
              ))}
              {todayCon.map((r) => (
                <div key={r.id} className="de-row-item">
                  {editConId === r.id ? (
                    <><input type="number" min={0} value={editConVal} onChange={(e) => setEditConVal(Number(e.target.value))} style={{ width: 80 }} />
                      <button className="btn-sm" onClick={saveEditCon}>💾</button>
                      <button className="btn-sm btn-secondary" onClick={() => setEditConId(null)}>ยกเลิก</button></>
                  ) : (
                    <><span className="de-row-badge" style={{ background: "#0d9488" }}>Consult</span><span>จำนวน: <strong>{r.count}</strong></span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditConId(r.id); setEditConVal(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("consult", r.id)}>ลบ</button></>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ IPD Admit ══════════════════ */}
      {unlocked && activeSection === "admit" && (
        <div className="de-panel">
          {backBtn}
          <div className="de-panel-header" style={{ "--card-accent": "#d97706" } as React.CSSProperties}>
            <span>🛏️</span><h2>IPD Admit</h2>
          </div>
          <form onSubmit={submitAdmit} className="entry-form">
            <div className="field-grid-2">
              <div className="field-group"><label>HN</label><input placeholder="เลข HN" value={admitHn} onChange={(e) => setAdmitHn(e.target.value)} required /></div>
              <div className="field-group"><label>Ward</label>{wardSelect(admitWard, setAdmitWard)}</div>
            </div>
            {admitWard === "__other__" && <div className="field-group"><label>ชื่อ Ward</label><input placeholder="พิมพ์ชื่อ Ward" value={admitWardCustom} onChange={(e) => setAdmitWardCustom(e.target.value)} required /></div>}
            <div className="field-group"><label>วันที่ Admit</label><input type="date" value={admitDate} onChange={(e) => setAdmitDate(e.target.value)} required /></div>
            <button type="submit" className="de-submit-btn">บันทึก Admit</button>
          </form>

          {todayIpd.filter((r) => r.stayType !== "ao").length > 0 && (
            <div className="de-today-mini">
              <h3>Admit ที่กรอกวันนี้</h3>
              {todayIpd.filter((r) => r.stayType !== "ao").map((r) => (
                <div key={r.id} className="de-row-item">
                  <span className="de-row-badge" style={{ background: "#d97706" }}>Admit</span>
                  <span>HN: <strong>{r.hn}</strong></span>
                  <span style={{ color: "var(--muted)" }}>{r.ward}</span>
                  <button className="btn-sm btn-delete" onClick={() => delToday("ipd", r.id)}>ลบ</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ IPD A/O ══════════════════ */}
      {unlocked && activeSection === "ao" && (
        <div className="de-panel">
          {backBtn}
          <div className="de-panel-header" style={{ "--card-accent": "#0d9488" } as React.CSSProperties}>
            <span>🛏️</span><h2>IPD A/O</h2>
          </div>
          <form onSubmit={submitAo} className="entry-form">
            <div className="field-group"><label>Ward</label>{wardSelect(aoWard, setAoWard)}</div>
            {aoWard === "__other__" && <div className="field-group"><label>ชื่อ Ward</label><input placeholder="พิมพ์ชื่อ Ward" value={aoWardCustom} onChange={(e) => setAoWardCustom(e.target.value)} required /></div>}
            <div className="field-grid-2">
              <div className="field-group"><label>วันที่เข้า</label><input type="date" value={aoDate} onChange={(e) => setAoDate(e.target.value)} required /></div>
              <div className="field-group"><label>จำนวน (ราย)</label><input type="number" min={1} max={100} value={aoCount} onChange={(e) => setAoCount(Number(e.target.value) || 1)} /></div>
            </div>
            <button type="submit" className="de-submit-btn">บันทึก A/O</button>
          </form>

          {todayIpd.filter((r) => r.stayType === "ao").length > 0 && (
            <div className="de-today-mini">
              <h3>A/O ที่กรอกวันนี้</h3>
              {todayIpd.filter((r) => r.stayType === "ao").map((r) => (
                <div key={r.id} className="de-row-item">
                  <span className="de-row-badge" style={{ background: "#0d9488" }}>A/O</span>
                  <span>{r.ward}</span>
                  <span style={{ color: "var(--muted)" }}>Admit: {r.admitDate}</span>
                  <button className="btn-sm btn-delete" onClick={() => delToday("ipd", r.id)}>ลบ</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ D/C ══════════════════ */}
      {unlocked && activeSection === "dc" && (
        <div className="de-panel">
          {backBtn}
          <div className="de-panel-header" style={{ "--card-accent": "#16a34a" } as React.CSSProperties}>
            <span>✅</span><h2>D/C จำหน่ายผู้ป่วย</h2>
          </div>

          <div className="de-dc-form-row">
            <div className="field-group"><label>วันที่ D/C</label><input type="date" value={dcDate} onChange={(e) => setDcDate(e.target.value)} /></div>
            <div className="field-group" style={{ flex: "1 1 120px" }}><label>กรอก HN แล้วกดบันทึก</label><input placeholder="เลข HN" value={dcHn} onChange={(e) => setDcHn(e.target.value)} /></div>
            <button type="button" onClick={submitDcByForm} disabled={!dcHn.trim()} style={{ alignSelf: "flex-end" }}>บันทึก D/C</button>
          </div>

          {openCases.length > 0 && (() => {
            const dcFiltered = dcFilterWard === "__all__" ? openCases : openCases.filter((c) => c.ward === dcFilterWard);
            return (
              <div className="de-dc-open">
                <div className="de-dc-open-header">
                  <h3>ผู้ป่วยรอ D/C ({openCases.length} ราย)</h3>
                  <select className="ipd-ward-filter" value={dcFilterWard} onChange={(e) => setDcFilterWard(e.target.value)}>
                    <option value="__all__">ทุก Ward</option>
                    {[...new Set(openCases.map((c) => c.ward))].sort().map((w) => (
                      <option key={w} value={w}>{w} ({openCases.filter((c) => c.ward === w).length})</option>
                    ))}
                  </select>
                </div>
                {dcFilterWard !== "__all__" && (
                  <div style={{ fontSize: "0.85rem", color: "#166534", fontWeight: 600, marginBottom: 8 }}>
                    แสดง {dcFiltered.length} จาก {openCases.length} ราย (Ward: {dcFilterWard})
                  </div>
                )}
                {dcFiltered.length === 0 ? (
                  <p style={{ color: "var(--muted)", textAlign: "center", padding: 8 }}>ไม่มีผู้ป่วยใน Ward {dcFilterWard}</p>
                ) : (
                  <div className="de-dc-list">
                    {dcFiltered.map((c) => (
                      <div key={`${c.hn}-${c.admitDate}`} className="de-dc-item">
                        <button type="button" className="btn-sm" style={{ background: "#16a34a" }} onClick={() => doDc(c.hn)} title={`D/C วันที่ ${dcDate}`}>D/C</button>
                        <strong>{c.hn}</strong>
                        <span className="de-dc-ward">{c.ward}</span>
                        <span className="de-dc-date">Admit: {c.admitDate}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          {openCases.length === 0 && (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: 16 }}>ไม่มีผู้ป่วยรอ D/C</p>
          )}
        </div>
      )}

      {/* ══════════════════ หัตถการ ══════════════════ */}
      {unlocked && activeSection === "proc" && (
        <div className="de-panel">
          {backBtn}
          <div className="de-panel-header" style={{ "--card-accent": "#7c3aed" } as React.CSSProperties}>
            <span>🩺</span><h2>หัตถการเฉพาะ</h2>
          </div>
          <form onSubmit={submitProcedure} className="entry-form">
            <div className="field-grid-2">
              <div className="field-group"><label>วันที่</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
              <div className="field-group">
                <label>ทำที่ Ward</label>
                <select value={procWard} onChange={(e) => setProcWard(e.target.value)}>
                  {PROC_WARD_OPTIONS.map((w) => <option key={w} value={w}>{w === "__other__" ? "อื่นๆ (Consult นอกแผนก)" : w}</option>)}
                </select>
              </div>
              {procWard === "__other__" && (
                <div className="field-group">
                  <label>ระบุชื่อ Ward (Consult นอกแผนก)</label>
                  <input placeholder="เช่น ศัลยกรรม, สูตินรีเวช" value={procWardOther} onChange={(e) => setProcWardOther(e.target.value)} required />
                </div>
              )}
            </div>
            <div className="field-group">
              <label>หัตถการ</label>
              <select value={procKey} onChange={(e) => setProcKey(e.target.value)} required>
                <option value="">-- เลือก --</option>
                {PROCEDURE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            {procKey === "other" && <div className="field-group"><label>ระบุ (Other)</label><input placeholder="พิมพ์ชื่อหัตถการ" value={procLabel} onChange={(e) => setProcLabel(e.target.value)} /></div>}
            <div className="field-group"><label>จำนวนครั้ง</label><input type="number" min={1} value={procCount} onChange={(e) => setProcCount(Number(e.target.value) || 1)} /></div>
            <button type="submit" className="de-submit-btn">เพิ่มหัตถการ</button>
          </form>

          {todayProcedures.length > 0 && (
            <div className="de-today-mini">
              <h3>หัตถการที่กรอกวันนี้</h3>
              {todayProcedures.map((r) => (
                <div key={r.id} className="de-row-item">
                  <span className="de-row-badge" style={{ background: "#7c3aed" }}>หัตถการ</span>
                  <span>{getProcedureLabel(r)}</span>
                  <span className="de-dc-ward">{r.ward || "-"}</span>
                  <span><strong>{r.count}</strong> ครั้ง</span>
                  <button className="btn-sm btn-delete" onClick={() => delToday("procedure", r.id)}>ลบ</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ ข้อมูลวันนี้ ══════════════════ */}
      {unlocked && activeSection === "today" && (
        <div className="de-panel">
          {backBtn}
          <div className="de-panel-header" style={{ "--card-accent": "#dc2626" } as React.CSSProperties}>
            <span>📅</span><h2>ข้อมูลวันนี้ ({todayIso()})</h2>
          </div>

          {/* OPD */}
          {todayOpd.length > 0 && (
            <div className="de-today-group">
              <h3><span className="de-row-badge" style={{ background: "#2563eb" }}>OPD</span></h3>
              {todayOpd.map((r) => (
                <div key={r.id} className="de-row-item">
                  {editOpdId === r.id ? (
                    <><input type="number" min={0} value={editOpdVal} onChange={(e) => setEditOpdVal(Number(e.target.value))} style={{ width: 80 }} />
                      <button className="btn-sm" onClick={saveEditOpd}>💾</button><button className="btn-sm btn-secondary" onClick={() => setEditOpdId(null)}>ยกเลิก</button></>
                  ) : (
                    <><span>จำนวน: <strong>{r.count}</strong></span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditOpdId(r.id); setEditOpdVal(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("opd", r.id)}>ลบ</button></>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* ER */}
          {todayEr.length > 0 && (
            <div className="de-today-group">
              <h3><span className="de-row-badge" style={{ background: "#f97316" }}>ER</span></h3>
              {todayEr.map((r) => (
                <div key={r.id} className="de-row-item">
                  {editErId === r.id ? (
                    <><input type="number" min={0} value={editErVal} onChange={(e) => setEditErVal(Number(e.target.value))} style={{ width: 80 }} />
                      <button className="btn-sm" onClick={saveEditEr}>💾</button><button className="btn-sm btn-secondary" onClick={() => setEditErId(null)}>ยกเลิก</button></>
                  ) : (
                    <><span>จำนวน: <strong>{r.count}</strong></span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditErId(r.id); setEditErVal(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("er", r.id)}>ลบ</button></>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Consult */}
          {todayCon.length > 0 && (
            <div className="de-today-group">
              <h3><span className="de-row-badge" style={{ background: "#0d9488" }}>Consult</span></h3>
              {todayCon.map((r) => (
                <div key={r.id} className="de-row-item">
                  {editConId === r.id ? (
                    <><input type="number" min={0} value={editConVal} onChange={(e) => setEditConVal(Number(e.target.value))} style={{ width: 80 }} />
                      <button className="btn-sm" onClick={saveEditCon}>💾</button><button className="btn-sm btn-secondary" onClick={() => setEditConId(null)}>ยกเลิก</button></>
                  ) : (
                    <><span>จำนวน: <strong>{r.count}</strong></span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditConId(r.id); setEditConVal(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("consult", r.id)}>ลบ</button></>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* IPD */}
          {todayIpd.length > 0 && (
            <div className="de-today-group">
              <h3><span className="de-row-badge" style={{ background: "#d97706" }}>IPD Admit / A/O</span></h3>
              {todayIpd.map((r) => {
                const isAo = r.stayType === "ao";
                return (
                  <div key={r.id} className="de-row-item" style={{ flexWrap: "wrap" }}>
                    {editIpdId === r.id ? (
                      <>
                        {!isAo && <input placeholder="HN" value={editIpdForm.hn} onChange={(e) => setEditIpdForm({ ...editIpdForm, hn: e.target.value })} style={{ width: 100 }} />}
                        {isAo && <span style={{ color: "var(--muted)" }}>A/O</span>}
                        <select value={editIpdForm.ward} onChange={(e) => { setEditIpdForm({ ...editIpdForm, ward: e.target.value }); if (e.target.value !== "__other__") setEditIpdWardCustom(""); }} style={{ width: 120 }}>
                          {wards.map((w) => <option key={w} value={w}>{w === "__other__" ? "Other (พิมพ์เอง)" : w}</option>)}
                        </select>
                        {editIpdForm.ward === "__other__" && <input placeholder="ชื่อ Ward" value={editIpdWardCustom} onChange={(e) => setEditIpdWardCustom(e.target.value)} style={{ width: 100 }} />}
                        <button className="btn-sm" onClick={saveEditIpd}>💾</button><button className="btn-sm btn-secondary" onClick={() => setEditIpdId(null)}>ยกเลิก</button>
                      </>
                    ) : (
                      <>
                        <span>{isAo ? "A/O" : `HN: ${r.hn}`}</span>
                        <span style={{ color: "var(--muted)" }}>{r.ward}</span>
                        <button className="btn-sm btn-edit" onClick={() => { setEditIpdId(r.id); setEditIpdForm({ hn: isAo ? "" : r.hn, ward: r.ward, stayType: isAo ? "ao" : "admit" }); }}>แก้ไข</button>
                        <button className="btn-sm btn-delete" onClick={() => delToday("ipd", r.id)}>ลบ</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Procedures */}
          {todayProcedures.length > 0 && (
            <div className="de-today-group">
              <h3><span className="de-row-badge" style={{ background: "#7c3aed" }}>หัตถการ</span></h3>
              {todayProcedures.map((r) => (
                <div key={r.id} className="de-row-item" style={{ flexWrap: "wrap" }}>
                  {editProcId === r.id ? (
                    <>
                      <select value={editProcKey} onChange={(e) => setEditProcKey(e.target.value)} style={{ width: 180 }}>
                        {PROCEDURE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                      {editProcKey === "other" && <input placeholder="ระบุ" value={editProcLabel} onChange={(e) => setEditProcLabel(e.target.value)} style={{ width: 120 }} />}
                      <input type="number" min={1} value={editProcCount} onChange={(e) => setEditProcCount(Number(e.target.value) || 1)} style={{ width: 60 }} />
                      <button className="btn-sm" onClick={saveEditProc}>💾</button><button className="btn-sm btn-secondary" onClick={() => setEditProcId(null)}>ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <span>{getProcedureLabel(r)}</span>
                      <span className="de-dc-ward">{r.ward || "-"}</span>
                      <span><strong>{r.count}</strong> ครั้ง</span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditProcId(r.id); setEditProcKey(r.procedureKey); setEditProcLabel(r.procedureLabel || ""); setEditProcCount(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("procedure", r.id)}>ลบ</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {todayTotalCount === 0 && (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: 24 }}>ยังไม่มีข้อมูลที่กรอกวันนี้</p>
          )}
        </div>
      )}
    </section>
  );
}
