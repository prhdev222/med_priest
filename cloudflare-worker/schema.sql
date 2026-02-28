-- ========================================
-- MedPriest D1 Database Schema
-- ========================================

CREATE TABLE IF NOT EXISTS opd (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  date  TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS er (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  date  TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS consult (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  date  TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ipd_stays (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  hn             TEXT NOT NULL,
  ward           TEXT NOT NULL,
  admit_date     TEXT NOT NULL,
  discharge_date TEXT DEFAULT '',
  los            INTEGER DEFAULT 0,
  stay_type      TEXT DEFAULT 'admit'
);

CREATE TABLE IF NOT EXISTS activities (
  id            TEXT PRIMARY KEY,
  date          TEXT DEFAULT '',
  title         TEXT DEFAULT '',
  detail        TEXT DEFAULT '',
  type          TEXT DEFAULT '',
  image_url     TEXT DEFAULT '',
  image_caption TEXT DEFAULT '',
  youtube_url   TEXT DEFAULT '',
  external_url  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS encouragement (
  id      TEXT PRIMARY KEY,
  date    TEXT DEFAULT '',
  name    TEXT DEFAULT '',
  message TEXT DEFAULT ''
);

-- หัตถการเฉพาะ (ใน Ward/ER/OPD/Consult แผนกอายุรกรรม)
CREATE TABLE IF NOT EXISTS procedures (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,
  procedure_key   TEXT NOT NULL,
  procedure_label TEXT DEFAULT '',
  count           INTEGER NOT NULL DEFAULT 1,
  ward            TEXT DEFAULT ''
);

-- Discharge Plan: Fit D/C date, Actual D/C, Delay reason (สำหรับ DIV KPI)
CREATE TABLE IF NOT EXISTS discharge_plans (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  ipd_stay_id          INTEGER NOT NULL,
  hn                   TEXT NOT NULL,
  ward                 TEXT NOT NULL,
  fit_discharge_date   TEXT DEFAULT '',
  actual_discharge_date TEXT DEFAULT '',
  delay_days           INTEGER DEFAULT 0,
  delay_reason         TEXT DEFAULT '',
  delay_detail         TEXT DEFAULT '',
  created_at           TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (ipd_stay_id) REFERENCES ipd_stays(id)
);

-- Ward Bed Capacity: แต่ละ Ward กรอกได้วันนี้รับได้กี่เตียง (หรือจำนวนเตียงเดิม)
CREATE TABLE IF NOT EXISTS ward_beds (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  date      TEXT NOT NULL,
  ward      TEXT NOT NULL,
  beds      INTEGER NOT NULL DEFAULT 0,
  UNIQUE(date, ward)
);

-- Indexes for fast date-range queries
CREATE INDEX IF NOT EXISTS idx_opd_date ON opd(date);
CREATE INDEX IF NOT EXISTS idx_consult_date ON consult(date);
CREATE INDEX IF NOT EXISTS idx_er_date ON er(date);
CREATE INDEX IF NOT EXISTS idx_ipd_admit ON ipd_stays(admit_date);
CREATE INDEX IF NOT EXISTS idx_ipd_discharge ON ipd_stays(discharge_date);
CREATE INDEX IF NOT EXISTS idx_procedures_date ON procedures(date);
CREATE INDEX IF NOT EXISTS idx_procedures_ward ON procedures(ward);
CREATE INDEX IF NOT EXISTS idx_discharge_plans_actual ON discharge_plans(actual_discharge_date);
CREATE INDEX IF NOT EXISTS idx_ward_beds_date ON ward_beds(date);
CREATE INDEX IF NOT EXISTS idx_ward_beds_ward ON ward_beds(ward);
