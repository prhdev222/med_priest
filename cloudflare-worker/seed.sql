-- ========================================
-- ข้อมูลตัวอย่างสำหรับทดสอบ
-- ========================================

-- OPD (ผู้ป่วยนอก)
INSERT INTO opd (date, count) VALUES ('2026-02-10', 25);
INSERT INTO opd (date, count) VALUES ('2026-02-11', 28);
INSERT INTO opd (date, count) VALUES ('2026-02-12', 22);
INSERT INTO opd (date, count) VALUES ('2026-02-13', 30);
INSERT INTO opd (date, count) VALUES ('2026-02-14', 18);
INSERT INTO opd (date, count) VALUES ('2026-02-17', 26);
INSERT INTO opd (date, count) VALUES ('2026-02-18', 24);
INSERT INTO opd (date, count) VALUES ('2026-02-19', 27);

-- ER ผู้ป่วยนอก (ห้องฉุกเฉิน)
INSERT INTO er (date, count) VALUES ('2026-02-10', 5);
INSERT INTO er (date, count) VALUES ('2026-02-11', 6);
INSERT INTO er (date, count) VALUES ('2026-02-12', 4);
INSERT INTO er (date, count) VALUES ('2026-02-13', 7);
INSERT INTO er (date, count) VALUES ('2026-02-14', 3);
INSERT INTO er (date, count) VALUES ('2026-02-17', 5);
INSERT INTO er (date, count) VALUES ('2026-02-18', 4);
INSERT INTO er (date, count) VALUES ('2026-02-19', 6);

-- Consult (ปรึกษานอกแผนก)
INSERT INTO consult (date, count) VALUES ('2026-02-10', 3);
INSERT INTO consult (date, count) VALUES ('2026-02-11', 4);
INSERT INTO consult (date, count) VALUES ('2026-02-12', 2);
INSERT INTO consult (date, count) VALUES ('2026-02-13', 5);
INSERT INTO consult (date, count) VALUES ('2026-02-14', 3);
INSERT INTO consult (date, count) VALUES ('2026-02-17', 4);
INSERT INTO consult (date, count) VALUES ('2026-02-18', 3);
INSERT INTO consult (date, count) VALUES ('2026-02-19', 2);

-- IPD (ผู้ป่วยใน) - มีทั้ง discharge แล้วและยังค้างอยู่
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN001', 'MED1', '2026-02-08', '2026-02-12', 4);
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN002', 'MED2', '2026-02-09', '2026-02-14', 5);
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN003', 'ICU', '2026-02-10', '2026-02-13', 3);
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN004', 'IMC', '2026-02-11', '2026-02-15', 4);
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN005', 'Palliative', '2026-02-12', '2026-02-19', 7);
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN006', 'ward90', '2026-02-13', '2026-02-17', 4);
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN007', 'MED1', '2026-02-14', '2026-02-18', 4);
-- ยังค้างอยู่ (ยังไม่ D/C)
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN008', 'MED2', '2026-02-17', '', 0);
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN009', 'ICU', '2026-02-18', '', 0);
INSERT INTO ipd_stays (hn, ward, admit_date, discharge_date, los) VALUES ('HN010', 'MED1', '2026-02-19', '', 0);

-- Activities (กิจกรรม)
INSERT INTO activities (id, date, title, detail, type, image_url, image_caption, youtube_url, external_url) VALUES
  ('act-001', '2026-02-15', 'ตรวจสุขภาพพระสงฆ์ OPD', 'จัดตรวจสุขภาพเชิงรุกให้พระสงฆ์ที่มาตรวจ OPD ครอบคลุมโรค NCD', 'OPD', '', '', '', ''),
  ('act-002', '2026-02-12', 'อบรมการดูแลผู้ป่วยติดเตียง', 'จัดอบรมพยาบาลและผู้ช่วยในการดูแลผู้ป่วยติดเตียงอย่างถูกวิธี', 'IPD', '', '', '', ''),
  ('act-003', '2026-02-10', 'กิจกรรมสวดมนต์เพื่อผู้ป่วย', 'จัดกิจกรรมสวดมนต์เสริมกำลังใจให้ผู้ป่วยที่พักรักษาตัวใน ward', 'IPD', '', '', '', '');

-- Encouragement (ข้อความให้กำลังใจ)
INSERT INTO encouragement (id, date, name, message) VALUES
  ('enc-001', '2026-02-19', 'พี่แอน', 'วันนี้เหนื่อยมากแต่เห็นรอยยิ้มคนไข้แล้วหายเหนื่อยเลย สู้ๆ นะทุกคน!'),
  ('enc-002', '2026-02-18', 'หมอต้น', 'ขอบคุณทีมงานทุกคนที่ช่วยกันดูแลคนไข้อย่างดี แม้คนจะน้อยแต่ใจเราใหญ่'),
  ('enc-003', '2026-02-17', 'น้องมิ้นท์', 'ขอบคุณพี่ๆ ทุกคนที่คอยสอนงาน รู้สึกอบอุ่นมากค่ะ'),
  ('enc-004', '2026-02-15', 'พี่เจี๊ยบ', 'วันนี้มีคนไข้กลับบ้านได้ ดีใจจัง ทำงานต่อไปนะคะ');
