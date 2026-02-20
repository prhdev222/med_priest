"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { EncouragementItem, getEncouragement, postEncouragement } from "@/lib/api";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function EncouragementPage() {
  const [rows, setRows] = useState<EncouragementItem[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const loadedRef = useRef(false);

  async function load() {
    setLoadingList(true);
    try {
      const res = await getEncouragement();
      setRows(res.rows || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoadingSubmit(true);
    try {
      await postEncouragement({ code, name, message });
      setMessage("");
      setName("");
      setSuccess("ส่งข้อความสำเร็จ!");
      setTimeout(() => setSuccess(""), 4000);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingSubmit(false);
    }
  }

  return (
    <section>
      <LoadingOverlay
        show={(loadingList && rows.length === 0) || loadingSubmit}
        text="กำลังโหลดข้อมูล..."
      />

      <div className="page-header">
        <h1>💛 ข้อความจากเพื่อนร่วมงาน</h1>
        <p>เหนื่อยได้ แต่ไม่ต้องเหนื่อยคนเดียว — ส่งกำลังใจให้กันและกัน</p>
      </div>

      {error && <div className="entry-msg error">{error}</div>}
      {success && <div className="entry-msg success">{success}</div>}

      {/* Messages */}
      {rows.length === 0 && !loadingList && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>💬</div>
          <p>ยังไม่มีข้อความ — มาเป็นคนแรกที่ส่งกำลังใจ!</p>
        </div>
      )}

      <div className="enc-grid" style={{ marginBottom: 24 }}>
        {rows.map((r) => (
          <div key={r.id} className="enc-card">
            <div className="enc-card-message">&ldquo;{r.message}&rdquo;</div>
            <div className="enc-card-footer">
              <span className="enc-card-name">— {r.name || "ไม่ระบุชื่อ"}</span>
              <span className="enc-card-date">{r.date}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Submit Form */}
      <div className="enc-form-card">
        <h2>✍️ ส่งกำลังใจ</h2>
        <p className="enc-form-hint">กรอก Unit Code เพื่อส่งข้อความ</p>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <div className="field-grid-2">
            <div className="field-group">
              <label>ชื่อผู้ส่ง</label>
              <input placeholder="ชื่อเล่น หรือไม่ใส่ก็ได้" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field-group">
              <label>รหัสหน่วยงาน</label>
              <input
                placeholder="Unit Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                type="password"
              />
            </div>
          </div>
          <div className="field-group">
            <label>ข้อความกำลังใจ</label>
            <textarea
              placeholder="พิมพ์ข้อความให้กำลังใจเพื่อนร่วมงาน..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={3}
            />
          </div>
          <button disabled={loadingSubmit} style={{ justifySelf: "start" }}>
            {loadingSubmit ? "กำลังส่ง..." : "💌 ส่งข้อความ"}
          </button>
        </form>
      </div>
    </section>
  );
}
