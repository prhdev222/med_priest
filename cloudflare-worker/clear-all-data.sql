-- ========================================
-- ล้างข้อมูลทั้งหมดใน D1 (ใช้เมื่อจะใช้จริง — เริ่มต้นใหม่)
-- ไม่ลบโครงสร้างตาราง แค่ลบแถวทั้งหมด
-- ========================================
-- วิธีใช้: ไปที่ Cloudflare Dashboard → Workers & Pages → D1 → เลือก database → Console
-- แล้ว copy วางและรันทีละบล็อก หรือรันทั้งหมด
-- ========================================

DELETE FROM opd;
DELETE FROM er;
DELETE FROM consult;
DELETE FROM ipd_stays;
DELETE FROM activities;
DELETE FROM encouragement;
DELETE FROM procedures;

-- (ถ้าต้องการ reset id ให้เริ่ม 1 ใหม่ — SQLite/D1 ไม่มี TRUNCATE แบบ reset)
-- ไม่จำเป็นต้องทำ เพราะ AUTOINCREMENT จะใช้เลขถัดไปอยู่ดี
