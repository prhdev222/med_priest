# SETUP CHECKLIST (TH)

## 1) สร้าง Google Sheet 3 ไฟล์
- `MEDPRIEST_STATS` (ไฟล์หลักที่ผูกกับ Apps Script)
- `MEDPRIEST_ACTIVITIES`
- `MEDPRIEST_ENCOURAGEMENT`

## 2) สร้างชีตและหัวตาราง
- ใน `MEDPRIEST_STATS`
  - ชีต `OPD`: `Date | Count`
  - ชีต `Consult`: `Date | Count`
  - ชีต `IPD_Stays`: `HN | Ward | AdmitDate | DischargeDate | LOS`
- ใน `MEDPRIEST_ACTIVITIES`
  - ชีต `Activities`: `id | date | title | detail | type | imageUrl | imageCaption | youtubeUrl | externalUrl`
- ใน `MEDPRIEST_ENCOURAGEMENT`
  - ชีต `Encouragement`: `id | date | name | message`

## 3) ตั้งค่า Apps Script
- เปิดไฟล์ `MEDPRIEST_STATS` -> Extensions -> Apps Script
- วางโค้ดจาก `google-apps-script/Code.gs`
- Project Settings -> Script properties:
  - `UNIT_CODE` = รหัสหน่วยงาน
  - `ADMIN_CODE` = รหัสแอดมิน
  - `ACTIVITIES_SHEET_ID` = Spreadsheet ID ของ `MEDPRIEST_ACTIVITIES`
  - `ENCOURAGEMENT_SHEET_ID` = Spreadsheet ID ของ `MEDPRIEST_ENCOURAGEMENT`

## 4) Deploy Web App
- Deploy -> New deployment -> Web app (ครั้งแรก)
- ถ้าแก้ `Code.gs` ภายหลัง ให้ไป Deploy -> Manage deployments -> Edit -> Deploy (ห้ามลืมขั้นตอนนี้)
- Execute as: `Me`
- Who has access: `Anyone`
- Copy URL ลง `.env.local`:

```env
SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXX/exec
```

- ถ้า URL เดิมแต่ยังเป็นโค้ดเก่า ให้ Deploy ซ้ำจน version ใหม่ถูกใช้งาน

## 5) รันเว็บ
```bash
npm install
npm run dev
```

- เปิด `http://localhost:3000`
