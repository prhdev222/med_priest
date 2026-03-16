"use client";

import Image from "next/image";
import { FormEvent, useState, useCallback, useMemo, useEffect } from "react";
import {
  addIpdAdmit, addIpdDischarge, addStatsRow, addProcedure,
  addProcedurePlan, getProcedurePlans, markProcedurePlanDone,
  getIpdOpenCases, getTodayEntries, updateTodayRow, deleteTodayRow,
  getWardBeds, upsertWardBed,
  IpdOpenCase, OpdAdminItem, ErAdminItem, ConsultAdminItem, IpdAdminItem, ProcedureAdminItem,
  ProcedurePlanRow,
  PROCEDURE_OPTIONS, DELAY_REASON_OPTIONS, DischargePlanPayload,
} from "@/lib/api";

const wards = ["MED1", "MED2", "IMC", "Palliative", "ward90", "ICU", "__other__"];
const PROC_WARD_OPTIONS = ["OPD", "ER", "MED1", "MED2", "IMC", "Palliative", "ward90", "ICU", "__other__"];
const todayIso = () => new Date().toISOString().slice(0, 10);
const tomorrowIso = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const NURSE_QUOTES = [
  "ทุกตัวเลขที่กรอก คือหลักฐานของความทุ่มเท 💛",
  "พระคุณเจ้าอาจไม่รู้ แต่ข้อมูลจะบอกเล่าความเสียสละของพวกเรา 🌟",
  "สู้ๆ นะคะ พยาบาลอายุรกรรม รพ.สงฆ์ ทุกคน! 💪",
  "ทุกวันที่เหนื่อย คือวันที่เราช่วยชีวิตพระสงฆ์ 🙏",
  "คนน้อย แต่ใจใหญ่ — ขอบคุณที่ไม่ย่อท้อ ❤️",
  "ข้อมูลดี เพราะคนกรอกดี — ขอบคุณทุกคนค่ะ 🌸",
  "แม้งานหนัก แต่เรามีกันและกัน สู้ไปด้วยกัน! ✨",
  "ทุกครั้งที่กรอก คือการสร้างอนาคตที่ดีกว่าให้แผนกเรา 📊",
];

type Section = "opd" | "admit" | "ao" | "dc" | "proc" | "today" | "dcMed1" | "dcMed2" | "planMed1" | "planMed2" | "dailyChat" | null;

type DailyStep =
  | "date" | "opd" | "er" | "consult"
  | "ask_admit" | "admit_hn" | "admit_ward" | "admit_more"
  | "ask_ao" | "ao_ward" | "ao_count"
  | "ask_proc" | "proc_type" | "proc_ward" | "proc_count" | "proc_more"
  | "summary" | "saving" | "done";

interface DailyAdmitItem { hn: string; ward: string }
interface DailyProcItem { key: string; label: string; ward: string; count: number }

const MED_DC_QUOTES: Record<string, string[]> = {
  MED1: [
    "พยาบาล MED1 สุดแกร่ง! ช่วย D/C ให้พระคุณเจ้ากลับวัดอย่างปลอดภัย 🏠💚",
    "D/C วันนี้ = ความสุขของพระคุณเจ้า ขอบคุณทีม MED1 ค่ะ 🌈",
    "MED1 ดูแลด้วยใจ ส่งพระคุณเจ้ากลับวัดด้วยรอยยิ้ม 😊🙏",
    "กดปุ่ม D/C ให้พระคุณเจ้ากลับวัด — วันนี้ MED1 สู้ๆ! 💪✨",
  ],
  MED2: [
    "พยาบาล MED2 เก่งมาก! ช่วย D/C ส่งพระคุณเจ้ากลับวัดนะคะ 🏡💛",
    "D/C สำเร็จทุกราย เพราะทีม MED2 ไม่เคยย่อท้อ 🌟",
    "MED2 ส่งพระคุณเจ้ากลับวัดอย่างอบอุ่น ขอบคุณค่ะ 🤗🙏",
    "ทุก D/C คือความสำเร็จของทีม MED2 — สู้ๆ นะคะ! 💪🌸",
  ],
};

