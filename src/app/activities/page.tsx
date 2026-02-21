"use client";

import { useEffect, useRef, useState } from "react";
import { ActivityItem, getActivities } from "@/lib/api";
import LoadingOverlay from "@/components/LoadingOverlay";

function toDriveDirectImageUrl(url?: string) {
  if (!url) return "";
  // /d/FILE_ID/ pattern (sharing URL)
  const m = url.match(/\/d\/([^/]+)/);
  if (m?.[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  // id=FILE_ID pattern (old uc link)
  const m2 = url.match(/[?&]id=([^&]+)/);
  if (m2?.[1]) return `https://lh3.googleusercontent.com/d/${m2[1]}`;
  return url;
}

function toYouTubeEmbedUrl(url?: string) {
  if (!url) return "";
  const short = url.match(/youtu\.be\/([^?&/]+)/);
  if (short?.[1]) return `https://www.youtube.com/embed/${short[1]}`;
  const full = url.match(/[?&]v=([^&]+)/);
  if (full?.[1]) return `https://www.youtube.com/embed/${full[1]}`;
  return "";
}

export default function ActivitiesPage() {
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    getActivities()
      .then((res) => setRows(res.rows || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  return (
    <section>
      <LoadingOverlay show={loading && rows.length === 0} text="กำลังโหลดกิจกรรม..." />

      <div className="page-header">
        <h1>📋 กิจกรรมหน่วยงานอายุรกรรม</h1>
        <p>รวมกิจกรรมดูแลพระสงฆ์อาพาธทั้ง OPD และ IPD</p>
      </div>

      {error && <div className="entry-msg error">เกิดข้อผิดพลาด: {error}</div>}

      {rows.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
          <p>ยังไม่มีกิจกรรม</p>
        </div>
      )}

      <div className="activity-grid">
        {rows.map((item) => {
          const img = toDriveDirectImageUrl(item.imageUrl);
          const yt = toYouTubeEmbedUrl(item.youtubeUrl);
          return (
            <article key={item.id} className="activity-card">
              {img && (
                <button
                  type="button"
                  className="activity-image-wrap"
                  onClick={() => setLightbox({ src: img, alt: item.imageCaption || item.title })}
                  aria-label="ขยายรูป"
                >
                  <img
                    src={img}
                    alt={item.imageCaption || item.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (!el.dataset.retry) {
                        el.dataset.retry = "1";
                        const fid = img.split("/d/")[1];
                        if (fid) el.src = `https://drive.google.com/thumbnail?id=${fid}&sz=w800`;
                      } else {
                        el.style.display = "none";
                      }
                    }}
                  />
                </button>
              )}
              {img && item.imageCaption && (
                <div className="activity-card-caption">{item.imageCaption}</div>
              )}
              <div className="activity-card-body">
                <div className="activity-card-meta">
                  <span className="activity-badge">{item.type}</span>
                  <span className="activity-date">{item.date}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                {yt && (
                  <div className="chart-card" style={{ marginTop: 12, padding: 0, overflow: "hidden" }}>
                    <iframe
                      src={yt}
                      style={{ width: "100%", height: 340, border: "none", display: "block" }}
                      allowFullScreen
                      title={`yt-${item.id}`}
                    />
                  </div>
                )}
                {item.externalUrl && (
                  <a href={item.externalUrl} target="_blank" rel="noreferrer" className="activity-card-link">
                    🔗 เปิดลิงก์ภายนอก
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {lightbox && (
        <div
          className="activity-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="รูปขยาย"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="activity-lightbox-close"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="ปิด"
          >
            ✕
          </button>
          <div className="activity-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.src} alt={lightbox.alt} referrerPolicy="no-referrer" />
            {lightbox.alt && <p className="activity-lightbox-caption">{lightbox.alt}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
