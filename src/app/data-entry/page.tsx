"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  addIpdAdmit, addIpdDischarge, addStatsRow,
  getIpdOpenCases, getTodayEntries, updateTodayRow, deleteTodayRow,
  IpdOpenCase, OpdAdminItem, ConsultAdminItem, IpdAdminItem,
} from "@/lib/api";

const wards = ["MED1", "MED2", "IMC", "Palliative", "ward90", "ICU"];
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function DataEntryPage() {
  const [code, setCode] = useState("");
  const [date, setDate] = useState(todayIso());
  const [opd, setOpd] = useState(0);
  const [consult, setConsult] = useState(0);
  const [admitHn, setAdmitHn] = useState("");
  const [admitWard, setAdmitWard] = useState(wards[0]);
  const [admitDate, setAdmitDate] = useState(todayIso());
  const [dcHn, setDcHn] = useState("");
  const [dcDate, setDcDate] = useState(todayIso());
  const [openCases, setOpenCases] = useState<IpdOpenCase[]>([]);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  const [todayOpd, setTodayOpd] = useState<OpdAdminItem[]>([]);
  const [todayCon, setTodayCon] = useState<ConsultAdminItem[]>([]);
  const [todayIpd, setTodayIpd] = useState<IpdAdminItem[]>([]);
  const [editOpdId, setEditOpdId] = useState<number | null>(null);
  const [editOpdVal, setEditOpdVal] = useState(0);
  const [editConId, setEditConId] = useState<number | null>(null);
  const [editConVal, setEditConVal] = useState(0);
  const [editIpdId, setEditIpdId] = useState<number | null>(null);
  const [editIpdForm, setEditIpdForm] = useState({ hn: "", ward: wards[0] });

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
      setTodayCon(res.consult || []);
      setTodayIpd(res.ipd || []);
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (code.length >= 3) {
      loadOpenCases(code);
      loadToday(code);
    }
  }, [code]);

  async function submitDaily(e: FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await addStatsRow({ code, sheetName: "OPD", date, count: Number(opd) || 0 });
      await addStatsRow({ code, sheetName: "Consult", date, count: Number(consult) || 0 });
      flash("บันทึก OPD/Consult สำเร็จ");
      await loadToday(code);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitAdmit(e: FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      await addIpdAdmit({ code, hn: admitHn, ward: admitWard, admitDate });
      setAdmitHn("");
      flash("บันทึก Admit สำเร็จ");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
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

  async function saveEditOpd() {
    if (editOpdId === null) return;
    try {
      await updateTodayRow({ code, sheetType: "opd", rowId: String(editOpdId), count: editOpdVal });
      setEditOpdId(null); flash("แก้ไข OPD สำเร็จ"); await loadToday(code);
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

  const hasTodayData = todayOpd.length > 0 || todayCon.length > 0 || todayIpd.length > 0;

  return (
    <section className="entry-section">
      <div className="page-header">
        <h1>📝 กรอกข้อมูลผู้ป่วย</h1>
        <p>HN แสดงเฉพาะหน้านี้ — กรอกวันนี้แล้วแก้ไขได้ทันที พรุ่งนี้จะแก้ไม่ได้แล้ว</p>
      </div>

      <div className="entry-card" style={{ maxWidth: 400, marginBottom: 16 }}>
        <div className="field-group">
          <label>🔑 รหัสหน่วยงาน (Unit Code)</label>
          <input type="password" placeholder="ใส่รหัสเพื่อกรอกข้อมูล" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
      </div>

      {msg && <div className={`entry-msg ${msgType}`}>{msg}</div>}

      <div className="entry-grid">
        {/* OPD / Consult */}
        <div className="entry-card">
          <div className="entry-card-header"><span className="entry-card-icon">🏥</span><h2>OPD / Consult รายวัน</h2></div>
          <form onSubmit={submitDaily} className="entry-form">
            <div className="field-group"><label>วันที่</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
            <div className="field-grid-2">
              <div className="field-group"><label>จำนวน OPD</label><input type="number" min={0} placeholder="เช่น 23" value={opd} onChange={(e) => setOpd(Number(e.target.value))} required /></div>
              <div className="field-group"><label>จำนวน Consult</label><input type="number" min={0} placeholder="เช่น 2" value={consult} onChange={(e) => setConsult(Number(e.target.value))} required /></div>
            </div>
            <button type="submit" style={{ justifySelf: "start" }}>บันทึก OPD/Consult</button>
          </form>
        </div>

        {/* IPD Admit */}
        <div className="entry-card">
          <div className="entry-card-header"><span className="entry-card-icon">🛏️</span><h2>IPD Admit</h2></div>
          <form onSubmit={submitAdmit} className="entry-form">
            <div className="field-grid-2">
              <div className="field-group"><label>HN</label><input placeholder="เลข HN" value={admitHn} onChange={(e) => setAdmitHn(e.target.value)} required /></div>
              <div className="field-group"><label>Ward</label>
                <select value={admitWard} onChange={(e) => setAdmitWard(e.target.value)}>
                  {wards.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
            <div className="field-group"><label>วันที่ Admit</label><input type="date" value={admitDate} onChange={(e) => setAdmitDate(e.target.value)} required /></div>
            <button type="submit" style={{ justifySelf: "start" }}>บันทึก Admit</button>
          </form>
        </div>

        {/* IPD D/C */}
        <div className="entry-card">
          <div className="entry-card-header"><span className="entry-card-icon">✅</span><h2>IPD Discharge (D/C)</h2></div>
          <form onSubmit={submitDischarge} className="entry-form">
            <div className="field-grid-2">
              <div className="field-group"><label>HN ที่ D/C</label><input placeholder="เลข HN" value={dcHn} onChange={(e) => setDcHn(e.target.value)} required /></div>
              <div className="field-group"><label>วันที่ D/C</label><input type="date" value={dcDate} onChange={(e) => setDcDate(e.target.value)} required /></div>
            </div>
            <button type="submit" style={{ justifySelf: "start" }}>บันทึก D/C</button>
          </form>
          {openCases.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>ผู้ป่วยค้างใน Ward ({openCases.length})</h3>
              <div className="open-case-list">
                {openCases.map((c) => (
                  <div key={`${c.hn}-${c.admitDate}`} className="open-case-item">
                    <button type="button" onClick={() => setDcHn(c.hn)}>เลือก</button>
                    <strong>{c.hn}</strong>
                    <span style={{ color: "var(--muted)" }}>{c.ward}</span>
                    <span style={{ color: "var(--muted)" }}>Admit: {c.admitDate}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ═══ ข้อมูลที่กรอกวันนี้ ═══ */}
        {hasTodayData && (
          <div className="entry-card" style={{ border: "2px solid #93c5fd" }}>
            <div className="entry-card-header"><span className="entry-card-icon">📅</span><h2>ข้อมูลที่กรอกวันนี้ ({todayIso()}) — แก้ไข/ลบได้</h2></div>

            {/* Today OPD */}
            {todayOpd.length > 0 && (
              <>
                <h3 style={{ fontSize: "0.95rem", color: "var(--primary)" }}>OPD</h3>
                {todayOpd.map((r) => (
                  <div key={r.id} className="open-case-item">
                    {editOpdId === r.id ? (
                      <>
                        <input type="number" min={0} value={editOpdVal} onChange={(e) => setEditOpdVal(Number(e.target.value))} style={{ width: 80 }} />
                        <button className="btn-sm" onClick={saveEditOpd}>💾</button>
                        <button className="btn-sm btn-secondary" onClick={() => setEditOpdId(null)}>ยกเลิก</button>
                      </>
                    ) : (
                      <>
                        <span>จำนวน: <strong>{r.count}</strong></span>
                        <button className="btn-sm btn-edit" onClick={() => { setEditOpdId(r.id); setEditOpdVal(r.count); }}>แก้ไข</button>
                        <button className="btn-sm btn-delete" onClick={() => delToday("opd", r.id)}>ลบ</button>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Today Consult */}
            {todayCon.length > 0 && (
              <>
                <h3 style={{ fontSize: "0.95rem", color: "#0d9488" }}>Consult</h3>
                {todayCon.map((r) => (
                  <div key={r.id} className="open-case-item">
                    {editConId === r.id ? (
                      <>
                        <input type="number" min={0} value={editConVal} onChange={(e) => setEditConVal(Number(e.target.value))} style={{ width: 80 }} />
                        <button className="btn-sm" onClick={saveEditCon}>💾</button>
                        <button className="btn-sm btn-secondary" onClick={() => setEditConId(null)}>ยกเลิก</button>
                      </>
                    ) : (
                      <>
                        <span>จำนวน: <strong>{r.count}</strong></span>
                        <button className="btn-sm btn-edit" onClick={() => { setEditConId(r.id); setEditConVal(r.count); }}>แก้ไข</button>
                        <button className="btn-sm btn-delete" onClick={() => delToday("consult", r.id)}>ลบ</button>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* Today IPD */}
            {todayIpd.length > 0 && (
              <>
                <h3 style={{ fontSize: "0.95rem", color: "#d97706" }}>IPD Admit วันนี้</h3>
                {todayIpd.map((r) => (
                  <div key={r.id} className="open-case-item" style={{ flexWrap: "wrap" }}>
                    {editIpdId === r.id ? (
                      <>
                        <input placeholder="HN" value={editIpdForm.hn} onChange={(e) => setEditIpdForm({ ...editIpdForm, hn: e.target.value })} style={{ width: 100 }} />
                        <select value={editIpdForm.ward} onChange={(e) => setEditIpdForm({ ...editIpdForm, ward: e.target.value })} style={{ width: 100 }}>
                          {wards.map((w) => <option key={w} value={w}>{w}</option>)}
                        </select>
                        <button className="btn-sm" onClick={saveEditIpd}>💾</button>
                        <button className="btn-sm btn-secondary" onClick={() => setEditIpdId(null)}>ยกเลิก</button>
                      </>
                    ) : (
                      <>
                        <span>HN: <strong>{r.hn}</strong></span>
                        <span style={{ color: "var(--muted)" }}>{r.ward}</span>
                        <button className="btn-sm btn-edit" onClick={() => { setEditIpdId(r.id); setEditIpdForm({ hn: r.hn, ward: r.ward }); }}>แก้ไข</button>
                        <button className="btn-sm btn-delete" onClick={() => delToday("ipd", r.id)}>ลบ</button>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
