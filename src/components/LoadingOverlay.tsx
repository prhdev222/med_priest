"use client";

type LoadingOverlayProps = {
  show: boolean;
  text?: string;
};

export default function LoadingOverlay({ show, text = "กำลังโหลดข้อมูล... กรุณารอสักครู่" }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-label="loading">
      <div className="loading-card">
        <div className="hourglass" aria-hidden="true">
          ⏳
        </div>
        <div>{text}</div>
      </div>
    </div>
  );
}