type ChatStep = "select_hn" | "select_date" | "confirm" | "done";

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
  const [dcFitDate, setDcFitDate] = useState("");
  const [dcDelayReason, setDcDelayReason] = useState("");
  const [dcDelayDetail, setDcDelayDetail] = useState("");
  const [openCases, setOpenCases] = useState<IpdOpenCase[]>([]);
  const [dcFilterWard, setDcFilterWard] = useState("__all__");
  const [wardBeds, setWardBeds] = useState<Record<string, number | undefined>>({});
  const [wardBedsSaving, setWardBedsSaving] = useState(false);
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

  // Procedure Plan (MED1/MED2 + Bed)
  const planWard = activeSection === "planMed1" ? "MED1" : activeSection === "planMed2" ? "MED2" : "";
  const [planDate, setPlanDate] = useState(tomorrowIso());
  const [planBed, setPlanBed] = useState("");
  const [planProcKey, setPlanProcKey] = useState("");
  const [planProcLabelOther, setPlanProcLabelOther] = useState("");
  const [planNote, setPlanNote] = useState("");
  const [planTodayRows, setPlanTodayRows] = useState<ProcedurePlanRow[]>([]);
  const [planTomorrowRows, setPlanTomorrowRows] = useState<ProcedurePlanRow[]>([]);
  const [planDoneDate, setPlanDoneDate] = useState(todayIso());
  const [planLoading, setPlanLoading] = useState(false);
  const [editOpdId, setEditOpdId] = useState<number | null>(null);
  const [editOpdVal, setEditOpdVal] = useState(0);
  const [editErId, setEditErId] = useState<number | null>(null);
  const [editErVal, setEditErVal] = useState(0);
  const [editConId, setEditConId] = useState<number | null>(null);
  const [editConVal, setEditConVal] = useState(0);
  const [editIpdId, setEditIpdId] = useState<number | null>(null);
  const [editIpdForm, setEditIpdForm] = useState<{ hn: string; ward: string; stayType?: string }>({ hn: "", ward: wards[0] });
  const [editIpdWardCustom, setEditIpdWardCustom] = useState("");

  // Chatbot D/C state
  const [chatStep, setChatStep] = useState<ChatStep>("select_hn");
  const [chatHnInput, setChatHnInput] = useState("");
  const [chatSelectedHn, setChatSelectedHn] = useState("");
  const [chatSelectedAdmit, setChatSelectedAdmit] = useState("");
  const [chatDcDate, setChatDcDate] = useState(todayIso());
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDcResult, setChatDcResult] = useState<{ ok: boolean; los?: number; error?: string } | null>(null);
  const [chatMode, setChatMode] = useState<"chat" | "form">("chat");
  const [chatFitDate, setChatFitDate] = useState("");
  const [chatDelayReason, setChatDelayReason] = useState("");
  const [chatDelayDetail, setChatDelayDetail] = useState("");
  const chatWard = activeSection === "dcMed1" ? "MED1" : activeSection === "dcMed2" ? "MED2" : "";
  const isBlueWard = chatWard === "MED1";
  const [chatQuote, setChatQuote] = useState(() => (MED_DC_QUOTES.MED1[0]));
  useEffect(() => {
    if (chatWard) {
      const q = MED_DC_QUOTES[chatWard] || MED_DC_QUOTES.MED1;
      setChatQuote(q[Math.floor(Math.random() * q.length)]);
    }
  }, [chatWard]);
  const chatWardCases = useMemo(() => openCases.filter((c) => c.ward === chatWard), [openCases, chatWard]);
  const chatMatchedCase = useMemo(() => {
    const q = chatHnInput.trim();
    if (!q) return null;
    return chatWardCases.find((c) => c.hn === q) || null;
  }, [chatHnInput, chatWardCases]);

  // Daily Chatbot state
  const [dStep, setDStep] = useState<DailyStep>("date");
  const [dDate, setDDate] = useState(todayIso());
  const [dOpd, setDOpd] = useState(0);
  const [dEr, setDEr] = useState(0);
  const [dConsult, setDConsult] = useState(0);
  const [dAdmits, setDAdmits] = useState<DailyAdmitItem[]>([]);
  const [dTmpHn, setDTmpHn] = useState("");
  const [dTmpWard, setDTmpWard] = useState("MED1");
  const [dAoWard, setDAoWard] = useState("MED1");
  const [dAoCount, setDAoCount] = useState(0);
  const [dProcs, setDProcs] = useState<DailyProcItem[]>([]);
  const [dTmpProcKey, setDTmpProcKey] = useState("");
  const [dTmpProcWard, setDTmpProcWard] = useState("OPD");
  const [dTmpProcCount, setDTmpProcCount] = useState(1);
  const [dSaving, setDSaving] = useState(false);
  const [dDone, setDDone] = useState(false);
  const [dError, setDError] = useState("");

  function resetDaily() {
    setDStep("date"); setDDate(todayIso()); setDOpd(0); setDEr(0); setDConsult(0);
    setDAdmits([]); setDTmpHn(""); setDTmpWard("MED1");
    setDAoWard("MED1"); setDAoCount(0);
    setDProcs([]); setDTmpProcKey(""); setDTmpProcWard("OPD"); setDTmpProcCount(1);
    setDSaving(false); setDDone(false); setDError("");
  }

  async function dailySave() {
    setDStep("saving"); setDSaving(true); setDError("");
    try {
      if (dOpd > 0) await addStatsRow({ code, sheetName: "OPD", date: dDate, count: dOpd });
      if (dEr > 0) await addStatsRow({ code, sheetName: "ER", date: dDate, count: dEr });
      if (dConsult > 0) await addStatsRow({ code, sheetName: "Consult", date: dDate, count: dConsult });
      for (const a of dAdmits) {
        await addIpdAdmit({ code, hn: a.hn, ward: a.ward, admitDate: dDate, stayType: "admit" });
      }
      if (dAoCount > 0) {
        await addIpdAdmit({ code, stayType: "ao", ward: dAoWard, admitDate: dDate, count: dAoCount });
      }
      for (const p of dProcs) {
        await addProcedure({ code, date: dDate, procedureKey: p.key, procedureLabel: p.key === "other" ? p.label : undefined, count: p.count, ward: p.ward });
      }
      await Promise.all([loadOpenCases(code), loadToday(code)]);
      setDStep("done"); setDDone(true);
    } catch (err) { setDError((err as Error).message); setDStep("summary"); }
    finally { setDSaving(false); }
  }

  function resetChat() {
    setChatStep("select_hn");
    setChatHnInput("");
    setChatSelectedHn("");
    setChatSelectedAdmit("");
    setChatDcDate(todayIso());
    setChatLoading(false);
    setChatDcResult(null);
  }

  async function chatDoDc() {
    const isDelayed = !!chatFitDate && chatDcDate > chatFitDate;
    if (isDelayed && !chatDelayReason) {
      flash("กรุณาเลือกสาเหตุ Delay Discharge", "error");
      return;
    }
    const payload: DischargePlanPayload = {
      code,
      hn: chatSelectedHn,
      dischargeDate: chatDcDate,
      ...(chatFitDate ? { fitDischargeDate: chatFitDate } : {}),
      ...(isDelayed && chatDelayReason ? { delayReason: chatDelayReason, delayDetail: chatDelayDetail } : {}),
    };

    setChatLoading(true);
    try {
      const res = await addIpdDischarge(payload) as { ok?: boolean; los?: number };
      setChatDcResult({ ok: true, los: res?.los });
      setChatStep("done");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (err) {
      setChatDcResult({ ok: false, error: (err as Error).message });
    } finally { setChatLoading(false); }
  }

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

  const loadWardBeds = useCallback(async () => {
    try {
      const res = await getWardBeds(todayIso());
      const map: Record<string, number | undefined> = {};
      for (const r of res.rows || []) map[r.ward] = r.beds;
      setWardBeds(map);
    } catch { setWardBeds({}); }
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

  async function submitProcedurePlan(e: FormEvent) {
    e.preventDefault(); setMsg("");
    if (!planWard) { flash("กรุณาเลือก Ward", "error"); return; }
    if (!planDate) { flash("กรุณาเลือกวันที่", "error"); return; }
    if (!planBed.trim()) { flash("กรุณากรอกเลขเตียง", "error"); return; }
    if (!planProcKey) { flash("เลือกประเภทหัตถการ", "error"); return; }

    const otherLabel = planProcKey === "other" ? planProcLabelOther.trim() : "";
    if (planProcKey === "other" && !otherLabel) { flash("กรุณาระบุหัตถการ (Other)", "error"); return; }

    try {
      await addProcedurePlan({
        code,
        planDate,
        ward: planWard,
        bed: planBed.trim(),
        procedureKey: planProcKey,
        procedureLabel: planProcKey === "other" ? otherLabel : undefined,
        note: planNote.trim() || undefined,
      });
      setPlanBed(""); setPlanProcKey(""); setPlanProcLabelOther(""); setPlanNote("");
      flash("บันทึกแผนหัตถการสำเร็จ");
      await loadPlanLists(planWard);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function doMarkPlanDone(id: number) {
    if (!planWard) return;
    if (!planDoneDate) { flash("กรุณาเลือกวันที่ทำจริง", "error"); return; }
    if (!confirm(`ยืนยันติ๊กทำแล้ว (วันที่ทำจริง: ${planDoneDate}) ?`)) return;
    setMsg("");
    try {
      await markProcedurePlanDone({ code, id, doneDate: planDoneDate, addToProcedures: true });
      flash("บันทึกทำแล้วสำเร็จ");
      await Promise.all([loadPlanLists(planWard), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  const dcIsDelayed = dcFitDate && dcDate > dcFitDate;
  const dcPayload = (hn: string) => ({
    code,
    hn,
    dischargeDate: dcDate,
    ...(dcFitDate ? { fitDischargeDate: dcFitDate } : {}),
    ...(dcIsDelayed ? { delayReason: dcDelayReason, delayDetail: dcDelayDetail } : {}),
  });

  async function doDc(hn: string) {
    if (dcIsDelayed && !dcDelayReason && dcFitDate) {
      flash("กรุณาเลือกสาเหตุ Delay Discharge", "error");
      return;
    }
    if (!confirm(`ยืนยัน D/C HN ${hn} วันที่ ${dcDate}?`)) return;
    setMsg("");
    try {
      await addIpdDischarge(dcPayload(hn));
      flash("บันทึก D/C สำเร็จ");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function submitDcByForm() {
    if (!dcHn.trim()) return;
    if (dcIsDelayed && !dcDelayReason && dcFitDate) {
      flash("กรุณาเลือกสาเหตุ Delay Discharge", "error");
      return;
    }
    setMsg("");
    try {
      await addIpdDischarge(dcPayload(dcHn.trim()));
      setDcHn(""); flash("บันทึก D/C สำเร็จ");
      await Promise.all([loadOpenCases(code), loadToday(code)]);
    } catch (error) { flash((error as Error).message, "error"); }
  }

  async function saveWardBeds() {
    setWardBedsSaving(true); setMsg("");
    try {
      for (const ward of ["MED1", "MED2"] as const) {
        const b = wardBeds[ward];
        if (b !== undefined && b !== null && Number.isFinite(Number(b))) {
          await upsertWardBed({ code, date: todayIso(), ward, beds: Number(b) });
        }
      }
      flash("บันทึกจำนวนเตียง Ward สำเร็จ");
      await loadWardBeds();
    } catch (error) { flash((error as Error).message, "error"); }
    finally { setWardBedsSaving(false); }
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

  const [nurseQuote, setNurseQuote] = useState(() => NURSE_QUOTES[0]);
  useEffect(() => {
    setNurseQuote(NURSE_QUOTES[Math.floor(Math.random() * NURSE_QUOTES.length)]);
  }, []);

  useEffect(() => {
    if (unlocked && (activeSection === "dcMed1" || activeSection === "dcMed2")) loadWardBeds();
  }, [unlocked, activeSection, loadWardBeds]);

  const loadPlanLists = useCallback(async (ward: string) => {
    if (!ward) return;
    setPlanLoading(true);
    try {
      const [t1, t2] = await Promise.all([
        getProcedurePlans(todayIso(), ward),
        getProcedurePlans(tomorrowIso(), ward),
      ]);
      setPlanTodayRows(Array.isArray(t1?.rows) ? t1.rows : []);
      setPlanTomorrowRows(Array.isArray(t2?.rows) ? t2.rows : []);
    } catch (error) {
      setMsg((error as Error).message || "เกิดข้อผิดพลาดในการโหลดแผนหัตถการ");
      setMsgType("error");
    } finally {
      setPlanLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    if (activeSection === "planMed1" || activeSection === "planMed2") {
      setPlanDate(tomorrowIso());
      setPlanDoneDate(todayIso());
      loadPlanLists(planWard);
    }
  }, [unlocked, activeSection, loadPlanLists, planWard]);

  return (
    <section className="entry-section">
      <div className="page-header">
        <h1>📝 กรอกข้อมูลผู้ป่วย</h1>
        <p>เลือกหมวดหมู่ แล้วกรอกข้อมูล — กรอกวันนี้แก้ไขได้ทันที</p>
      </div>

      {/* ── Nurse Encouragement ── */}
      {!unlocked && (
        <div className="de-nurse-hero">
          <Image src="/NurseHeart.png" alt="Nurse Heart" width={140} height={140} className="de-nurse-img" priority />
          <div className="de-nurse-text">
            <p className="de-nurse-quote">&ldquo;{nurseQuote}&rdquo;</p>
            <p className="de-nurse-sub">อายุรกรรม รพ.สงฆ์ — ขอบคุณที่ตั้งใจกรอกข้อมูลทุกวัน</p>
          </div>
        </div>
      )}

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

      {unlocked && activeSection === null && (<>
        {/* Daily Chatbot Button */}
        <button className="de-daily-chat-btn" onClick={() => { resetDaily(); setActiveSection("dailyChat"); }}>
          <Image src="/NurseHeart.png" alt="NurseHeart" width={64} height={64} className="de-daily-chat-img" />
          <div className="de-daily-chat-text">
            <span className="de-daily-chat-title">กรอกข้อมูลวันนี้ (Chatbot)</span>
            <span className="de-daily-chat-desc">NurseBot จะถามทีละข้อ — OPD, ER, Consult, Admit, A/O, หัตถการ</span>
          </div>
          <span className="de-menu-arrow">›</span>
        </button>

        {/* Quick D/C MED1 & MED2 */}
        <div className="de-ward-dc-row">
          {(["MED1", "MED2"] as const).map((ward) => {
            const cnt = openCases.filter((c) => c.ward === ward).length;
            return (
              <div key={ward} className={`de-ward-dc-card ${ward === "MED1" ? "dc-card-blue" : "dc-card-green"}`} style={{ cursor: "default" }}>
                <div className="de-ward-dc-top">
                  <div className="de-ward-dc-text">
                    <span className="de-ward-dc-name">{ward}</span>
                    <span className="de-ward-dc-hint">D/C และวางแผนหัตถการล่วงหน้า</span>
                  </div>
                  {cnt > 0 && <span className="de-menu-badge">{cnt}</span>}
                </div>
                <Image src={`/${ward}head.png`} alt={ward} width={64} height={64} className="de-ward-dc-img" />
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
                  <button type="button" className="btn-sm" style={{ background: "#16a34a" }} onClick={() => { resetChat(); setActiveSection(ward === "MED1" ? "dcMed1" : "dcMed2"); }}>
                    ✅ D/C
                  </button>
                  <button type="button" className="btn-sm" style={{ background: "#f59e0b" }} onClick={() => { setActiveSection(ward === "MED1" ? "planMed1" : "planMed2"); }}>
                    📋 วางแผนหัตถการ
                  </button>
                </div>
              </div>
            );
          })}
        </div>

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
      </>)}

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
            <div className="field-group"><label>วันที่ D/C (จริง)</label><input type="date" value={dcDate} onChange={(e) => setDcDate(e.target.value)} /></div>
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

      {/* ══════════════════ วางแผนหัตถการ (MED1/MED2) ══════════════════ */}
      {unlocked && (activeSection === "planMed1" || activeSection === "planMed2") && (
        <div className="de-panel">
          {backBtn}
          <div className="de-panel-header" style={{ "--card-accent": "#f59e0b" } as React.CSSProperties}>
            <span>📋</span><h2>วางแผนหัตถการ {planWard}</h2>
          </div>

          <form onSubmit={submitProcedurePlan} className="entry-form">
            <div className="field-grid-2">
              <div className="field-group"><label>วันที่ (แผน)</label><input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} required /></div>
              <div className="field-group"><label>เตียง</label><input placeholder="เช่น 3, 5A" value={planBed} onChange={(e) => setPlanBed(e.target.value)} required /></div>
            </div>
            <div className="field-group">
              <label>หัตถการ</label>
              <select value={planProcKey} onChange={(e) => setPlanProcKey(e.target.value)} required>
                <option value="">-- เลือก --</option>
                {PROCEDURE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
            {planProcKey === "other" && (
              <div className="field-group">
                <label>ระบุ (Other)</label>
                <input placeholder="พิมพ์ชื่อหัตถการ" value={planProcLabelOther} onChange={(e) => setPlanProcLabelOther(e.target.value)} />
              </div>
            )}
            <div className="field-group"><label>หมายเหตุ (ถ้ามี)</label><input placeholder="เช่น ก่อน D/C, รอญาติ" value={planNote} onChange={(e) => setPlanNote(e.target.value)} /></div>
            <button type="submit" className="de-submit-btn" style={{ background: "#f59e0b" }}>บันทึกแผน</button>
          </form>

          <div className="de-today-mini">
            <h3 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span>แผนพรุ่งนี้ ({tomorrowIso()})</span>
              <button type="button" className="btn-sm btn-secondary" onClick={() => loadPlanLists(planWard)} disabled={planLoading}>
                {planLoading ? "กำลังโหลด..." : "รีเฟรช"}
              </button>
            </h3>
            {planTomorrowRows.length === 0 ? (
              <p style={{ color: "var(--muted)", textAlign: "center", padding: 8 }}>ยังไม่มีแผนพรุ่งนี้</p>
            ) : (
              planTomorrowRows.map((r) => (
                <div key={r.id} className="de-row-item">
                  <span className="de-row-badge" style={{ background: "#f59e0b" }}>Plan</span>
                  <span><strong>เตียง {r.bed || "-"}</strong></span>
                  <span>{r.procedureKey === "other" ? (r.procedureLabel ? `Other: ${r.procedureLabel}` : "Other") : (PROCEDURE_OPTIONS.find((o) => o.key === r.procedureKey)?.label ?? r.procedureKey)}</span>
                  {r.note && <span style={{ color: "var(--muted)" }}>{r.note}</span>}
                </div>
              ))
            )}
          </div>

          <div className="de-today-mini" style={{ marginTop: 14 }}>
            <h3>แผนวันนี้ ({todayIso()}) — ติ๊กทำแล้วเพื่อบันทึก “ทำจริง”</h3>
            <div className="field-grid-2" style={{ marginBottom: 8 }}>
              <div className="field-group">
                <label>วันที่ทำจริง</label>
                <input type="date" value={planDoneDate} onChange={(e) => setPlanDoneDate(e.target.value)} />
              </div>
            </div>
            {planTodayRows.length === 0 ? (
              <p style={{ color: "var(--muted)", textAlign: "center", padding: 8 }}>ยังไม่มีแผนวันนี้</p>
            ) : (
              planTodayRows.map((r) => (
                <div key={r.id} className="de-row-item">
                  <span className="de-row-badge" style={{ background: r.status === "done" ? "#16a34a" : "#f59e0b" }}>
                    {r.status === "done" ? "Done" : "Plan"}
                  </span>
                  <span><strong>เตียง {r.bed || "-"}</strong></span>
                  <span>{r.procedureKey === "other" ? (r.procedureLabel ? `Other: ${r.procedureLabel}` : "Other") : (PROCEDURE_OPTIONS.find((o) => o.key === r.procedureKey)?.label ?? r.procedureKey)}</span>
                  {r.status === "done" ? (
                    <span style={{ color: "#16a34a", fontWeight: 600 }}>ทำแล้ว ({r.doneDate || "-"})</span>
                  ) : (
                    <button type="button" className="btn-sm" style={{ background: "#16a34a" }} onClick={() => doMarkPlanDone(r.id)}>
                      ✓ ทำแล้ว
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
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

      {/* ══════════════════ Daily Chatbot (NurseHeart) ══════════════════ */}
      {unlocked && activeSection === "dailyChat" && (
        <div className="de-panel dc-theme-pink">
          <button type="button" className="de-back-btn" onClick={() => { setActiveSection(null); resetDaily(); setMsg(""); }}>← กลับเมนูหลัก</button>

          <div className="chat-dc-header">
            <Image src="/NurseHeart.png" alt="NurseHeart" width={56} height={56} className="chat-dc-avatar" />
            <div>
              <h2 className="chat-dc-title">กรอกข้อมูลประจำวัน</h2>
              <p className="chat-dc-quote">NurseBot จะถามทีละข้อนะคะ สู้ๆ!</p>
            </div>
          </div>

          <div className="chat-dc-body">
            {/* ── Step: Date ── */}
            <div className="chat-bubble bot">
              <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
              <div className="chat-bubble-content">วันที่กรอกข้อมูลวันไหนคะ?</div>
            </div>
            {dStep === "date" && (
              <div className="chat-input-row">
                <input type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} className="chat-date-input" />
                <button type="button" className="chat-send-btn" onClick={() => setDStep("opd")}>ถัดไป →</button>
              </div>
            )}

            {/* ── After date confirmed ── */}
            {dStep !== "date" && (
              <div className="chat-bubble user"><div className="chat-bubble-content">📅 {dDate}</div></div>
            )}

            {/* ── Step: OPD ── */}
            {dStep !== "date" && (
              <div className="chat-bubble bot">
                <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                <div className="chat-bubble-content">🏥 จำนวน OPD วันนี้กี่รายคะ?</div>
              </div>
            )}
            {dStep === "opd" && (
              <div className="chat-input-row">
                <input type="number" min={0} value={dOpd} onChange={(e) => setDOpd(Number(e.target.value))} className="chat-date-input" placeholder="จำนวน OPD" />
                <button type="button" className="chat-send-btn" onClick={() => setDStep("er")}>ถัดไป →</button>
              </div>
            )}
            {["er","consult","ask_admit","admit_hn","admit_ward","admit_more","ask_ao","ao_ward","ao_count","ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble user"><div className="chat-bubble-content">OPD: {dOpd} ราย</div></div>
            )}

            {/* ── Step: ER ── */}
            {["er","consult","ask_admit","admit_hn","admit_ward","admit_more","ask_ao","ao_ward","ao_count","ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble bot">
                <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                <div className="chat-bubble-content">🚑 จำนวน ER ผู้ป่วยนอกกี่รายคะ?</div>
              </div>
            )}
            {dStep === "er" && (
              <div className="chat-input-row">
                <input type="number" min={0} value={dEr} onChange={(e) => setDEr(Number(e.target.value))} className="chat-date-input" placeholder="จำนวน ER" />
                <button type="button" className="chat-send-btn" onClick={() => setDStep("consult")}>ถัดไป →</button>
              </div>
            )}
            {["consult","ask_admit","admit_hn","admit_ward","admit_more","ask_ao","ao_ward","ao_count","ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble user"><div className="chat-bubble-content">ER: {dEr} ราย</div></div>
            )}

            {/* ── Step: Consult ── */}
            {["consult","ask_admit","admit_hn","admit_ward","admit_more","ask_ao","ao_ward","ao_count","ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble bot">
                <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                <div className="chat-bubble-content">📋 จำนวน Consult กี่รายคะ?</div>
              </div>
            )}
            {dStep === "consult" && (
              <div className="chat-input-row">
                <input type="number" min={0} value={dConsult} onChange={(e) => setDConsult(Number(e.target.value))} className="chat-date-input" placeholder="จำนวน Consult" />
                <button type="button" className="chat-send-btn" onClick={() => setDStep("ask_admit")}>ถัดไป →</button>
              </div>
            )}
            {["ask_admit","admit_hn","admit_ward","admit_more","ask_ao","ao_ward","ao_count","ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble user"><div className="chat-bubble-content">Consult: {dConsult} ราย</div></div>
            )}

            {/* ── Step: Ask Admit ── */}
            {["ask_admit","admit_hn","admit_ward","admit_more","ask_ao","ao_ward","ao_count","ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble bot">
                <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                <div className="chat-bubble-content">🛏️ มี Admit ใหม่วันนี้ไหมคะ? {dAdmits.length > 0 && `(เพิ่มแล้ว ${dAdmits.length} ราย)`}</div>
              </div>
            )}
            {(dStep === "ask_admit" || dStep === "admit_more") && (
              <div className="chat-confirm-row">
                <button type="button" className="chat-confirm-btn yes" onClick={() => { setDTmpHn(""); setDTmpWard("MED1"); setDStep("admit_hn"); }}>มี — เพิ่ม Admit</button>
                <button type="button" className="chat-confirm-btn no" onClick={() => setDStep("ask_ao")}>ไม่มี{dAdmits.length > 0 ? " — ไปต่อ" : ""}</button>
              </div>
            )}

            {/* ── Step: Admit HN ── */}
            {dStep === "admit_hn" && (
              <>
                <div className="chat-bubble bot">
                  <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                  <div className="chat-bubble-content">พิมพ์ HN ผู้ป่วยที่ Admit ค่ะ</div>
                </div>
                <div className="chat-input-row">
                  <input type="text" inputMode="numeric" placeholder="เลข HN" value={dTmpHn} onChange={(e) => setDTmpHn(e.target.value)} className="chat-date-input" />
                  <button type="button" className="chat-send-btn" disabled={!dTmpHn.trim()} onClick={() => setDStep("admit_ward")}>ถัดไป →</button>
                </div>
              </>
            )}

            {/* ── Step: Admit Ward ── */}
            {dStep === "admit_ward" && (
              <>
                <div className="chat-bubble user"><div className="chat-bubble-content">HN: {dTmpHn}</div></div>
                <div className="chat-bubble bot">
                  <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                  <div className="chat-bubble-content">Admit Ward ไหนคะ?</div>
                </div>
                <div className="chat-input-row">
                  <select value={dTmpWard} onChange={(e) => setDTmpWard(e.target.value)} className="chat-date-input">
                    {wards.filter(w => w !== "__other__").map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  <button type="button" className="chat-send-btn" onClick={() => {
                    setDAdmits([...dAdmits, { hn: dTmpHn.trim(), ward: dTmpWard }]);
                    setDStep("admit_more");
                  }}>เพิ่ม ✓</button>
                </div>
              </>
            )}

            {/* Show added admits */}
            {dAdmits.length > 0 && ["admit_more","ask_ao","ao_ward","ao_count","ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble user">
                <div className="chat-bubble-content">
                  Admit {dAdmits.length} ราย:
                  {dAdmits.map((a, i) => <span key={i} style={{ display: "block" }}>• HN {a.hn} ({a.ward})</span>)}
                </div>
              </div>
            )}

            {/* ── Step: Ask A/O ── */}
            {["ask_ao","ao_ward","ao_count","ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble bot">
                <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                <div className="chat-bubble-content">🛏️ มี A/O (Admit แบบจำนวน) วันนี้ไหมคะ?</div>
              </div>
            )}
            {dStep === "ask_ao" && (
              <div className="chat-confirm-row">
                <button type="button" className="chat-confirm-btn yes" onClick={() => setDStep("ao_ward")}>มี</button>
                <button type="button" className="chat-confirm-btn no" onClick={() => setDStep("ask_proc")}>ไม่มี</button>
              </div>
            )}

            {dStep === "ao_ward" && (
              <>
                <div className="chat-bubble bot">
                  <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                  <div className="chat-bubble-content">A/O Ward ไหน กี่รายคะ?</div>
                </div>
                <div className="chat-input-row" style={{ flexWrap: "wrap" }}>
                  <select value={dAoWard} onChange={(e) => setDAoWard(e.target.value)} className="chat-date-input">
                    {wards.filter(w => w !== "__other__").map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  <input type="number" min={1} value={dAoCount || ""} onChange={(e) => setDAoCount(Number(e.target.value))} className="chat-date-input" placeholder="จำนวน" style={{ maxWidth: 100 }} />
                  <button type="button" className="chat-send-btn" disabled={!dAoCount} onClick={() => setDStep("ask_proc")}>ถัดไป →</button>
                </div>
              </>
            )}

            {dAoCount > 0 && ["ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble user"><div className="chat-bubble-content">A/O: {dAoWard} {dAoCount} ราย</div></div>
            )}

            {/* ── Step: Ask Procedure ── */}
            {["ask_proc","proc_type","proc_ward","proc_count","proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble bot">
                <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                <div className="chat-bubble-content">🩺 มีหัตถการวันนี้ไหมคะ? {dProcs.length > 0 && `(เพิ่มแล้ว ${dProcs.length} รายการ)`}</div>
              </div>
            )}
            {(dStep === "ask_proc" || dStep === "proc_more") && (
              <div className="chat-confirm-row">
                <button type="button" className="chat-confirm-btn yes" onClick={() => { setDTmpProcKey(""); setDTmpProcWard("OPD"); setDTmpProcCount(1); setDStep("proc_type"); }}>มี — เพิ่มหัตถการ</button>
                <button type="button" className="chat-confirm-btn no" onClick={() => setDStep("summary")}>ไม่มี{dProcs.length > 0 ? " — ไปสรุป" : ""}</button>
              </div>
            )}

            {dStep === "proc_type" && (
              <>
                <div className="chat-bubble bot">
                  <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                  <div className="chat-bubble-content">เลือกประเภทหัตถการค่ะ</div>
                </div>
                <div className="chat-input-row">
                  <select value={dTmpProcKey} onChange={(e) => setDTmpProcKey(e.target.value)} className="chat-date-input" style={{ maxWidth: "100%" }}>
                    <option value="">-- เลือก --</option>
                    {PROCEDURE_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                  <button type="button" className="chat-send-btn" disabled={!dTmpProcKey} onClick={() => setDStep("proc_ward")}>ถัดไป →</button>
                </div>
              </>
            )}

            {dStep === "proc_ward" && (
              <>
                <div className="chat-bubble user"><div className="chat-bubble-content">หัตถการ: {PROCEDURE_OPTIONS.find(p=>p.key===dTmpProcKey)?.label || dTmpProcKey}</div></div>
                <div className="chat-bubble bot">
                  <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                  <div className="chat-bubble-content">ทำที่ Ward ไหน กี่ราย?</div>
                </div>
                <div className="chat-input-row" style={{ flexWrap: "wrap" }}>
                  <select value={dTmpProcWard} onChange={(e) => setDTmpProcWard(e.target.value)} className="chat-date-input">
                    {PROC_WARD_OPTIONS.filter(w => w !== "__other__").map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  <input type="number" min={1} value={dTmpProcCount} onChange={(e) => setDTmpProcCount(Number(e.target.value) || 1)} className="chat-date-input" placeholder="จำนวน" style={{ maxWidth: 80 }} />
                  <button type="button" className="chat-send-btn" onClick={() => {
                    const label = PROCEDURE_OPTIONS.find(p => p.key === dTmpProcKey)?.label || dTmpProcKey;
                    setDProcs([...dProcs, { key: dTmpProcKey, label, ward: dTmpProcWard, count: dTmpProcCount }]);
                    setDStep("proc_more");
                  }}>เพิ่ม ✓</button>
                </div>
              </>
            )}

            {dProcs.length > 0 && ["proc_more","summary","saving","done"].includes(dStep) && (
              <div className="chat-bubble user">
                <div className="chat-bubble-content">
                  หัตถการ {dProcs.length} รายการ:
                  {dProcs.map((p, i) => <span key={i} style={{ display: "block" }}>• {p.label} x{p.count} ({p.ward})</span>)}
                </div>
              </div>
            )}

            {/* ── Step: Summary ── */}
            {(dStep === "summary" || dStep === "saving") && (
              <>
                <div className="chat-bubble bot">
                  <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                  <div className="chat-bubble-content">
                    <strong>สรุปข้อมูลวันที่ {dDate}</strong><br />
                    🏥 OPD: {dOpd} ราย<br />
                    🚑 ER: {dEr} ราย<br />
                    📋 Consult: {dConsult} ราย<br />
                    {dAdmits.length > 0 && <>🛏️ Admit: {dAdmits.length} ราย<br /></>}
                    {dAoCount > 0 && <>🛏️ A/O: {dAoWard} {dAoCount} ราย<br /></>}
                    {dProcs.length > 0 && <>🩺 หัตถการ: {dProcs.length} รายการ<br /></>}
                    <br />ยืนยันบันทึกข้อมูลนะคะ?
                  </div>
                </div>
                {dError && <p className="chat-hn-nomatch">{dError}</p>}
                <div className="chat-confirm-row">
                  <button type="button" className="chat-confirm-btn yes" disabled={dSaving} onClick={dailySave}>
                    {dSaving ? "กำลังบันทึก..." : "✓ ยืนยันบันทึก"}
                  </button>
                  <button type="button" className="chat-confirm-btn no" disabled={dSaving} onClick={resetDaily}>✗ เริ่มใหม่</button>
                </div>
              </>
            )}

            {/* ── Step: Done ── */}
            {dStep === "done" && (
              <>
                <div className="chat-bubble bot">
                  <Image src="/NurseHeart.png" alt="NurseHeart" width={36} height={36} className="chat-bubble-avatar" />
                  <div className="chat-bubble-content">
                    บันทึกข้อมูลวันที่ {dDate} สำเร็จแล้วค่ะ! 🎉<br />
                    ขอบคุณที่ตั้งใจกรอกข้อมูลนะคะ 💖
                  </div>
                </div>
                <div className="chat-confirm-row">
                  <button type="button" className="chat-confirm-btn yes" onClick={resetDaily}>กรอกวันอื่น</button>
                  <button type="button" className="chat-confirm-btn no" onClick={() => { setActiveSection(null); resetDaily(); }}>กลับเมนูหลัก</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ Chatbot D/C MED1 / MED2 ══════════════════ */}
      {unlocked && (activeSection === "dcMed1" || activeSection === "dcMed2") && (
        <div className={`de-panel ${isBlueWard ? "dc-theme-blue" : "dc-theme-green"}`}>
          <button type="button" className="de-back-btn" onClick={() => { setActiveSection(null); resetChat(); setMsg(""); }}>← กลับเมนูหลัก</button>

          {/* Header with avatar */}
          <div className="chat-dc-header">
            <Image src={`/${chatWard}head.png`} alt={chatWard} width={56} height={56} className="chat-dc-avatar" />
            <div>
              <h2 className="chat-dc-title">D/C ผู้ป่วย {chatWard}</h2>
              <p className="chat-dc-quote">{chatQuote}</p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="chat-dc-mode-toggle">
            <button type="button" className={chatMode === "chat" ? "active" : ""} onClick={() => setChatMode("chat")}>💬 Chatbot</button>
            <button type="button" className={chatMode === "form" ? "active" : ""} onClick={() => setChatMode("form")}>📝 Form ธรรมดา</button>
          </div>

          {/* ─── Shared: Bed capacity MED1/MED2 ─── */}
          <div className="de-bed-capacity-section" style={{ marginTop: 8, marginBottom: 16 }}>
            <h3 className="de-dp-title">🛏️ จำนวนเตียง {chatWard || "MED1 / MED2"} (วันนี้)</h3>
            <p className="de-dp-hint">
              ใส่จำนวนเตียงที่ใช้ในการนอน (วันนี้/เดิม) ใช้ใน MED analysis เท่านั้น
            </p>
            <div className="de-bed-grid">
              {(chatWard ? [chatWard] : (["MED1", "MED2"] as const)).map((w) => (
                <div key={w} className="de-bed-item">
                  <label>{w}</label>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    placeholder="0"
                    value={wardBeds[w] ?? ""}
                    onChange={(e) =>
                      setWardBeds((prev) => ({
                        ...prev,
                        [w]: e.target.value === "" ? undefined : Number(e.target.value),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="de-submit-btn"
              onClick={saveWardBeds}
              disabled={wardBedsSaving}
            >
              {wardBedsSaving ? "กำลังบันทึก..." : "บันทึกจำนวนเตียง"}
            </button>
          </div>

          {/* ─── Chat Mode ─── */}
          {chatMode === "chat" && (
            <div className="chat-dc-body">
              {/* Step 1: Type HN */}
              <div className="chat-bubble bot">
                <Image src={`/${chatWard}head.png`} alt={chatWard} width={36} height={36} className="chat-bubble-avatar" />
                <div className="chat-bubble-content">
                  พิมพ์ HN ของผู้ป่วยที่จะ D/C ค่ะ {chatWardCases.length > 0 ? `(มี ${chatWardCases.length} รายรอ D/C)` : ""}
                </div>
              </div>

              {chatStep === "select_hn" && (
                <div className="chat-hn-search">
                  <input
                    type="text" inputMode="numeric" placeholder="พิมพ์เลข HN..."
                    value={chatHnInput} onChange={(e) => setChatHnInput(e.target.value)}
                    className="chat-hn-input"
                  />
                  {chatHnInput.trim() && chatMatchedCase && (
                    <button className="chat-hn-match" onClick={() => {
                      setChatSelectedHn(chatMatchedCase.hn);
                      setChatSelectedAdmit(chatMatchedCase.admitDate);
                      setChatStep("select_date");
                    }}>
                      <strong>HN {chatMatchedCase.hn}</strong>
                      <span>Admit {chatWard}: {chatMatchedCase.admitDate}</span>
                      <span className="chat-hn-match-arrow">เลือก →</span>
                    </button>
                  )}
                  {chatHnInput.trim() && !chatMatchedCase && (
                    <p className="chat-hn-nomatch">ไม่พบ HN นี้ในรายชื่อรอ D/C ของ {chatWard}</p>
                  )}
                </div>
              )}

              {/* Step 2: Select D/C date */}
              {(chatStep === "select_date" || chatStep === "confirm" || chatStep === "done") && (
                <div className="chat-bubble user">
                  <div className="chat-bubble-content">HN {chatSelectedHn} (Admit: {chatSelectedAdmit})</div>
                </div>
              )}

              {(chatStep === "select_date" || chatStep === "confirm" || chatStep === "done") && (
                <div className="chat-bubble bot">
                  <Image src={`/${chatWard}head.png`} alt={chatWard} width={36} height={36} className="chat-bubble-avatar" />
                  <div className="chat-bubble-content">D/C วันที่เท่าไหร่คะ?</div>
                </div>
              )}

              {chatStep === "select_date" && (
                <div className="chat-input-row">
                  <input type="date" value={chatDcDate} onChange={(e) => setChatDcDate(e.target.value)} className="chat-date-input" />
                  <button type="button" className="chat-send-btn" onClick={() => setChatStep("confirm")}>ถัดไป →</button>
                </div>
              )}

              {/* Step 3: Confirm + Discharge Plan (optional) */}
              {(chatStep === "confirm" || chatStep === "done") && (
                <div className="chat-bubble user">
                  <div className="chat-bubble-content">วันที่ D/C: {chatDcDate}</div>
                </div>
              )}

              {chatStep === "confirm" && (
                <>
                  <div className="chat-bubble bot">
                    <Image src={`/${chatWard}head.png`} alt={chatWard} width={36} height={36} className="chat-bubble-avatar" />
                    <div className="chat-bubble-content">
                      <strong>Discharge Plan (ถ้ามี)</strong><br />
                      เลือก Fit D/C date และสาเหตุ Delay ถ้าวันจำหน่ายจริงช้ากว่า
                    </div>
                  </div>
                  <div className="chat-input-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                    <div className="field-group" style={{ maxWidth: 260 }}>
                      <label>Fit D/C date</label>
                      <input
                        type="date"
                        value={chatFitDate}
                        onChange={(e) => setChatFitDate(e.target.value)}
                        className="chat-date-input"
                      />
                    </div>
                    {chatFitDate && chatDcDate > chatFitDate && (
                      <>
                        <div className="field-group" style={{ maxWidth: 260 }}>
                          <label>สาเหตุ Delay</label>
                          <select
                            value={chatDelayReason}
                            onChange={(e) => setChatDelayReason(e.target.value)}
                            className="chat-date-input"
                          >
                            <option value="">-- เลือกสาเหตุ --</option>
                            {DELAY_REASON_OPTIONS.map((o) => (
                              <option key={o.key} value={o.key}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        {chatDelayReason === "other" && (
                          <div className="field-group" style={{ maxWidth: 320 }}>
                            <label>รายละเอียดเพิ่มเติม</label>
                            <input
                              type="text"
                              placeholder="อื่นๆ (ระบุ)"
                              value={chatDelayDetail}
                              onChange={(e) => setChatDelayDetail(e.target.value)}
                              className="chat-date-input"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="chat-confirm-row">
                    <button type="button" className="chat-confirm-btn yes" onClick={chatDoDc} disabled={chatLoading}>
                      {chatLoading ? "กำลังบันทึก..." : "✓ ยืนยัน D/C"}
                    </button>
                    <button type="button" className="chat-confirm-btn no" onClick={resetChat} disabled={chatLoading}>✗ ยกเลิก</button>
                  </div>
                </>
              )}

              {/* Step 4: Done */}
              {chatStep === "done" && chatDcResult && (
                <>
                  <div className="chat-bubble bot">
                    <Image src={`/${chatWard}head.png`} alt={chatWard} width={36} height={36} className="chat-bubble-avatar" />
                    <div className="chat-bubble-content">
                      {chatDcResult.ok
                        ? <>D/C HN {chatSelectedHn} สำเร็จแล้วค่ะ! 🎉{chatDcResult.los ? ` (LOS: ${chatDcResult.los} วัน)` : ""}<br />ขอบคุณที่กรอกข้อมูลนะคะ {isBlueWard ? "💙" : "💚"}</>
                        : <>เกิดข้อผิดพลาด: {chatDcResult.error} 😢</>
                      }
                    </div>
                  </div>
                  <div className="chat-confirm-row">
                    <button type="button" className="chat-confirm-btn yes" onClick={resetChat}>D/C รายถัดไป</button>
                    <button type="button" className="chat-confirm-btn no" onClick={() => { setActiveSection(null); resetChat(); }}>กลับเมนูหลัก</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── Form Mode ─── */}
          {chatMode === "form" && (
            <div className="chat-dc-form-mode">
              <div className="de-dc-form-row">
                <div className="field-group"><label>วันที่ D/C</label><input type="date" value={chatDcDate} onChange={(e) => setChatDcDate(e.target.value)} /></div>
                <div className="field-group" style={{ flex: "1 1 120px" }}><label>กรอก HN</label><input placeholder="เลข HN" value={chatSelectedHn} onChange={(e) => setChatSelectedHn(e.target.value)} /></div>
                <button
                  type="button"
                  disabled={!chatSelectedHn.trim() || chatLoading}
                  style={{ alignSelf: "flex-end" }}
                  onClick={async () => {
                    if (!chatSelectedHn.trim()) return;
                    const isDelayed = !!chatFitDate && chatDcDate > chatFitDate;
                    if (isDelayed && !chatDelayReason) {
                      flash("กรุณาเลือกสาเหตุ Delay Discharge", "error");
                      return;
                    }
                    const payload: DischargePlanPayload = {
                      code,
                      hn: chatSelectedHn.trim(),
                      dischargeDate: chatDcDate,
                      ...(chatFitDate ? { fitDischargeDate: chatFitDate } : {}),
                      ...(isDelayed && chatDelayReason ? { delayReason: chatDelayReason, delayDetail: chatDelayDetail } : {}),
                    };
                    setChatLoading(true);
                    try {
                      await addIpdDischarge(payload);
                      flash(`D/C HN ${chatSelectedHn} สำเร็จ`);
                      setChatSelectedHn("");
                      await Promise.all([loadOpenCases(code), loadToday(code)]);
                    } catch (err) { flash((err as Error).message, "error"); }
                    finally { setChatLoading(false); }
                  }}
                >
                  บันทึก D/C
                </button>
              </div>
              {chatWardCases.length > 0 && (
                <div className="de-dc-open">
                  <h3>ผู้ป่วยรอ D/C ใน {chatWard} ({chatWardCases.length} ราย)</h3>
                  <div className="de-dc-list">
                    {chatWardCases.map((c) => (
                      <div key={`${c.hn}-${c.admitDate}`} className="de-dc-item">
                        <button type="button" className="btn-sm" style={{ background: isBlueWard ? "#2563eb" : "#16a34a" }}
                          onClick={async () => {
                            if (!confirm(`ยืนยัน D/C HN ${c.hn} วันที่ ${chatDcDate}?`)) return;
                            const isDelayed = !!chatFitDate && chatDcDate > chatFitDate;
                            if (isDelayed && !chatDelayReason) {
                              flash("กรุณาเลือกสาเหตุ Delay Discharge", "error");
                              return;
                            }
                            const payload: DischargePlanPayload = {
                              code,
                              hn: c.hn,
                              dischargeDate: chatDcDate,
                              ...(chatFitDate ? { fitDischargeDate: chatFitDate } : {}),
                              ...(isDelayed && chatDelayReason ? { delayReason: chatDelayReason, delayDetail: chatDelayDetail } : {}),
                            };
                            setChatLoading(true);
                            try {
                              await addIpdDischarge(payload);
                              flash(`D/C HN ${c.hn} สำเร็จ`);
                              await Promise.all([loadOpenCases(code), loadToday(code)]);
                            } catch (err) { flash((err as Error).message, "error"); }
                            finally { setChatLoading(false); }
                          }}
                        >
                          D/C
                        </button>
                        <strong>{c.hn}</strong>
                        <span className="de-dc-date">Admit: {c.admitDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {chatWardCases.length === 0 && (
                <p style={{ color: "var(--muted)", textAlign: "center", padding: 16 }}>ไม่มีผู้ป่วยรอ D/C ใน {chatWard}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
