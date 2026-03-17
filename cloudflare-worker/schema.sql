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

-- แผนหัตถการรายเตียง (สำหรับวางแผนล่วงหน้า และติ๊กทำแล้วในวันจริง)
CREATE TABLE IF NOT EXISTS procedure_plans (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_date        TEXT NOT NULL,
  ward             TEXT NOT NULL,
  bed              TEXT DEFAULT '',
  procedure_key    TEXT NOT NULL,
  procedure_label  TEXT DEFAULT '',
  note             TEXT DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'planned', -- planned | done | cancelled
  done_date        TEXT DEFAULT '',
  done_procedure_id INTEGER,
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);

-- PDPA: ข้อมูลคนไข้สำหรับ "แผนหัตถการ" (เก็บแบบเข้ารหัสเท่านั้น และลบทิ้งเมื่อทำแล้ว/ไม่ได้ทำ)
CREATE TABLE IF NOT EXISTS procedure_plan_patients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id    INTEGER NOT NULL UNIQUE,
  hn_enc     TEXT DEFAULT '',
  name_enc   TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (plan_id) REFERENCES procedure_plans(id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_proc_plans_date ON procedure_plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_proc_plans_ward ON procedure_plans(ward);
CREATE INDEX IF NOT EXISTS idx_proc_plans_status ON procedure_plans(status);
CREATE INDEX IF NOT EXISTS idx_proc_plan_patients_plan_id ON procedure_plan_patients(plan_id);
CREATE INDEX IF NOT EXISTS idx_discharge_plans_actual ON discharge_plans(actual_discharge_date);
CREATE INDEX IF NOT EXISTS idx_ward_beds_date ON ward_beds(date);
CREATE INDEX IF NOT EXISTS idx_ward_beds_ward ON ward_beds(ward);

-- ========================================
-- Knowledge Hub (คลังความรู้): Links + Tags
-- ========================================

CREATE TABLE IF NOT EXISTS knowledge_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon        TEXT DEFAULT '',
  is_pinned   INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_link_tags (
  link_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (link_id, tag_id),
  FOREIGN KEY (link_id) REFERENCES knowledge_links(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES knowledge_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_links_active ON knowledge_links(is_active, is_pinned, updated_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_link_tags_tag ON knowledge_link_tags(tag_id);
