"use client";

import { useEffect, useMemo, useState } from "react";
import { getKnowledgeLinks, getKnowledgeTags, KnowledgeLinkRow, KnowledgeTagRow } from "@/lib/api";

export default function KnowledgePage() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<number>(0);
  const [tags, setTags] = useState<KnowledgeTagRow[]>([]);
  const [links, setLinks] = useState<KnowledgeLinkRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [t, l] = await Promise.all([
        getKnowledgeTags(),
        getKnowledgeLinks({ q: q.trim() || undefined, tag: tag || undefined }),
      ]);
      setTags(t.rows);
      setLinks(l.rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  const pinned = useMemo(() => links.filter((l) => Number(l.isPinned) === 1), [links]);
  const others = useMemo(() => links.filter((l) => Number(l.isPinned) !== 1), [links]);

  return (
    <section>
      <div className="page-header">
        <h1>📚 คลังความรู้</h1>
        <p>รวมเว็บ/เครื่องมือช่วยตรวจผู้ป่วย — ค้นหาและกรองตามแท็กได้</p>
      </div>

      <div className="knowledge-panel">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field-group" style={{ flex: "1 1 280px" }}>
            <label>ค้นหา</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="เช่น stroke, warfarin, inr..."
              onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            />
          </div>
          <div className="field-group" style={{ minWidth: 200 }}>
            <label>แท็ก</label>
            <select value={tag} onChange={(e) => setTag(Number(e.target.value) || 0)}>
              <option value={0}>ทั้งหมด</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <button className="btn-sm" onClick={load} disabled={loading} style={{ height: 44, background: "#2563eb", color: "#fff" }}>
            {loading ? "กำลังโหลด..." : "ค้นหา"}
          </button>
        </div>
      </div>

      {pinned.length > 0 && (
        <div className="knowledge-panel" style={{ marginTop: 14, borderColor: "#f59e0b" }}>
          <h2 className="knowledge-h2">📌 ปักหมุด</h2>
          <div className="knowledge-grid">
            {pinned.map((l) => (
              <a key={l.id} className="knowledge-card" href={l.url} target="_blank" rel="noopener noreferrer">
                <div className="knowledge-card-top">
                  <span className="knowledge-icon">{l.icon || "🔗"}</span>
                  <span className="knowledge-title">{l.title}</span>
                  <span className="knowledge-arrow">↗</span>
                </div>
                {l.description && <div className="knowledge-desc">{l.description}</div>}
                {l.tags?.length > 0 && (
                  <div className="knowledge-tags">
                    {l.tags.map((t) => (
                      <span key={t.id} className="knowledge-tag" style={{ borderColor: t.color || "#334155" }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="knowledge-panel" style={{ marginTop: 14 }}>
        <h2 className="knowledge-h2">ทั้งหมด ({others.length})</h2>
        {others.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>ยังไม่มีลิงก์</p>
        ) : (
          <div className="knowledge-grid">
            {others.map((l) => (
              <a key={l.id} className="knowledge-card" href={l.url} target="_blank" rel="noopener noreferrer">
                <div className="knowledge-card-top">
                  <span className="knowledge-icon">{l.icon || "🔗"}</span>
                  <span className="knowledge-title">{l.title}</span>
                  <span className="knowledge-arrow">↗</span>
                </div>
                {l.description && <div className="knowledge-desc">{l.description}</div>}
                {l.tags?.length > 0 && (
                  <div className="knowledge-tags">
                    {l.tags.map((t) => (
                      <span key={t.id} className="knowledge-tag" style={{ borderColor: t.color || "#334155" }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

