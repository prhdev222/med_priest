# MedPriest Dashboard

เว็บ Dashboard สำหรับหน่วยงานอายุรกรรม โรงพยาบาลสงฆ์

## หน้าหลัก
- `/` Dashboard สถิติ OPD / Consult / IPD Admit / IPD D/C และ LOS
- `/data-entry` หน้ากรอกข้อมูล (ใช้ Unit Code)
- `/activities` หน้ากิจกรรม
- `/encouragement` หน้าให้กำลังใจ
- `/admin` หน้าจัดการข้อมูล (ใช้ Admin Code)

## เชื่อม Google Apps Script
กำหนดใน `.env.local`

```env
SCRIPT_URL=<YOUR_APPS_SCRIPT_WEBAPP_URL>
```

## เริ่มใช้งาน
```bash
npm install
npm run dev
```
