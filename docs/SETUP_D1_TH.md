# คู่มือ Setup Cloudflare D1 (แทน Google Sheets)

## ทำไมถึงย้าย?
| | Google Sheets + Apps Script | Cloudflare D1 |
|---|---|---|
| **ความเร็ว** | 3–15 วินาที/request | **< 100ms/request** |
| **ข้อมูลเยอะ** | ช้าลงมาก เกิน 2000 แถว timeout | เร็วเท่าเดิม แม้หลายหมื่นแถว |
| **ฟรี** | ฟรี | ฟรี (5GB, 5M reads/day) |
| **จำกัด project** | ไม่จำกัด | ไม่จำกัด database |

---

## ขั้นตอน (ทำครั้งเดียว ใช้เวลาประมาณ 15 นาที)

### 1. สมัคร Cloudflare (ถ้ายังไม่มี)
- ไปที่ https://dash.cloudflare.com/sign-up
- สมัครฟรี (ไม่ต้องใส่บัตรเครดิต)

### 2. ติดตั้ง Wrangler CLI
เปิด Terminal แล้วรัน:
```bash
npm install -g wrangler
```

### 3. Login เข้า Cloudflare
```bash
wrangler login
```
จะเปิด browser ให้กด **Allow** เพื่ออนุญาต

### 4. สร้าง D1 Database
```bash
cd cloudflare-worker
wrangler d1 create medpriest-db
```
จะได้ output แบบนี้:
```
✅ Successfully created DB 'medpriest-db'
database_id = "abc12345-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
**คัดลอก `database_id`** แล้วไปแก้ไฟล์ `wrangler.toml`:
```toml
database_id = "abc12345-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 5. สร้างตาราง + ใส่ข้อมูลตัวอย่าง
```bash
# สร้างตาราง (remote = ของจริงบน Cloudflare)
npm run db:init:remote

# ใส่ข้อมูลตัวอย่าง
npm run db:seed:remote
```

### 6. ตั้งค่ารหัสผ่าน (secrets) — **ไม่มีการ hardcode ในโค้ด**
รหัสเก็บใน **Cloudflare Secrets** เท่านั้น (เข้ารหัส ไม่เห็นใน repo หรือ build)
```bash
# ตั้ง UNIT_CODE (รหัสหน่วยงาน — ใช้ที่หน้า กรอกข้อมูล)
wrangler secret put UNIT_CODE
# พิมพ์รหัสที่ตั้งเอง (แนะนำ: ยาว 8+ ตัว ผสมอักษร+ตัวเลข) แล้วกด Enter

# ตั้ง ADMIN_CODE (รหัสแอดมิน — ใช้ที่หน้า จัดการข้อมูล)
wrangler secret put ADMIN_CODE
# พิมพ์รหัสที่ตั้งเอง (แนะนำ: ยาว 8+ ตัว แยกจาก UNIT_CODE) แล้วกด Enter
```
**อย่าใช้รหัสตัวอย่างจากเอกสาร** — ให้ตั้งรหัสใหม่ที่คนอื่นเดาไม่ได้

### 7. ติดตั้ง dependencies + Deploy
```bash
npm install
npm run deploy
```
จะได้ URL แบบนี้:
```
https://medpriest-api.YOUR_USERNAME.workers.dev
```

### 8. อัปเดต Next.js ให้ใช้ D1
แก้ไฟล์ `.env.local` ในโปรเจค medpriest:
```env
SCRIPT_URL=https://medpriest-api.YOUR_USERNAME.workers.dev
```
(เปลี่ยนจาก URL ของ Apps Script เดิม)

ถ้า deploy บน Vercel ให้ไปแก้ Environment Variables ที่ Vercel Dashboard ด้วย

### 9. ทดสอบ
```bash
# ทดสอบ API โดยตรง
curl "https://medpriest-api.YOUR_USERNAME.workers.dev?action=stats&from=2026-01-01&to=2026-12-31&group=day"

# ทดสอบผ่าน Next.js
npm run dev
# เปิด http://localhost:3000
```

---

## ความปลอดภัยของรหัส (UNIT_CODE / ADMIN_CODE)
- **รหัสไม่ถูก hardcode ในโค้ด** — Backend (Cloudflare Worker) อ่านจาก **Secrets** เท่านั้น
- **อย่าคอมมิตรหัสลง Git** — ใช้เฉพาะ `wrangler secret put` หรือ Cloudflare Dashboard
- **แนะนำ:** ใช้รหัสยาว 8–16 ตัวขึ้นไป ผสมตัวอักษรและตัวเลข (หรือใช้เครื่องมือสร้างรหัสสุ่ม)
- **แยกรหัสหน่วยงานกับรหัสแอดมิน** — อย่าใช้รหัสเดียวกัน
- **ถ้ารหัสรั่วไหล:** เปลี่ยนทันทีด้วย `wrangler secret put UNIT_CODE` หรือ `ADMIN_CODE`

