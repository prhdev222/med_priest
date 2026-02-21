# Deploy MED Priest ขึ้น Vercel (จาก GitHub)

## ขั้นตอน

### 1. Push โค้ดขึ้น GitHub (ถ้ายังไม่ได้ push)

```bash
cd "c:\Users\urare\OneDrive\Documents\medpriest"
git add .
git commit -m "your message"
git push origin main
```

### 2. เชื่อม Vercel กับ GitHub

1. ไปที่ **[vercel.com](https://vercel.com)** แล้ว Sign in (ใช้ GitHub ได้)
2. คลิก **Add New…** → **Project**
3. เลือก **Import Git Repository** แล้วเลือก **prhdev222/med_priest**
4. ตั้งค่าโปรเจกต์:
   - **Framework Preset:** Next.js (เดาให้อัตโนมัติ)
   - **Root Directory:** `./` (เว้นว่างหรือใส่ `.` ถ้า repo คือ medpriest ทั้งหมด)
   - **Environment Variables:** ถ้ามี `.env` ให้เพิ่มใน Vercel (Settings → Environment Variables)
     - ตัวอย่าง: ค่าที่ใช้ใน `.env.local` เช่น API URL, keys ต่างๆ
5. คลิก **Deploy**

### 3. หลัง Deploy

- ทุกครั้งที่ `git push origin main` → Vercel จะ build และ deploy ให้เอง (Preview/Production ตาม branch)
- ดู URL ได้ที่ Dashboard โปรเจกต์ (เช่น `med-priest.vercel.app` หรือโดเมนที่ตั้งไว้)
- ต้องการ custom domain: Project → **Settings** → **Domains**

## หมายเหตุ

- **Environment Variables:** ค่าลับ (API keys, `.env.local`) ต้องใส่ใน Vercel → Project → **Settings** → **Environment Variables** ไม่ต้อง push ไฟล์ `.env` ขึ้น GitHub
- โปรเจกต์นี้เป็น Next.js 14 — Vercel รองรับโดยไม่ต้องตั้งค่าเพิ่ม
