"use client";

import { FormEvent, useState } from "react";
import {
  addIpdAdmit, addIpdDischarge, addStatsRow, addProcedure,
  getIpdOpenCases, getTodayEntries, updateTodayRow, deleteTodayRow,
  IpdOpenCase, OpdAdminItem, ErAdminItem, ConsultAdminItem, IpdAdminItem, ProcedureAdminItem,
  PROCEDURE_OPTIONS,
} from "@/lib/api";

const wards = ["MED1", "MED2", "IMC", "Palliative", "ward90", "ICU"];
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function DataEntryPage() {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [date, setDate] = useState(todayIso());
  const [opd, setOpd] = useState(0);
  const [er, setEr] = useState(0);
  const [consult, setConsult] = useState(0);
  const [admitHn, setAdmitHn] = useState("");
  const [admitWard, setAdmitWard] = useState(wards[0]);
  const [admitDate, setAdmitDate] = useState(todayIso());
  const [aoWard, setAoWard] = useState(wards[0]);
  const [aoDate, setAoDate] = useState(todayIso());
  const [aoCount, setAoCount] = useState(1);
  const [dcHn, setDcHn] = useState("");
  const [dcDate, setDcDate] = useState(todayIso());
  const [openCases, setOpenCases] = useState<IpdOpenCase[]>([]);
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

  function flash(text: string, type: "success" | "error" = "success") {
    setMsg(text);
    setMsgType(type);
    if (type === "success") setTimeout(() => setMsg(""), 4000);
  }

  async function loadOpenCases(c: string) {
    if (!c) return;
    try { const res = await getIpdOpenCases(c); setOpenCases(res.rows || []); } catch { setOpenCases([]); }
  }

  async function loadToday(c: string) {
    if (!c) return;
    try {
      const res = await getTodayEntries(c, todayIso());
      setTodayOpd(res.opd || []);
      setTodayEr(res.er || []);
      setTodayCon(res.consult || []);
      setTodayIpd(res.ipd || []);
      setTodayProcedures(res.procedures || []);
    } catch { /* ignore */ }
  }

  async function unlockWithCode(e?: FormEvent) {
    e?.preventDefault();
    const c = code.trim();
    if (!c) { flash("กรุณากรอกรหัสหน่วยงาน", "error"); return; }
    setVerifying(true);
    setMsg("");
    try {
      await getTodayEntries(c, todayIso());
      setUnlocked(true);
      await Promise.all([loadOpenCases(c), loadToday(c)]);
      flash("ยืนยันรหัสสำเร็จ — สามารถดูและแก้ไขข้อมูลได้");
    } catch (err) {
      flash((err as Error).message || "รหัสไม่ถูกต้อง กรุณาลองใหม่", "error");
    } finally {
      setVerifying(false);
    }
  }

  async function submitDaily(e: FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await addStatsRow({ code, sheetName: "OPD", date, count: Number(opd) || 0 });
      await addStatsRow({ code, sheetName: "ER", date, count: Number(er) || 0 });
      await addStatsRow({ code, sheetName: "Consult", date, count: Number(consult) || 0 });
      flash("บันทึก OPD / ER / Consult สำเร็จ");
      await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitAdmit(e: FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await addIpdAdmit({ code, hn: admitHn, ward: admitWard, admitDate, stayType: "admit" });
      setAdmitHn("");
      flash("บันทึก Admit สำเร็จ");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitAo(e: FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await addIpdAdmit({ code, stayType: "ao", ward: aoWard, admitDate: aoDate, count: aoCount });
      flash(`บันทึก A/O ${aoCount} ราย สำเร็จ`);
      await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitDischarge(e: FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await addIpdDischarge({ code, hn: dcHn, dischargeDate: dcDate });
      setDcHn("");
      flash("บันทึก D/C สำเร็จ");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitProcedure(e: FormEvent) {
    e.preventDefault(); setMsg("");
    if (!procKey) { flash("เลือกประเภทหัตถการ", "error"); return; }
    try {
      await addProcedure({
        code,
        date,
        procedureKey: procKey,
        procedureLabel: procKey === "other" ? procLabel : undefined,
        count: procCount,
      });
      setProcKey(""); setProcLabel(""); setProcCount(1);
      flash("บันทึกหัตถการสำเร็จ");
      await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function saveEditProc() {
    if (editProcId === null) return;
    try {
      await updateTodayRow({
        code,
        sheetType: "procedure",
        rowId: String(editProcId),
        procedureKey: editProcKey,
        procedureLabel: editProcKey === "other" ? editProcLabel : "",
        count: editProcCount,
      });
      setEditProcId(null);
      flash("แก้ไขหัตถการสำเร็จ");
      await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function saveEditOpd() {
    if (editOpdId === null) return;
    try {
      await updateTodayRow({ code, sheetType: "opd", rowId: String(editOpdId), count: editOpdVal });
      setEditOpdId(null); flash("แก้ไข OPD สำเร็จ"); await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function saveEditEr() {
    if (editErId === null) return;
    try {
      await updateTodayRow({ code, sheetType: "er", rowId: String(editErId), count: editErVal });
      setEditErId(null); flash("แก้ไข ER สำเร็จ"); await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function saveEditCon() {
    if (editConId === null) return;
    try {
      await updateTodayRow({ code, sheetType: "consult", rowId: String(editConId), count: editConVal });
      setEditConId(null); flash("แก้ไข Consult สำเร็จ"); await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function saveEditIpd() {
    if (editIpdId === null) return;
    try {
      await updateTodayRow({ code, sheetType: "ipd", rowId: String(editIpdId), ...editIpdForm });
      setEditIpdId(null); flash("แก้ไข IPD สำเร็จ"); await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function delToday(type: string, id: number) {
    if (!confirm("ต้องการลบรายการนี้?")) return;
    try {
      await deleteTodayRow({ code, sheetType: type, rowId: String(id) });
      flash("ลบสำเร็จ"); await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  function procedureLabel(item: ProcedureAdminItem): string {
    if (item.procedureKey === "other") return item.procedureLabel ? `Other: ${item.procedureLabel}` : "Other";
    const opt = PROCEDURE_OPTIONS.find((o) => o.key === item.procedureKey);
    return opt?.label ?? item.procedureKey;
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
    if (!dcHn.trim()) return;
    setMsg("");
    try {
      await addIpdDischarge({ code, hn: dcHn.trim(), dischargeDate: dcDate });
      setDcHn("");
      flash("บันทึก D/C สำเร็จ");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  return (
    <section className="entry-section">
      <div className="page-header">
        <h1>📝 กรอกข้อมูลผู้ป่วย</h1>
        <p>HN แสดงเฉพาะหน้านี้ — กรอกวันนี้แล้วแก้ไขได้ทันที พรุ่งนี้จะแก้ไม่ได้แล้ว</p>
      </div>

      <div className="entry-card" style={{ maxWidth: 480, marginBottom: 16 }}>
        <form onSubmit={unlockWithCode} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field-group" style={{ flex: "1 1 200px" }}>
            <label>🔑 รหัสหน่วยงาน (Unit Code)</label>
            <input type="password" placeholder="ใส่รหัสเพื่อดูและแก้ไขข้อมูล" value={code} onChange={(e) => setCode(e.target.value)} disabled={unlocked} />
          </div>
          {!unlocked ? (
            <button type="submit" disabled={verifying} style={{ minHeight: 42 }}>
              {verifying ? "กำลังตรวจสอบ..." : "ยืนยันรหัส"}
            </button>
          ) : (
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>✓ เปิดใช้งานแล้ว</span>
          )}
        </form>
      </div>

      {msg && <div className={`entry-msg ${msgType}`} style={{ maxWidth: 600 }}>{msg}</div>}

      {!unlocked && (
        <p style={{ color: "var(--muted)", marginTop: 8 }}>กรอกรหัสหน่วยงานแล้วกดปุ่ม &quot;ยืนยันรหัส&quot; เพื่อดูและแก้ไขข้อมูล OPD / ER / Consult / IPD / หัตถการ</p>
      )}

      {unlocked && (
      <div className="entry-grid" style={{ gap: 12 }}>
        {/* ═══ HN ที่รอ D/C + D/C ═══ */}
        <div className="entry-card" style={{ gridColumn: "1 / -1" }}>
          <div className="entry-card-header"><span className="entry-card-icon">✅</span><h2>HN ที่รอ D/C — คลิกปุ่ม D/C ได้เลย</h2></div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: openCases.length > 0 ? 16 : 0 }}>
            <div className="field-group"><label>วันที่ D/C</label><input type="date" value={dcDate} onChange={(e) => setDcDate(e.target.value)} /></div>
            <div className="field-group" style={{ flex: "1 1 120px" }}><label>หรือกรอก HN แล้วกดบันทึก</label><input placeholder="เลข HN" value={dcHn} onChange={(e) => setDcHn(e.target.value)} /></div>
            <button type="button" onClick={submitDcByForm} disabled={!dcHn.trim()}>บันทึก D/C</button>
          </div>
          {openCases.length > 0 ? (
            <div className="open-case-list">
              {openCases.map((c) => (
                <div key={`${c.hn}-${c.admitDate}`} className="open-case-item">
                  <button type="button" className="btn-sm" onClick={() => doDc(c.hn)} title={`D/C วันที่ ${dcDate}`}>D/C</button>
                  <strong>{c.hn}</strong>
                  <span style={{ color: "var(--muted)" }}>{c.ward}</span>
                  <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Admit: {c.admitDate}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-empty" style={{ margin: 0 }}>ไม่มีผู้ป่วยค้างใน Ward</p>
          )}
        </div>

        {/* OPD / ER / Consult รายวัน + ข้อมูลวันนี้ */}
        <div className="entry-card">
          <div className="entry-card-header"><span className="entry-card-icon">🏥</span><h2>OPD / ER / Consult รายวัน</h2></div>
          <form onSubmit={submitDaily} className="entry-form">
            <div className="field-group"><label>วันที่</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div className="field-grid-2">
              <div className="field-group"><label>จำนวน OPD</label><input type="number" min={0} value={opd} onChange={(e) => setOpd(Number(e.target.value))} required /></div>
              <div className="field-group"><label>จำนวน ER ผู้ป่วยนอก</label><input type="number" min={0} value={er} onChange={(e) => setEr(Number(e.target.value))} required /></div>
              <div className="field-group"><label>จำนวน Consult</label><input type="number" min={0} value={consult} onChange={(e) => setConsult(Number(e.target.value))} required /></div>
            </div>
            <button type="submit" style={{ justifySelf: "start" }}>บันทึก OPD / ER / Consult</button>
          </form>
          {todayOpd.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem", color: "var(--primary)", marginTop: 12 }}>OPD วันนี้ — แก้ไขได้</h3>
              {todayOpd.map((r) => (
                <div key={r.id} className="open-case-item">
                  {editOpdId === r.id ? (
                    <><input type="number" min={0} value={editOpdVal} onChange={(e) => setEditOpdVal(Number(e.target.value))} style={{ width: 80 }} />
                      <button className="btn-sm" onClick={saveEditOpd}>💾</button>
                      <button className="btn-sm btn-secondary" onClick={() => setEditOpdId(null)}>ยกเลิก</button></>
                  ) : (
                    <><span>จำนวน: <strong>{r.count}</strong></span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditOpdId(r.id); setEditOpdVal(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("opd", r.id)}>ลบ</button></>
                  )}
                </div>
              ))}
            </>
          )}
          {todayEr.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem", color: "#f97316", marginTop: 12 }}>ER ผู้ป่วยนอก วันนี้</h3>
              {todayEr.map((r) => (
                <div key={r.id} className="open-case-item">
                  {editErId === r.id ? (
                    <><input type="number" min={0} value={editErVal} onChange={(e) => setEditErVal(Number(e.target.value))} style={{ width: 80 }} />
                      <button className="btn-sm" onClick={saveEditEr}>💾</button>
                      <button className="btn-sm btn-secondary" onClick={() => setEditErId(null)}>ยกเลิก</button></>
                  ) : (
                    <><span>จำนวน: <strong>{r.count}</strong></span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditErId(r.id); setEditErVal(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("er", r.id)}>ลบ</button></>
                  )}
                </div>
              ))}
            </>
          )}
          {todayCon.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem", color: "#0d9488", marginTop: 12 }}>Consult วันนี้</h3>
              {todayCon.map((r) => (
                <div key={r.id} className="open-case-item">
                  {editConId === r.id ? (
                    <><input type="number" min={0} value={editConVal} onChange={(e) => setEditConVal(Number(e.target.value))} style={{ width: 80 }} />
                      <button className="btn-sm" onClick={saveEditCon}>💾</button>
                      <button className="btn-sm btn-secondary" onClick={() => setEditConId(null)}>ยกเลิก</button></>
                  ) : (
                    <><span>จำนวน: <strong>{r.count}</strong></span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditConId(r.id); setEditConVal(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("consult", r.id)}>ลบ</button></>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* IPD Admit + A/O + หัตถการ (อยู่ใกล้กัน) */}
        <div className="entry-card">
          <div className="entry-card-header"><span className="entry-card-icon">🛏️</span><h2>IPD Admit</h2></div>
          <form onSubmit={submitAdmit} className="entry-form">
            <div className="field-grid-2">
              <div className="field-group"><label>HN</label><input placeholder="เลข HN" value={admitHn} onChange={(e) => setAdmitHn(e.target.value)} required /></div>
              <div className="field-group"><label>Ward</label><select value={admitWard} onChange={(e) => setAdmitWard(e.target.value)}>{wards.map((w) => <option key={w} value={w}>{w}</option>)}</select></div>
            </div>
            <div className="field-group"><label>วันที่ Admit</label><input type="date" value={admitDate} onChange={(e) => setAdmitDate(e.target.value)} required /></div>
            <button type="submit" style={{ justifySelf: "start" }}>บันทึก Admit</button>
          </form>
        </div>
        <div className="entry-card">
          <div className="entry-card-header"><span className="entry-card-icon">🛏️</span><h2>IPD A/O</h2></div>
          <form onSubmit={submitAo} className="entry-form">
            <div className="field-group"><label>Ward</label><select value={aoWard} onChange={(e) => setAoWard(e.target.value)}>{wards.map((w) => <option key={w} value={w}>{w}</option>)}</select></div>
            <div className="field-grid-2">
              <div className="field-group"><label>วันที่เข้า</label><input type="date" value={aoDate} onChange={(e) => setAoDate(e.target.value)} required /></div>
              <div className="field-group"><label>จำนวน (ราย)</label><input type="number" min={1} max={100} value={aoCount} onChange={(e) => setAoCount(Number(e.target.value) || 1)} /></div>
            </div>
            <button type="submit" style={{ justifySelf: "start" }}>บันทึก A/O</button>
          </form>
        </div>
        <div className="entry-card">
          <div className="entry-card-header"><span className="entry-card-icon">🩺</span><h2>หัตถการเฉพาะ</h2></div>
          <form onSubmit={submitProcedure} className="entry-form">
            <div className="field-group"><label>วันที่</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div className="field-group">
              <label>หัตถการ</label>
              <select value={procKey} onChange={(e) => setProcKey(e.target.value)} required>
                <option value="">-- เลือก --</option>
                {PROCEDURE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            {procKey === "other" && <div className="field-group"><label>ระบุ (Other)</label><input placeholder="พิมพ์ชื่อหัตถการ" value={procLabel} onChange={(e) => setProcLabel(e.target.value)} /></div>}
            <div className="field-group"><label>จำนวนครั้ง</label><input type="number" min={1} value={procCount} onChange={(e) => setProcCount(Number(e.target.value) || 1)} /></div>
            <button type="submit" style={{ justifySelf: "start" }}>เพิ่มหัตถการ</button>
          </form>
        </div>

        {/* ข้อมูลวันนี้: IPD + หัตถการ (อยู่ใกล้กับฟอร์มด้านบน) */}
        <div className="entry-card" style={{ gridColumn: "1 / -1", border: "2px solid #93c5fd" }}>
          <div className="entry-card-header"><span className="entry-card-icon">📅</span><h2>ข้อมูลที่กรอกวันนี้ ({todayIso()}) — IPD / หัตถการ แก้ไขหรือลบได้</h2></div>
          {todayIpd.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem", color: "#d97706", marginTop: 8 }}>IPD Admit / A/O วันนี้</h3>
              {todayIpd.map((r) => {
                const isAo = r.stayType === "ao";
                return (
                  <div key={r.id} className="open-case-item" style={{ flexWrap: "wrap" }}>
                    {editIpdId === r.id ? (
                      <>
                        {!isAo && <input placeholder="HN" value={editIpdForm.hn} onChange={(e) => setEditIpdForm({ ...editIpdForm, hn: e.target.value })} style={{ width: 100 }} />}
                        {isAo && <span style={{ color: "var(--muted)", marginRight: 8 }}>A/O</span>}
                        <select value={editIpdForm.ward} onChange={(e) => setEditIpdForm({ ...editIpdForm, ward: e.target.value })} style={{ width: 100 }}>
                          {wards.map((w) => <option key={w} value={w}>{w}</option>)}
                        </select>
                        <button className="btn-sm" onClick={saveEditIpd}>💾</button>
                        <button className="btn-sm btn-secondary" onClick={() => setEditIpdId(null)}>ยกเลิก</button>
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
            </>
          )}
          {todayProcedures.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem", color: "#7c3aed", marginTop: 12 }}>หัตถการเฉพาะ วันนี้</h3>
              {todayProcedures.map((r) => (
                <div key={r.id} className="open-case-item" style={{ flexWrap: "wrap" }}>
                  {editProcId === r.id ? (
                    <>
                      <select value={editProcKey} onChange={(e) => setEditProcKey(e.target.value)} style={{ width: 180 }}>
                        {PROCEDURE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                      {editProcKey === "other" && <input placeholder="ระบุ" value={editProcLabel} onChange={(e) => setEditProcLabel(e.target.value)} style={{ width: 120 }} />}
                      <input type="number" min={1} value={editProcCount} onChange={(e) => setEditProcCount(Number(e.target.value) || 1)} style={{ width: 60 }} />
                      <button className="btn-sm" onClick={saveEditProc}>💾</button>
                      <button className="btn-sm btn-secondary" onClick={() => setEditProcId(null)}>ยกเลิก</button>
                    </>
                  ) : (
                    <>
                      <span>{procedureLabel(r)}</span>
                      <span><strong>{r.count}</strong> ครั้ง</span>
                      <button className="btn-sm btn-edit" onClick={() => { setEditProcId(r.id); setEditProcKey(r.procedureKey); setEditProcLabel(r.procedureLabel || ""); setEditProcCount(r.count); }}>แก้ไข</button>
                      <button className="btn-sm btn-delete" onClick={() => delToday("procedure", r.id)}>ลบ</button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
          {todayIpd.length === 0 && todayProcedures.length === 0 && (
            <p style={{ color: "var(--muted)", margin: 0 }}>ยังไม่มี IPD หรือหัตถการที่กรอกวันนี้ (OPD/ER/Consult แสดงในบัตรด้านบน)</p>
          )}
        </div>
      </div>
      )}
    </section>
  );
}
