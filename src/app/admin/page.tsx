"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ActivityItem,
  EncouragementItem,
  OpdAdminItem,
  ErAdminItem,
  ConsultAdminItem,
  IpdAdminItem,
  IpdOpenItem,
  ProcedureAdminItem,
  PROCEDURE_OPTIONS,
  addActivity,
  deleteRow,
  getActivitiesAdmin,
  getEncouragementAdmin,
  getPatientDataAdmin,
  updateRow,
} from "@/lib/api";
import LoadingOverlay from "@/components/LoadingOverlay";

type Tab = "patients" | "activities" | "encouragement" | "sheets";
const wards = ["MED1", "MED2", "IMC", "Palliative", "ward90", "ICU"];

export default function AdminPage() {
  const [adminCode, setAdminCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("patients");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [encouragement, setEncouragement] = useState<EncouragementItem[]>([]);

  // Patient tab
  const [ipdOpen, setIpdOpen] = useState<IpdOpenItem[]>([]);
  const [searchDate, setSearchDate] = useState("");
  const [searchOpd, setSearchOpd] = useState<OpdAdminItem[]>([]);
  const [searchEr, setSearchEr] = useState<ErAdminItem[]>([]);
  const [searchCon, setSearchCon] = useState<ConsultAdminItem[]>([]);
  const [searchIpd, setSearchIpd] = useState<IpdAdminItem[]>([]);
  const [searchProcedures, setSearchProcedures] = useState<ProcedureAdminItem[]>([]);
  const [searched, setSearched] = useState(false);

  // Activity form
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), title: "", detail: "", type: "OPD", imageUrl: "", imageCaption: "", youtubeUrl: "", externalUrl: "" });
  const [editingAct, setEditingAct] = useState<ActivityItem | null>(null);
  const [editingEnc, setEditingEnc] = useState<EncouragementItem | null>(null);
  const [editEncMsg, setEditEncMsg] = useState("");

  // Patient inline edit
  const [editIpd, setEditIpd] = useState<IpdAdminItem | null>(null);
  const [eIpdForm, setEIpdForm] = useState({ hn: "", ward: wards[0], admitDate: "", dischargeDate: "", stayType: "admit" as "admit" | "ao" });
  const [editProcedure, setEditProcedure] = useState<ProcedureAdminItem | null>(null);
  const [eProcForm, setEProcForm] = useState({ date: "", procedureKey: "", procedureLabel: "", count: 1 });
  const [editOpd, setEditOpd] = useState<OpdAdminItem | null>(null);
  const [eOpdForm, setEOpdForm] = useState({ date: "", count: 0 });
  const [editEr, setEditEr] = useState<ErAdminItem | null>(null);
  const [eErForm, setEErForm] = useState({ date: "", count: 0 });
  const [editCon, setEditCon] = useState<ConsultAdminItem | null>(null);
  const [eConForm, setEConForm] = useState({ date: "", count: 0 });

  const [showIpdOpen, setShowIpdOpen] = useState(true);
  const [filterWard, setFilterWard] = useState("__all__");

  const loadedRef = useRef(false);

  async function loadBase(code: string) {
    setLoading(true);
    try {
      const [a, e, p] = await Promise.all([
        getActivitiesAdmin(code),
        getEncouragementAdmin(code),
        getPatientDataAdmin(code),
      ]);
      setActivities(a.rows || []);
      setEncouragement(e.rows || []);
      setIpdOpen(p.ipdOpen || []);
    } finally {
      setLoading(false);
    }
  }

  async function doSearch() {
    if (!searchDate) return;
    setLoading(true);
    setError("");
    try {
      const p = await getPatientDataAdmin(adminCode, searchDate);
      setSearchOpd(p.opd || []);
      setSearchEr(p.er || []);
      setSearchCon(p.consult || []);
      setSearchIpd(p.ipd || []);
      setSearchProcedures(p.procedures || []);
      setIpdOpen(p.ipdOpen || []);
      setSearched(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked && !loadedRef.current) {
      loadedRef.current = true;
      loadBase(adminCode).catch((err) => setError((err as Error).message));
    }
  }, [unlocked]);

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); }

  async function unlock() {
    setError("");
    try { await loadBase(adminCode); loadedRef.current = true; setUnlocked(true); }
    catch (err) { setError((err as Error).message); }
  }

  /* ─── Patient handlers ─── */
  async function delPatient(type: string, id: number | string) {
    if (!confirm("ต้องการลบรายการนี้?")) return;
    try {
      setLoading(true);
      await deleteRow({ code: adminCode, sheetType: type, rowId: String(id) });
      flash("ลบสำเร็จ");
      if (searched) await doSearch(); else await loadBase(adminCode);
    } catch (err) { setError((err as Error).message); setLoading(false); }
  }

  async function saveIpd(e: FormEvent) {
    e.preventDefault();
    if (!editIpd) return;
    try {
      setLoading(true);
      await updateRow({ code: adminCode, sheetType: "ipd", rowId: String(editIpd.id), ...eIpdForm });
      setEditIpd(null); flash("แก้ไข IPD สำเร็จ");
      if (searched) await doSearch(); else await loadBase(adminCode);
    } catch (err) { setError((err as Error).message); setLoading(false); }
  }

  async function saveProcedure(e: FormEvent) {
    e.preventDefault();
    if (!editProcedure) return;
    try {
      setLoading(true);
      await updateRow({
        code: adminCode,
        sheetType: "procedure",
        rowId: String(editProcedure.id),
        date: eProcForm.date,
        procedureKey: eProcForm.procedureKey,
        procedureLabel: eProcForm.procedureLabel || (PROCEDURE_OPTIONS.find((o) => o.key === eProcForm.procedureKey)?.label ?? ""),
        count: eProcForm.count,
      });
      setEditProcedure(null); flash("แก้ไขหัตถการสำเร็จ");
      if (searched) await doSearch();
    } catch (err) { setError((err as Error).message); setLoading(false); }
  }

  async function saveOpd(e: FormEvent) {
    e.preventDefault();
    if (!editOpd) return;
    try {
      setLoading(true);
      await updateRow({ code: adminCode, sheetType: "opd", rowId: String(editOpd.id), ...eOpdForm });
      setEditOpd(null); flash("แก้ไข OPD สำเร็จ"); await doSearch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function saveEr(e: FormEvent) {
    e.preventDefault();
    if (!editEr) return;
    setError("");
    try {
      setLoading(true);
      await updateRow({ code: adminCode, sheetType: "er", rowId: String(editEr.id), ...eErForm });
      setEditEr(null); flash("แก้ไข ER สำเร็จ"); await doSearch();
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }

  async function saveCon(e: FormEvent) {
    e.preventDefault();
    if (!editCon) return;
    try {
      setLoading(true);
      await updateRow({ code: adminCode, sheetType: "consult", rowId: String(editCon.id), ...eConForm });
      setEditCon(null); flash("แก้ไข Consult สำเร็จ"); await doSearch();
    } catch (err) { setError((err as Error).message); setLoading(false); }
  }

  /* ─── Activity handlers ─── */
  async function submitActivity(e: FormEvent) {
    e.preventDefault();
    try { setLoading(true); await addActivity({ code: adminCode, ...form }); setForm({ date: new Date().toISOString().slice(0, 10), title: "", detail: "", type: "OPD", imageUrl: "", imageCaption: "", youtubeUrl: "", externalUrl: "" }); await loadBase(adminCode); flash("เพิ่มกิจกรรมสำเร็จ"); }
    catch (err) { setError((err as Error).message); setLoading(false); }
  }
  async function removeAct(id: string) {
    if (!confirm("ลบกิจกรรมนี้?")) return;
    try { setLoading(true); await deleteRow({ code: adminCode, sheetType: "activities", rowId: id }); await loadBase(adminCode); flash("ลบกิจกรรมสำเร็จ"); }
    catch (err) { setError((err as Error).message); setLoading(false); }
  }
  function startEditAct(item: ActivityItem) { setEditingAct(item); setForm({ date: item.date, title: item.title, detail: item.detail, type: item.type, imageUrl: item.imageUrl || "", imageCaption: item.imageCaption || "", youtubeUrl: item.youtubeUrl || "", externalUrl: item.externalUrl || "" }); }
  function cancelEditAct() { setEditingAct(null); setForm({ date: new Date().toISOString().slice(0, 10), title: "", detail: "", type: "OPD", imageUrl: "", imageCaption: "", youtubeUrl: "", externalUrl: "" }); }
  async function saveEditAct(e: FormEvent) {
    e.preventDefault();
    if (!editingAct) return;
    try { setLoading(true); await updateRow({ code: adminCode, sheetType: "activities", rowId: editingAct.id, ...form }); cancelEditAct(); await loadBase(adminCode); flash("แก้ไขกิจกรรมสำเร็จ"); }
    catch (err) { setError((err as Error).message); setLoading(false); }
  }

  /* ─── Enc handlers ─── */
  async function removeEnc(id: string) {
    if (!confirm("ลบข้อความนี้?")) return;
    try { setLoading(true); await deleteRow({ code: adminCode, sheetType: "encouragement", rowId: id }); await loadBase(adminCode); flash("ลบข้อความสำเร็จ"); }
    catch (err) { setError((err as Error).message); setLoading(false); }
  }
  function startEditEnc(item: EncouragementItem) { setEditingEnc(item); setEditEncMsg(item.message); }
  async function saveEditEnc(e: FormEvent) {
    e.preventDefault();
    if (!editingEnc) return;
    try { setLoading(true); await updateRow({ code: adminCode, sheetType: "encouragement", rowId: editingEnc.id, date: editingEnc.date, name: editingEnc.name, message: editEncMsg }); setEditingEnc(null); await loadBase(adminCode); flash("แก้ไขข้อความสำเร็จ"); }
    catch (err) { setError((err as Error).message); setLoading(false); }
  }

  const GOOGLE_SHEETS = [
    { name: "คิวรับ Case กลางแพทย์", url: "https://docs.google.com/spreadsheets/d/1LcJGzolGv48rSIal-w8SHM5EteQQqwugRquKuna-_Sw/edit?usp=sharing", icon: "📊", desc: "ตารางคิวรับเคสกลางแพทย์อายุรกรรม" },
    { name: "ตารางเวร MED", url: "https://docs.google.com/spreadsheets/d/11pnUQklnGRHtdY32bUdP-2Lyed1XbgJ8prnQ3TTGUNE/edit?usp=sharing", icon: "📅", desc: "ระบบถามเวรแพทย์อายุรกรรม" },
    { name: "ตาราง OPD แพทย์", url: "https://docs.google.com/spreadsheets/d/1nCzz1nyTsMr4HmI8vhLwC0X-Pv3X0Y86eB84TkoSWD0/edit?usp=sharing", icon: "🩺", desc: "ตารางออกตรวจ OPD แพทย์อายุรกรรม" },
  ];

  const tabs: { key: Tab; label: string; icon: string; desc: string; count: number }[] = [
    { key: "patients", label: "ข้อมูลผู้ป่วย", icon: "🏥", desc: "ค้นหาตามวันที่ / จัดการ HN", count: ipdOpen.length },
    { key: "activities", label: "กิจกรรม", icon: "📋", desc: "จัดการหน้ากิจกรรม", count: activities.length },
    { key: "encouragement", label: "ให้กำลังใจ", icon: "💬", desc: "จัดการหน้าบอร์ดให้กำลังใจ", count: encouragement.length },
    { key: "sheets", label: "Google Sheets", icon: "📑", desc: "ลิงก์จัดการข้อมูลภายนอก", count: GOOGLE_SHEETS.length },
  ];

  if (!unlocked) {
    return (
      <section className="admin-login-section">
        <LoadingOverlay show={loading} text="กำลังตรวจสอบรหัส..." />
        <div className="admin-login-card">
          <div className="admin-login-icon">🔐</div>
          <h1>Admin Panel</h1>
          <p className="admin-login-hint">ใส่รหัส Admin เพื่อจัดการข้อมูลทั้งหมด</p>
          {error && <p className="admin-error">{error}</p>}
          <div className="admin-login-form">
            <input type="password" placeholder="รหัส Admin" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && unlock()} />
            <button onClick={unlock}>เข้าสู่ระบบ</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <LoadingOverlay show={loading} text="กำลังโหลดข้อมูล..." />
      <div className="admin-header"><h1>⚙️ จัดการข้อมูล (Admin)</h1><p className="admin-subtitle">เลือกหมวดที่ต้องการจัดการ</p></div>
      {error && <p className="admin-error">{error}</p>}
      {success && <p className="admin-success">{success}</p>}

      <div className="admin-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`admin-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            <span className="admin-tab-icon">{t.icon}</span>
            <span className="admin-tab-content"><span className="admin-tab-label">{t.label}</span><span className="admin-tab-desc">{t.desc}</span></span>
            <span className="admin-tab-badge">{t.count}</span>
          </button>
        ))}
      </div>

      {/* ═══ Tab: ข้อมูลผู้ป่วย ═══ */}
      {tab === "patients" && (
        <div className="admin-panel">
          {/* IPD Open Cases — collapsible + grouped by date + ward filter */}
          <div className="admin-card" style={{ borderColor: "#f59e0b", borderWidth: 2 }}>
            <div className="ipd-open-header">
              <button type="button" className="ipd-open-toggle" onClick={() => setShowIpdOpen(!showIpdOpen)}>
                <span className="ipd-open-chevron" style={{ transform: showIpdOpen ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                <h2 style={{ margin: 0, fontSize: "1.05rem" }}>🛏️ ผู้ป่วย IPD ที่ยังอยู่ในระบบ ({ipdOpen.length})</h2>
              </button>
              {ipdOpen.length > 0 && showIpdOpen && (
                <select className="ipd-ward-filter" value={filterWard} onChange={(e) => setFilterWard(e.target.value)}>
                  <option value="__all__">ทุก Ward</option>
                  {[...new Set(ipdOpen.map((r) => r.ward))].sort().map((w) => (
                    <option key={w} value={w}>{w} ({ipdOpen.filter((r) => r.ward === w).length})</option>
                  ))}
                </select>
              )}
            </div>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "4px 0 0" }}>D/C แล้วจะหายออกจากรายการนี้อัตโนมัติ {!showIpdOpen && ipdOpen.length > 0 ? `— กดเพื่อดูรายชื่อ ${ipdOpen.length} ราย` : ""}</p>

            {showIpdOpen && (
              <>
                {ipdOpen.length === 0 ? <p className="admin-empty">ไม่มีผู้ป่วยค้างในระบบ</p> : (
                  <div style={{ marginTop: 12 }}>
                    {(() => {
                      const filtered = filterWard === "__all__" ? ipdOpen : ipdOpen.filter((r) => r.ward === filterWard);
                      if (filtered.length === 0) return <p className="admin-empty">ไม่มีผู้ป่วยใน Ward {filterWard}</p>;

                      const grouped = filtered.reduce<Record<string, IpdOpenItem[]>>((acc, item) => {
                        const key = item.admitDate || "ไม่ระบุวัน";
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(item);
                        return acc;
                      }, {});
                      const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

                      return (
                        <>
                          {filterWard !== "__all__" && (
                            <div style={{ marginBottom: 10, fontSize: "0.88rem", color: "#92400e", fontWeight: 600 }}>
                              แสดง {filtered.length} จาก {ipdOpen.length} ราย (Ward: {filterWard})
                            </div>
                          )}
                          {sortedDates.map((dateKey) => (
                            <div key={dateKey} className="ipd-date-group">
                              <div className="ipd-date-label">
                                <span>📅 Admit: {dateKey}</span>
                                <span className="ipd-date-count">{grouped[dateKey].length} ราย</span>
                              </div>
                              <div style={{ overflowX: "auto" }}>
                                <table>
                                  <thead><tr><th>ID</th><th>HN</th><th>Ward</th><th>จัดการ</th></tr></thead>
                                  <tbody>
                                    {grouped[dateKey].map((r) => (
                                      <tr key={r.id}>
                                        <td>{r.id}</td>
                                        <td><strong>{r.hn}</strong></td>
                                        <td>{r.ward}</td>
                                        <td>
                                          <div style={{ display: "flex", gap: 4 }}>
                                            <button className="btn-sm btn-edit" onClick={() => { setEditIpd(r as unknown as IpdAdminItem); setEIpdForm({ hn: r.hn, ward: r.ward, admitDate: r.admitDate, dischargeDate: "", stayType: "admit" }); }}>แก้ไข</button>
                                            <button className="btn-sm btn-delete" onClick={() => delPatient("ipd", r.id)}>ลบ</button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Edit IPD form (เมื่อกดแก้ไขจากตาราง Open Cases หรือผลค้นหา) */}
          {editIpd && (
            <div className="admin-card">
              <h2 className="admin-card-title">✏️ แก้ไข IPD #{editIpd.id}</h2>
              <form onSubmit={saveIpd} className="admin-form">
                <div className="field-group">
                  <label>ประเภท</label>
                  <select value={eIpdForm.stayType} onChange={(e) => setEIpdForm({ ...eIpdForm, stayType: e.target.value as "admit" | "ao" })}>
                    <option value="admit">Admit (มี HN)</option>
                    <option value="ao">A/O</option>
                  </select>
                </div>
                {eIpdForm.stayType === "admit" && (
                  <div className="field-grid-2">
                    <div className="field-group"><label>HN</label><input value={eIpdForm.hn} onChange={(e) => setEIpdForm({ ...eIpdForm, hn: e.target.value })} required /></div>
                    <div className="field-group"><label>วัน D/C (ว่างได้)</label><input type="date" value={eIpdForm.dischargeDate} onChange={(e) => setEIpdForm({ ...eIpdForm, dischargeDate: e.target.value })} /></div>
                  </div>
                )}
                <div className="field-grid-2">
                  <div className="field-group"><label>Ward</label>
                    <select value={eIpdForm.ward} onChange={(e) => setEIpdForm({ ...eIpdForm, ward: e.target.value })}>
                      {wards.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div className="field-group"><label>วัน Admit</label><input type="date" value={eIpdForm.admitDate} onChange={(e) => setEIpdForm({ ...eIpdForm, admitDate: e.target.value })} required /></div>
                </div>
                <div className="admin-form-actions">
                  <button type="submit">💾 บันทึก</button>
                  <button type="button" className="btn-secondary" onClick={() => setEditIpd(null)}>ยกเลิก</button>
                </div>
              </form>
            </div>
          )}

          {/* Search by date */}
          <div className="admin-card">
            <h2 className="admin-card-title">🔍 ค้นหาข้อมูลตามวันที่</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div className="field-group" style={{ minWidth: 160 }}>
                <label>วันที่</label>
                <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} />
              </div>
              <button onClick={doSearch} disabled={!searchDate} style={{ height: 42 }}>ค้นหา</button>
            </div>

            {searched && (
              <div style={{ marginTop: 16 }}>
                {searchOpd.length === 0 && searchEr.length === 0 && searchCon.length === 0 && searchIpd.length === 0 && searchProcedures.length === 0 ? (
                  <p className="admin-empty">ไม่พบข้อมูลวันที่ {searchDate}</p>
                ) : (
                  <>
                    {/* OPD results */}
                    {searchOpd.length > 0 && (
                      <>
                        <h3 style={{ marginTop: 12 }}>🏥 OPD ({searchOpd.length})</h3>
                        {editOpd && (
                          <form onSubmit={saveOpd} className="admin-form" style={{ marginBottom: 10, padding: 12, background: "var(--surface-soft)", borderRadius: 10, border: "1px solid var(--border)" }}>
                            <div className="field-grid-2">
                              <div className="field-group"><label>วันที่</label><input type="date" value={eOpdForm.date} onChange={(e) => setEOpdForm({ ...eOpdForm, date: e.target.value })} required /></div>
                              <div className="field-group"><label>จำนวน</label><input type="number" min={0} value={eOpdForm.count} onChange={(e) => setEOpdForm({ ...eOpdForm, count: Number(e.target.value) })} required /></div>
                            </div>
                            <div className="admin-form-actions"><button type="submit">💾 บันทึก</button><button type="button" className="btn-secondary" onClick={() => setEditOpd(null)}>ยกเลิก</button></div>
                          </form>
                        )}
                        <table>
                          <thead><tr><th>ID</th><th>วันที่</th><th>จำนวน</th><th>จัดการ</th></tr></thead>
                          <tbody>
                            {searchOpd.map((r) => (
                              <tr key={r.id}>
                                <td>{r.id}</td><td>{r.date}</td><td><strong>{r.count}</strong></td>
                                <td><div style={{ display: "flex", gap: 4 }}><button className="btn-sm btn-edit" onClick={() => { setEditOpd(r); setEOpdForm({ date: r.date, count: r.count }); }}>แก้ไข</button><button className="btn-sm btn-delete" onClick={() => delPatient("opd", r.id)}>ลบ</button></div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {/* ER results */}
                    {searchEr.length > 0 && (
                      <>
                        <h3 style={{ marginTop: 16 }}>🚑 ER ผู้ป่วยนอก ({searchEr.length})</h3>
                        {editEr && (
                          <form onSubmit={saveEr} className="admin-form" style={{ marginBottom: 10, padding: 12, background: "var(--surface-soft)", borderRadius: 10, border: "1px solid var(--border)" }}>
                            <div className="field-grid-2">
                              <div className="field-group"><label>วันที่</label><input type="date" value={eErForm.date} onChange={(e) => setEErForm({ ...eErForm, date: e.target.value })} required /></div>
                              <div className="field-group"><label>จำนวน</label><input type="number" min={0} value={eErForm.count} onChange={(e) => setEErForm({ ...eErForm, count: Number(e.target.value) })} required /></div>
                            </div>
                            <div className="admin-form-actions"><button type="submit">💾 บันทึก</button><button type="button" className="btn-secondary" onClick={() => setEditEr(null)}>ยกเลิก</button></div>
                          </form>
                        )}
                        <table>
                          <thead><tr><th>ID</th><th>วันที่</th><th>จำนวน</th><th>จัดการ</th></tr></thead>
                          <tbody>
                            {searchEr.map((r) => (
                              <tr key={r.id}>
                                <td>{r.id}</td><td>{r.date}</td><td><strong>{r.count}</strong></td>
                                <td><div style={{ display: "flex", gap: 4 }}><button className="btn-sm btn-edit" onClick={() => { setEditEr(r); setEErForm({ date: r.date, count: r.count }); }}>แก้ไข</button><button className="btn-sm btn-delete" onClick={() => delPatient("er", r.id)}>ลบ</button></div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {/* Consult results */}
                    {searchCon.length > 0 && (
                      <>
                        <h3 style={{ marginTop: 16 }}>📞 Consult ({searchCon.length})</h3>
                        {editCon && (
                          <form onSubmit={saveCon} className="admin-form" style={{ marginBottom: 10, padding: 12, background: "var(--surface-soft)", borderRadius: 10, border: "1px solid var(--border)" }}>
                            <div className="field-grid-2">
                              <div className="field-group"><label>วันที่</label><input type="date" value={eConForm.date} onChange={(e) => setEConForm({ ...eConForm, date: e.target.value })} required /></div>
                              <div className="field-group"><label>จำนวน</label><input type="number" min={0} value={eConForm.count} onChange={(e) => setEConForm({ ...eConForm, count: Number(e.target.value) })} required /></div>
                            </div>
                            <div className="admin-form-actions"><button type="submit">💾 บันทึก</button><button type="button" className="btn-secondary" onClick={() => setEditCon(null)}>ยกเลิก</button></div>
                          </form>
                        )}
                        <table>
                          <thead><tr><th>ID</th><th>วันที่</th><th>จำนวน</th><th>จัดการ</th></tr></thead>
                          <tbody>
                            {searchCon.map((r) => (
                              <tr key={r.id}>
                                <td>{r.id}</td><td>{r.date}</td><td><strong>{r.count}</strong></td>
                                <td><div style={{ display: "flex", gap: 4 }}><button className="btn-sm btn-edit" onClick={() => { setEditCon(r); setEConForm({ date: r.date, count: r.count }); }}>แก้ไข</button><button className="btn-sm btn-delete" onClick={() => delPatient("consult", r.id)}>ลบ</button></div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {/* IPD results */}
                    {searchIpd.length > 0 && (
                      <>
                        <h3 style={{ marginTop: 16 }}>🛏️ IPD ({searchIpd.length})</h3>
                        {editIpd && (
                          <form onSubmit={saveIpd} className="admin-form" style={{ marginBottom: 10, padding: 12, background: "var(--surface-soft)", borderRadius: 10, border: "1px solid var(--border)" }}>
                            <div className="field-group">
                              <label>ประเภท</label>
                              <select value={eIpdForm.stayType} onChange={(e) => setEIpdForm({ ...eIpdForm, stayType: e.target.value as "admit" | "ao" })}>
                                <option value="admit">Admit (มี HN)</option>
                                <option value="ao">A/O</option>
                              </select>
                            </div>
                            {eIpdForm.stayType === "admit" && (
                              <>
                                <div className="field-group"><label>HN</label><input value={eIpdForm.hn} onChange={(e) => setEIpdForm({ ...eIpdForm, hn: e.target.value })} required /></div>
                                <div className="field-group"><label>D/C วันที่</label><input type="date" value={eIpdForm.dischargeDate} onChange={(e) => setEIpdForm({ ...eIpdForm, dischargeDate: e.target.value })} /></div>
                              </>
                            )}
                            <div className="field-grid-2">
                              <div className="field-group"><label>Ward</label><select value={eIpdForm.ward} onChange={(e) => setEIpdForm({ ...eIpdForm, ward: e.target.value })}>{wards.map((w) => <option key={w} value={w}>{w}</option>)}</select></div>
                              <div className="field-group"><label>วันที่ Admit</label><input type="date" value={eIpdForm.admitDate} onChange={(e) => setEIpdForm({ ...eIpdForm, admitDate: e.target.value })} required /></div>
                            </div>
                            <div className="admin-form-actions"><button type="submit">💾 บันทึก</button><button type="button" className="btn-secondary" onClick={() => setEditIpd(null)}>ยกเลิก</button></div>
                          </form>
                        )}
                        <table>
                          <thead><tr><th>ID</th><th>ประเภท</th><th>HN</th><th>Ward</th><th>Admit</th><th>D/C</th><th>LOS</th><th>จัดการ</th></tr></thead>
                          <tbody>
                            {searchIpd.map((r) => (
                              <tr key={r.id}>
                                <td>{r.id}</td>
                                <td><span style={{ background: (r.stayType === "ao" ? "#dbeafe" : "#fef3c7"), padding: "2px 8px", borderRadius: 6 }}>{(r.stayType === "ao" ? "A/O" : "Admit")}</span></td>
                                <td><strong>{r.stayType === "ao" ? "—" : (r.hn || "—")}</strong></td>
                                <td>{r.ward}</td>
                                <td>{r.admitDate}</td>
                                <td>{r.dischargeDate || "—"}</td>
                                <td>{r.los ?? "—"}</td>
                                <td><div style={{ display: "flex", gap: 4 }}>
                                  <button className="btn-sm btn-edit" onClick={() => { setEditIpd(r); setEIpdForm({ hn: r.hn || "", ward: r.ward, admitDate: r.admitDate, dischargeDate: r.dischargeDate || "", stayType: (r.stayType === "ao" ? "ao" : "admit") as "admit" | "ao" }); }}>แก้ไข</button>
                                  <button className="btn-sm btn-delete" onClick={() => delPatient("ipd", r.id)}>ลบ</button>
                                </div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {/* หัตถการเฉพาะ */}
                    {searchProcedures.length > 0 && (
                      <>
                        <h3 style={{ marginTop: 16 }}>🔬 หัตถการเฉพาะ ({searchProcedures.length})</h3>
                        {editProcedure && (
                          <form onSubmit={saveProcedure} className="admin-form" style={{ marginBottom: 10, padding: 12, background: "var(--surface-soft)", borderRadius: 10, border: "1px solid var(--border)" }}>
                            <div className="field-grid-2">
                              <div className="field-group"><label>วันที่</label><input type="date" value={eProcForm.date} onChange={(e) => setEProcForm({ ...eProcForm, date: e.target.value })} required /></div>
                              <div className="field-group"><label>ประเภทหัตถการ</label>
                                <select value={eProcForm.procedureKey} onChange={(e) => setEProcForm({ ...eProcForm, procedureKey: e.target.value, procedureLabel: PROCEDURE_OPTIONS.find((o) => o.key === e.target.value)?.label ?? "" })} required>
                                  <option value="">-- เลือก --</option>
                                  {PROCEDURE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="field-grid-2">
                              <div className="field-group"><label>ชื่อแสดง (ถ้า Other)</label><input value={eProcForm.procedureLabel} onChange={(e) => setEProcForm({ ...eProcForm, procedureLabel: e.target.value })} placeholder="ระบุเอง" /></div>
                              <div className="field-group"><label>จำนวนครั้ง</label><input type="number" min={1} value={eProcForm.count} onChange={(e) => setEProcForm({ ...eProcForm, count: Number(e.target.value) || 1 })} /></div>
                            </div>
                            <div className="admin-form-actions"><button type="submit">💾 บันทึก</button><button type="button" className="btn-secondary" onClick={() => setEditProcedure(null)}>ยกเลิก</button></div>
                          </form>
                        )}
                        <table>
                          <thead><tr><th>ID</th><th>วันที่</th><th>หัตถการ</th><th>จำนวน</th><th>จัดการ</th></tr></thead>
                          <tbody>
                            {searchProcedures.map((r) => (
                              <tr key={r.id}>
                                <td>{r.id}</td>
                                <td>{r.date}</td>
                                <td><strong>{r.procedureLabel || r.procedureKey}</strong></td>
                                <td>{r.count}</td>
                                <td><div style={{ display: "flex", gap: 4 }}>
                                  <button className="btn-sm btn-edit" onClick={() => { setEditProcedure(r); setEProcForm({ date: r.date, procedureKey: r.procedureKey, procedureLabel: r.procedureLabel || "", count: r.count }); }}>แก้ไข</button>
                                  <button className="btn-sm btn-delete" onClick={() => delPatient("procedure", r.id)}>ลบ</button>
                                </div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Tab: กิจกรรม ═══ */}
      {tab === "activities" && (
        <div className="admin-panel">
          <div className="admin-card">
            <h2 className="admin-card-title">{editingAct ? "✏️ แก้ไขกิจกรรม" : "➕ เพิ่มกิจกรรมใหม่"}</h2>
            <form onSubmit={editingAct ? saveEditAct : submitActivity} className="admin-form">
              <div className="field-grid-2">
                <div className="field-group"><label>วันที่</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
                <div className="field-group"><label>ประเภท</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="OPD">OPD</option><option value="IPD">IPD</option><option value="OPD+IPD">OPD+IPD</option></select></div>
              </div>
              <div className="field-group"><label>หัวข้อ</label><input placeholder="เช่น ตรวจสุขภาพพระสงฆ์" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="field-group"><label>รายละเอียด</label><textarea placeholder="อธิบายกิจกรรม..." value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} required rows={3} /></div>
              <div className="admin-form-section">
                <p className="admin-form-section-label">สื่อประกอบ (ไม่บังคับ)</p>
                <div className="field-grid-2">
                  <div className="field-group"><label>Google Drive Image URL</label><input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></div>
                  <div className="field-group"><label>คำอธิบายภาพ</label><input value={form.imageCaption} onChange={(e) => setForm({ ...form, imageCaption: e.target.value })} /></div>
                </div>
                <div className="field-grid-2">
                  <div className="field-group"><label>YouTube URL</label><input value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} /></div>
                  <div className="field-group"><label>External Link</label><input value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} /></div>
                </div>
              </div>
              <div className="admin-form-actions">
                <button type="submit">{editingAct ? "💾 บันทึก" : "✅ เพิ่มกิจกรรม"}</button>
                {editingAct && <button type="button" className="btn-secondary" onClick={cancelEditAct}>ยกเลิก</button>}
              </div>
            </form>
          </div>
          <div className="admin-card">
            <h2 className="admin-card-title">📋 รายการกิจกรรม ({activities.length})</h2>
            {activities.length === 0 ? <p className="admin-empty">ยังไม่มีกิจกรรม</p> : (
              <div className="admin-list">
                {activities.map((a) => (
                  <div key={a.id} className="admin-list-item">
                    <div className="admin-list-info"><span className="admin-list-badge">{a.type}</span><span className="admin-list-date">{a.date}</span><span className="admin-list-title">{a.title}</span></div>
                    <div className="admin-list-actions"><button className="btn-sm btn-edit" onClick={() => startEditAct(a)}>แก้ไข</button><button className="btn-sm btn-delete" onClick={() => removeAct(a.id)}>ลบ</button></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Tab: ให้กำลังใจ ═══ */}
      {tab === "encouragement" && (
        <div className="admin-panel">
          {editingEnc && (
            <div className="admin-card">
              <h2 className="admin-card-title">✏️ แก้ไขข้อความ</h2>
              <form onSubmit={saveEditEnc} className="admin-form">
                <div className="field-group"><label>จาก: <strong>{editingEnc.name}</strong> ({editingEnc.date})</label><textarea value={editEncMsg} onChange={(e) => setEditEncMsg(e.target.value)} rows={3} required /></div>
                <div className="admin-form-actions"><button type="submit">💾 บันทึก</button><button type="button" className="btn-secondary" onClick={() => setEditingEnc(null)}>ยกเลิก</button></div>
              </form>
            </div>
          )}
          <div className="admin-card">
            <h2 className="admin-card-title">💬 ข้อความให้กำลังใจ ({encouragement.length})</h2>
            {encouragement.length === 0 ? <p className="admin-empty">ยังไม่มีข้อความ</p> : (
              <div className="admin-list">
                {encouragement.map((m) => (
                  <div key={m.id} className="admin-list-item">
                    <div className="admin-list-info"><span className="admin-list-date">{m.date}</span><span className="admin-list-name">{m.name || "ไม่ระบุชื่อ"}</span><span className="admin-list-message">&ldquo;{m.message}&rdquo;</span></div>
                    <div className="admin-list-actions"><button className="btn-sm btn-edit" onClick={() => startEditEnc(m)}>แก้ไข</button><button className="btn-sm btn-delete" onClick={() => removeEnc(m.id)}>ลบ</button></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ═══ Tab: Google Sheets ═══ */}
      {tab === "sheets" && (
        <div className="admin-panel">
          <div className="admin-card">
            <h2 className="admin-card-title">📑 ลิงก์ Google Sheets จัดการข้อมูล</h2>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>กดที่การ์ดเพื่อเปิด Google Sheet ในแท็บใหม่</p>
            <div className="admin-sheets-grid">
              {GOOGLE_SHEETS.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className="admin-sheet-card">
                  <span className="admin-sheet-icon">{s.icon}</span>
                  <div className="admin-sheet-text">
                    <span className="admin-sheet-name">{s.name}</span>
                    <span className="admin-sheet-desc">{s.desc}</span>
                  </div>
                  <span className="admin-sheet-arrow">↗</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
