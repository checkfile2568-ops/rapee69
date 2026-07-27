# ตั้งค่าควบคุมมือถือด้วย Firebase แบบสั้น

ใช้เฉพาะเมื่อโทรศัพท์และคอมพิวเตอร์เป็นคนละเครื่อง หากไม่ตั้งค่า ระบบเดิมยังใช้ `control.html` ควบคุมจากคอมเครื่องเดียวได้ตามปกติ

## 1. สร้างฐานข้อมูล

1. เข้า [Firebase Console](https://console.firebase.google.com/) แล้วสร้าง Project ใหม่
2. กดเพิ่ม Web app (`</>`) ตั้งชื่อเช่น `rapee69-draw`
3. ไปที่ **Build → Realtime Database → Create Database** เลือกภูมิภาคใกล้ที่สุด และสร้างฐานข้อมูล
4. ไปที่ **Project settings → General → Your apps** คัดลอกค่า `firebaseConfig`

## 2. กรอกไฟล์ตั้งค่า

เปิด `firebase-config.js` แล้ววางค่าจาก Firebase Console ลงในช่องที่ตรงกัน โดยเฉพาะ `apiKey`, `projectId` และ `databaseURL` ห้ามปล่อยสามช่องนี้ว่าง

กำหนด `DRAW_FIREBASE_PATH` เป็นชื่อรอบงานเดียวกันในทุกอุปกรณ์ ตัวอย่าง:

```js
window.DRAW_FIREBASE_PATH = "rapee69/live-2569-07-31";
```

ใช้ชื่อที่เดายากขึ้นได้ เช่น `rapee69/live-2569-07-31-7x2q` แต่ต้องใช้ **ตรงกันทุกเครื่อง**

ไฟล์ `firebase-config.example.js` เป็นตัวอย่าง ไม่ต้องอัปโหลดแทน `firebase-config.js`

## 3. Rules แบบใช้งานชั่วคราว

เพราะเวอร์ชันนี้ตั้งใจให้เรียบง่ายและไม่มีระบบสมาชิก Firebase Rules ต้องเปิดให้ state ของงานนี้อ่านและเขียนได้ชั่วคราว ในหน้า **Realtime Database → Rules** ใช้รูปแบบนี้ โดยเปลี่ยนชื่อ path ให้ตรงกับข้อ 2:

```json
{
  "rules": {
    "rapee69": {
      "live-2569-07-31": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

ค่า Firebase Web Config ไม่ใช่รหัสผ่าน แต่ Rules คือส่วนคุ้มครองข้อมูล ดังนั้นหลังจบงานให้เปลี่ยน `.read` และ `.write` เป็น `false` หรือลบ state ใน path นี้ออกจากหน้า Data

## 4. ทดสอบก่อนงาน

1. อัปโหลดไฟล์ทั้งหมดขึ้น GitHub Pages แล้วกด `Ctrl + F5` บนคอม
2. เปิด `control.html` และ `display.html` บนคอม
3. เปิด `mobile-control.html` บนโทรศัพท์จาก URL เดียวกัน
4. แถบสถานะบนมือถือควรเป็น **“ซิงก์มือถือพร้อม”** สีเขียว
5. กดเปลี่ยนหน้า หรือเลือกรายการในโหมดซ้อม แล้วตรวจว่าหน้าจอนำเสนอเปลี่ยนตาม

หากมือถือไม่เชื่อม ให้ตรวจ `databaseURL`, path และ Rules ก่อน หากอินเทอร์เน็ตมีปัญหา ให้กลับไปควบคุมจาก `control.html` บนคอมได้ทันที โดยไม่ต้องรีเซ็ตระบบ
