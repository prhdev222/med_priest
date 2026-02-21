# Deploy ขึ้น Vercel (จาก GitHub)

## 1. Push โค้ดขึ้น GitHub (ทำแล้ว)
- Repo: **https://github.com/prhdev222/med_priest**
- Branch: `main`

## 2. เชื่อม Vercel กับ GitHub
1. ไปที่ [vercel.com](https://vercel.com) แล้ว Sign in with GitHub
2. คลิก **Add New** → **Project**
3. เลือก repo **prhdev222/med_priest** (ถ้าไม่เห็นให้กด Import จาก GitHub)
4. Framework Preset: **Next.js** (Vercel จะ detect อัตโนมัติ)
5. Root Directory: ว่างไว้ (ใช้ root ของ repo)
6. Build Command: `npm run build` (ค่าเริ่มต้น)
7. Output Directory: `.next` (ค่าเริ่มต้น)

## 3. ตั้งค่า Environment Variable
ก่อนกด Deploy ให้เพิ่มตัวแปร:

| Name        | Value                                      |
|------------|---------------------------------------------|
| `SCRIPT_URL` | `https://medpriest-api.uradev222.workers.dev` |

(หรือ URL ของ Cloudflare Worker ที่ใช้เป็น Backend จริง)

- คลิก **Environment Variables** แล้วใส่ `SCRIPT_URL`
- เลือก Environment: **Production** (และ Preview ถ้าต้องการ)

## 4. Deploy
- กด **Deploy**
- รอ build เสร็จ จะได้ URL เช่น `med-priest-xxx.vercel.app`

## 5. หลังแก้โค้ด
- แก้แล้ว `git push origin main` → Vercel จะ deploy ใหม่อัตโนมัติ (ถ้าเชื่อม GitHub ไว้แล้ว)
