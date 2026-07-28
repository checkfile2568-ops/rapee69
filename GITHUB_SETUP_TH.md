# คู่มืออัปโหลดระบบขึ้น GitHub Pages

## ไฟล์ชุดนี้พร้อมอัปโหลดแล้ว

ให้อัปโหลด **ไฟล์และโฟลเดอร์ทั้งหมดที่อยู่ภายในชุดนี้** ไปไว้ที่ระดับบนสุดของ Repository โดยต้องเห็น `index.html` อยู่หน้าแรกของ Repository

```text
index.html
control.html
display.html
mobile-control.html
styles.css
app.js
control.js
display.js
mobile-control.js
firebase-config.js
firebase-sync.js
APPS_SCRIPT_QR_SETUP_TH.md
.nojekyll
assets/
```

## ขั้นตอนบน GitHub

1. สร้าง Repository ใหม่ เช่น `rapee69-draw-system`
2. เลือก **Public**
3. กด **Add file → Upload files**
4. ลากไฟล์ทั้งหมดจากโฟลเดอร์นี้ขึ้น GitHub
5. Commit message แนะนำ:

```text
ติดตั้งระบบจับฉลากฟุตบอลวันรพี 69 เวอร์ชัน 1.7
```

6. เข้า **Settings → Pages**
7. Source เลือก **Deploy from a branch**
8. Branch เลือก `main`
9. Folder เลือก `/ (root)`
10. กด **Save**

## ลิงก์ใช้งาน

สมมติบัญชีชื่อ `checkfile2568-ops` และ Repository ชื่อ `rapee69-draw-system`

```text
หน้าหลัก
https://checkfile2568-ops.github.io/rapee69-draw-system/

หน้าควบคุม
https://checkfile2568-ops.github.io/rapee69-draw-system/control.html

หน้าจอนำเสนอ
https://checkfile2568-ops.github.io/rapee69-draw-system/display.html

หน้าควบคุมมือถือ
https://checkfile2568-ops.github.io/rapee69-draw-system/mobile-control.html
```

## วิธีใช้กับ Google Meet

เปิด 3 แท็บใน Chrome โปรไฟล์เดียวกัน:

1. Google Meet
2. `control.html`
3. `display.html`

จาก Meet เลือก **นำเสนอทันที → แท็บ → เลือก display.html**

## ใช้มือถือคนละเครื่อง

แนะนำตั้งค่า Apps Script ตาม `APPS_SCRIPT_QR_SETUP_TH.md` ก่อน จากนั้นเปิด `control.html` แล้วกด **เริ่ม / แสดง QR ควบคุมมือถือ** หน้ามือถือจะเชื่อมผ่าน QR นี้ได้แม้อยู่คนละเครือข่าย หากยังไม่ตั้งค่า Apps Script หรือ Firebase หน้าควบคุมมือถือจะไม่เชื่อมไปยังคอมคนละเครื่อง แต่หน้าควบคุมบนคอมและการทำงานเดิมยังใช้งานได้ปกติ

## เมื่ออัปโหลดไฟล์แก้ไขทับของเดิม

หลัง Commit ให้กด `Ctrl + F5` ที่หน้าระบบ เพื่อบังคับโหลด CSS และ JavaScript เวอร์ชันใหม่