---

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รัน Worker ใน local (ทดสอบ) |
| `npm run deploy` | Deploy Worker ขึ้น Cloudflare |
| `npm run db:init:remote` | สร้างตารางบน D1 จริง |
| `npm run db:seed:remote` | ใส่ข้อมูลตัวอย่างบน D1 จริง |
| **`npm run db:clear:remote`** | **ล้างข้อมูลทั้งหมดบน D1 จริง (ใช้เมื่อจะใช้จริง — เริ่มต้นใหม่)** |
| `wrangler d1 execute medpriest-db --remote --command "SELECT * FROM opd"` | Query ข้อมูลบน D1 จริง |
| `wrangler secret put UNIT_CODE` | เปลี่ยน Unit Code |
| `wrangler secret put ADMIN_CODE` | เปลี่ยน Admin Code |

---

## โครงสร้างตาราง

| ตาราง | คอลัมน์ | หมายเหตุ |
|---|---|---|
| `opd` | id, date, count | ผู้ป่วยนอก/วัน |
| `er` | id, date, count | ER ผู้ป่วยนอก/วัน (แยกจาก OPD) |
| `consult` | id, date, count | ปรึกษานอกแผนก/วัน |
| `ipd_stays` | id, hn, ward, admit_date, discharge_date, los, stay_type | ผู้ป่วยใน (stay_type: admit=มี HN/LOS, ao=คนไข้ฝากนอน) |
| `activities` | id, date, title, detail, type, image_url, image_caption, youtube_url, external_url | กิจกรรม |
| `encouragement` | id, date, name, message | ข้อความให้กำลังใจ |
| `procedures` | id, date, procedure_key, procedure_label, count | หัตถการเฉพาะ (Ward/ER/OPD/Consult) |

---

## อัปเดตเพิ่มตาราง ER (สำหรับ DB ที่มีอยู่แล้ว)
ถ้าเคยสร้าง D1 มาก่อนและต้องการเพิ่ม "ER ผู้ป่วยนอก" ให้รันคำสั่งนี้ในโฟลเดอร์ `cloudflare-worker`:
```bash
wrangler d1 execute medpriest-db --remote --command "CREATE TABLE IF NOT EXISTS er ( id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0 ); CREATE INDEX IF NOT EXISTS idx_er_date ON er(date);"
```

---

## อัปเดตเพิ่มตาราง procedures (หัตถการเฉพาะ)
ถ้าเคยสร้าง D1 มาก่อนและต้องการเพิ่ม "หัตถการเฉพาะ" ให้รันคำสั่งนี้ในโฟลเดอร์ `cloudflare-worker`:
```bash
wrangler d1 execute medpriest-db --remote --command "CREATE TABLE IF NOT EXISTS procedures ( id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, procedure_key TEXT NOT NULL, procedure_label TEXT DEFAULT '', count INTEGER NOT NULL DEFAULT 1 ); CREATE INDEX IF NOT EXISTS idx_procedures_date ON procedures(date);"
```

---

## อัปเดต ipd_stays เพิ่ม stay_type (Admit / A/O)
ถ้าเคยสร้าง D1 มาก่อนและต้องการแบ่ง Ward เป็น Admit (มี HN, คำนวณ LOS) กับ A/O (คนไข้ฝากนอน, นับจำนวนอย่างเดียว) ให้รัน:
```bash
wrangler d1 execute medpriest-db --remote --command "ALTER TABLE ipd_stays ADD COLUMN stay_type TEXT DEFAULT 'admit';"
```

---

## ล้างข้อมูลทั้งหมด (เมื่อจะใช้จริง)
ถ้าเคยใส่ข้อมูลตัวอย่างหรือข้อมูลทดสอบ และต้องการ**เริ่มต้นใหม่** ให้รันในโฟลเดอร์ `cloudflare-worker`:
```bash
npm run db:clear:remote
```
จะลบแถวทั้งหมดในตาราง `opd`, `er`, `consult`, `ipd_stays`, `activities`, `encouragement`, `procedures` (ไม่ลบโครงสร้างตาราง)

หรือรัน SQL เองใน Cloudflare Dashboard → D1 → เลือก database → Console โดยใช้ไฟล์ `cloudflare-worker/clear-all-data.sql`

---

## หมายเหตุ
- **Google Sheets ยังใช้ได้** ถ้าอยากกลับไปใช้ แค่เปลี่ยน `SCRIPT_URL` กลับเป็น Apps Script URL เดิม
- **ข้อมูลเดิมใน Sheets** ไม่ถูกลบ สามารถ export มาใส่ D1 ได้ทีหลัง
- **ค่าใช้จ่าย**: Free plan ให้ 5M reads + 100K writes/day ซึ่งเหลือเฟือ
