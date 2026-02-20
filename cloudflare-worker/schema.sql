-- ========================================
-- MedPriest D1 Database Schema
-- ========================================

CREATE TABLE IF NOT EXISTS opd (
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
  los            INTEGER DEFAULT 0
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

-- Indexes for fast date-range queries
CREATE INDEX IF NOT EXISTS idx_opd_date ON opd(date);
CREATE INDEX IF NOT EXISTS idx_consult_date ON consult(date);
CREATE INDEX IF NOT EXISTS idx_ipd_admit ON ipd_stays(admit_date);
CREATE INDEX IF NOT EXISTS idx_ipd_discharge ON ipd_stays(discharge_date);
