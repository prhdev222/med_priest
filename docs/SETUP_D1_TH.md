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

### 6. ตั้งค่ารหัสผ่าน (secrets)
```bash
# ตั้ง UNIT_CODE
wrangler secret put UNIT_CODE
# พิมพ์ค่า เช่น MED222 แล้วกด Enter

# ตั้ง ADMIN_CODE
wrangler secret put ADMIN_CODE
# พิมพ์ค่า เช่น ADMIN222 แล้วกด Enter
```

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

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รัน Worker ใน local (ทดสอบ) |
| `npm run deploy` | Deploy Worker ขึ้น Cloudflare |
| `npm run db:init:remote` | สร้างตารางบน D1 จริง |
| `npm run db:seed:remote` | ใส่ข้อมูลตัวอย่างบน D1 จริง |
| `wrangler d1 execute medpriest-db --remote --command "SELECT * FROM opd"` | Query ข้อมูลบน D1 จริง |
| `wrangler secret put UNIT_CODE` | เปลี่ยน Unit Code |
| `wrangler secret put ADMIN_CODE` | เปลี่ยน Admin Code |

---

## โครงสร้างตาราง

| ตาราง | คอลัมน์ | หมายเหตุ |
|---|---|---|
| `opd` | id, date, count | ผู้ป่วยนอก/วัน |
| `consult` | id, date, count | ปรึกษานอกแผนก/วัน |
| `ipd_stays` | id, hn, ward, admit_date, discharge_date, los | ผู้ป่วยใน |
| `activities` | id, date, title, detail, type, image_url, image_caption, youtube_url, external_url | กิจกรรม |
| `encouragement` | id, date, name, message | ข้อความให้กำลังใจ |

---

## หมายเหตุ
- **Google Sheets ยังใช้ได้** ถ้าอยากกลับไปใช้ แค่เปลี่ยน `SCRIPT_URL` กลับเป็น Apps Script URL เดิม
- **ข้อมูลเดิมใน Sheets** ไม่ถูกลบ สามารถ export มาใส่ D1 ได้ทีหลัง
- **ค่าใช้จ่าย**: Free plan ให้ 5M reads + 100K writes/day ซึ่งเหลือเฟือ
