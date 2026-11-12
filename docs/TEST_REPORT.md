# Test Report — Social Eyewear Booking V1.0

**วันที่ทดสอบ:** 12 พฤศจิกายน 2026 (Asia/Bangkok)
**สภาพแวดล้อม:** PostgreSQL 16.15 (จำลอง role/`auth` ของ Supabase ด้วย `supabase/tests/00_supabase_stub.sql`), Node.js 22, tsx, esbuild

## สรุป

| ชุดทดสอบ | ผล | หมายเหตุ |
|---|---|---|
| SQL functional + security (`supabase/tests/01_functional_tests.sql`) | **67 / 67 ผ่าน** | migration จริง บน PostgreSQL จริง |
| Concurrency (`supabase/tests/concurrency_test.sh`, 50 การเชื่อมต่อพร้อมกัน) | **9 / 9 ผ่าน × 5 รอบ** | การแข่งกันจริงระหว่าง process แยก |
| Unit tests (`npm test`) | **16 / 16 ผ่าน** | validation, เบอร์ไทย, ปฏิทิน, วันที่, CSV |
| Strict type-check (lib/booking, lib/validation, types, tests) | **ผ่าน** (tsc --strict) | |
| Syntax/JSX compile ทุกไฟล์ (57 ไฟล์ .ts/.tsx) | **ผ่าน** (esbuild) | |
| `next build` / type-check หน้า React + API routes | **ยังไม่ได้รัน** | สภาพแวดล้อมทดสอบไม่มีอินเทอร์เน็ตจึงติดตั้ง next/react/supabase-js ไม่ได้ — ต้องรัน `npm install && npm run build` ก่อน deploy |
| ทดสอบผ่านเบราว์เซอร์ / LINE / Supabase จริง / Vercel | **ยังไม่ได้รัน** | ต้องมี credentials จริง — ดูหัวข้อ "ต้องทดสอบหลังตั้งค่า" |

## 1. Concurrency (ข้อกำหนด Part 13)

```
PASS: 50 concurrent customers -> exactly 1 CREATED (got 1)
PASS: the other 49 get SLOT_TAKEN (got 49)
PASS: exactly 1 active row in DB for the slot (got 1)
PASS: 50 duplicate submits all answered OK (idempotent) (got 50)
PASS: only 1 of them actually CREATED (got 1)
PASS: only 1 row stored for the idempotency key (got 1)
PASS: holiday race: every booking that got in is reported to admin (none lost/hidden) (got 9)
PASS: after holiday is set, new bookings are refused (got HOLIDAY)
PASS: close-vs-book race is consistent (created=1, close=HAS_BOOKING)
ALL CONCURRENCY TESTS PASSED
```

- **50 ลูกค้าจองรอบเดียวกันพร้อมกัน** → สำเร็จ 1 คน อีก 49 คนได้ `SLOT_TAKEN` ("ขออภัย รอบนี้เพิ่งถูกจองไปแล้ว")
- **คำขอเดิมถูกส่ง 50 ครั้งพร้อมกัน** (ดับเบิลคลิก / retry หลัง timeout / รีเฟรช) → ทุกคำขอได้คำตอบสำเร็จ แต่สร้างแถวเพียง 1 แถว
- **Admin ตั้งวันหยุด ขณะลูกค้ากำลังจองวันเดียวกัน** → ทุกการจองที่เข้าก่อนถูกรายงานให้ admin ครบ ไม่มีรายการตกหล่น และการจองหลังจากนั้นถูกปฏิเสธ (รันซ้ำ 5 รอบ ได้ผลลำดับต่างกัน 0/4/9 รายการ ทุกกรณีสอดคล้อง)
- **Admin ปิดรอบ ขณะลูกค้ากำลังจองรอบนั้น** → ผลสอดคล้องเสมอ: ถ้าลูกค้าได้ก่อน admin ได้คำเตือน `HAS_BOOKING`; ถ้า admin ได้ก่อน ลูกค้าได้ `SLOT_CLOSED`

## 2. SQL functional + security (67 รายการ)

psql:supabase/tests/01_functional_tests.sql:28: NOTICE:  PASS: anon: availability returns 9 slots/day
psql:supabase/tests/01_functional_tests.sql:29: NOTICE:  PASS: anon: all 9 slots available by default
psql:supabase/tests/01_functional_tests.sql:31: NOTICE:  PASS: anon cannot read bookings table
psql:supabase/tests/01_functional_tests.sql:34: NOTICE:  PASS: anon cannot call create_booking directly
psql:supabase/tests/01_functional_tests.sql:36: NOTICE:  PASS: anon cannot write holidays
psql:supabase/tests/01_functional_tests.sql:43: NOTICE:  PASS: create booking -> CREATED
psql:supabase/tests/01_functional_tests.sql:44: NOTICE:  PASS: booking code format SE-YYMMDD-XXXX
psql:supabase/tests/01_functional_tests.sql:45: NOTICE:  PASS: Thai username stored and trimmed
psql:supabase/tests/01_functional_tests.sql:46: NOTICE:  PASS: phone stored as text with leading zero
psql:supabase/tests/01_functional_tests.sql:47: NOTICE:  PASS: response does not leak idempotency key
psql:supabase/tests/01_functional_tests.sql:51: NOTICE:  PASS: second customer same slot -> SLOT_TAKEN
psql:supabase/tests/01_functional_tests.sql:53: NOTICE:  PASS: same idempotency key -> REPLAYED (no duplicate)
psql:supabase/tests/01_functional_tests.sql:54: NOTICE:  PASS: exactly one row for the slot
psql:supabase/tests/01_functional_tests.sql:56: NOTICE:  PASS: reused key for another slot -> IDEMPOTENCY_MISMATCH
psql:supabase/tests/01_functional_tests.sql:57: NOTICE:  PASS: past date -> PAST_SLOT
psql:supabase/tests/01_functional_tests.sql:58: NOTICE:  PASS: beyond max_advance_days -> OUT_OF_RANGE
psql:supabase/tests/01_functional_tests.sql:59: NOTICE:  PASS: 10:00 is not a slot -> INVALID_SLOT
psql:supabase/tests/01_functional_tests.sql:60: NOTICE:  PASS: 20:00 is not a slot -> INVALID_SLOT
psql:supabase/tests/01_functional_tests.sql:61: NOTICE:  PASS: bad phone -> INVALID_INPUT
psql:supabase/tests/01_functional_tests.sql:62: NOTICE:  PASS: other without detail -> INVALID_INPUT
psql:supabase/tests/01_functional_tests.sql:63: NOTICE:  PASS: unknown service type -> INVALID_INPUT
psql:supabase/tests/01_functional_tests.sql:64: NOTICE:  PASS: empty name -> INVALID_INPUT
psql:supabase/tests/01_functional_tests.sql:66: NOTICE:  PASS: LINE booking + landline + other detail -> CREATED
psql:supabase/tests/01_functional_tests.sql:67: NOTICE:  PASS: availability shows 2 booked
psql:supabase/tests/01_functional_tests.sql:68: NOTICE:  PASS: availability shows 7 available
psql:supabase/tests/01_functional_tests.sql:73: NOTICE:  PASS: 4th active booking same phone -> TOO_MANY_BOOKINGS
psql:supabase/tests/01_functional_tests.sql:79: NOTICE:  PASS: non-admin user sees 0 bookings (RLS)
psql:supabase/tests/01_functional_tests.sql:80: NOTICE:  PASS: non-admin: is_admin() = false
psql:supabase/tests/01_functional_tests.sql:82: NOTICE:  PASS: non-admin cannot set holiday (FORBIDDEN)
psql:supabase/tests/01_functional_tests.sql:84: NOTICE:  PASS: non-admin direct insert blocked by RLS
psql:supabase/tests/01_functional_tests.sql:86: NOTICE:  PASS: user cannot promote self to admin
psql:supabase/tests/01_functional_tests.sql:88: NOTICE:  PASS: authenticated cannot call create_booking (server-only)
psql:supabase/tests/01_functional_tests.sql:94: NOTICE:  PASS: admin2 is admin
psql:supabase/tests/01_functional_tests.sql:95: NOTICE:  PASS: admin2 sees all 4 bookings
psql:supabase/tests/01_functional_tests.sql:96: NOTICE:  PASS: admin sees admin list
psql:supabase/tests/01_functional_tests.sql:100: NOTICE:  PASS: admin cancel -> cancelled_at set
psql:supabase/tests/01_functional_tests.sql:101: NOTICE:  PASS: cancelled slot is available again
psql:supabase/tests/01_functional_tests.sql:106: NOTICE:  PASS: new customer can book the cancelled slot
psql:supabase/tests/01_functional_tests.sql:113: NOTICE:  PASS: reactivating cancelled booking into a taken slot -> SLOT_TAKEN
psql:supabase/tests/01_functional_tests.sql:115: NOTICE:  PASS: moving booking onto an occupied slot -> SLOT_TAKEN
psql:supabase/tests/01_functional_tests.sql:117: NOTICE:  PASS: moving booking to a free slot -> UPDATED
psql:supabase/tests/01_functional_tests.sql:118: NOTICE:  PASS: old slot freed after move
psql:supabase/tests/01_functional_tests.sql:120: NOTICE:  PASS: status -> completed
psql:supabase/tests/01_functional_tests.sql:123: NOTICE:  PASS: close slot with booking -> HAS_BOOKING warning (not closed)
psql:supabase/tests/01_functional_tests.sql:124: NOTICE:  PASS: nothing closed without confirmation
psql:supabase/tests/01_functional_tests.sql:125: NOTICE:  PASS: close free slot -> CLOSED
psql:supabase/tests/01_functional_tests.sql:126: NOTICE:  PASS: availability shows closed
psql:supabase/tests/01_functional_tests.sql:129: NOTICE:  PASS: customer cannot book closed slot
psql:supabase/tests/01_functional_tests.sql:134: NOTICE:  PASS: admin cannot move booking into closed slot
psql:supabase/tests/01_functional_tests.sql:135: NOTICE:  PASS: re-open slot -> OPENED
psql:supabase/tests/01_functional_tests.sql:136: NOTICE:  PASS: re-opened slot available
psql:supabase/tests/01_functional_tests.sql:137: NOTICE:  PASS: force close after warning -> CLOSED
psql:supabase/tests/01_functional_tests.sql:138: NOTICE:  PASS: forced close keeps the booking
psql:supabase/tests/01_functional_tests.sql:142: NOTICE:  PASS: set holiday -> SAVED
psql:supabase/tests/01_functional_tests.sql:143: NOTICE:  PASS: holiday reports 2 existing bookings to handle
psql:supabase/tests/01_functional_tests.sql:144: NOTICE:  PASS: holiday does NOT delete/cancel bookings
psql:supabase/tests/01_functional_tests.sql:145: NOTICE:  PASS: all 9 slots show holiday + note
psql:supabase/tests/01_functional_tests.sql:146: NOTICE:  PASS: edit holiday note
psql:supabase/tests/01_functional_tests.sql:147: NOTICE:  PASS: holiday note updated
psql:supabase/tests/01_functional_tests.sql:148: NOTICE:  PASS: cannot create holiday in the past
psql:supabase/tests/01_functional_tests.sql:151: NOTICE:  PASS: customer cannot book on holiday
psql:supabase/tests/01_functional_tests.sql:156: NOTICE:  PASS: cancel holiday via RLS delete
psql:supabase/tests/01_functional_tests.sql:158: NOTICE:  PASS: even admins cannot hard-delete bookings
psql:supabase/tests/01_functional_tests.sql:160: NOTICE:  PASS: admin can change settings
psql:supabase/tests/01_functional_tests.sql:165: NOTICE:  PASS: availability range limited to 62 days
psql:supabase/tests/01_functional_tests.sql:173: NOTICE:  PASS: unique index blocks a raw duplicate insert
ALL FUNCTIONAL TESTS PASSED

## 3. Unit tests (16 รายการ)

- 9 standard slots 11:00–20:00
- day status: available / partial / full / holiday / closed / unavailable
- groupAvailability trims times and sorts
- date helpers (timezone-independent)
- Bangkok "today" is correct regardless of server timezone
- Thai date formatting uses Buddhist year
- CSV export: BOM, quoting, formula-injection guard, Thai text
- Thai phone normalisation keeps leading zero and accepts common formats
- valid booking request is accepted and cleaned
- all 4 service types are accepted; other requires detail
- rejects missing consent, bad slot, bad date, bad key, honeypot
- all 9 standard slots are valid
- client never gets to supply LINE user id / display name
- text cleaning strips control chars and limits length
- form validation messages are in Thai
- admin update validation

## 4. Acceptance Criteria (Part 17)

สถานะ: ✅ ทดสอบแล้วอัตโนมัติ · 🟡 พัฒนาครบ ตรรกะหลักทดสอบแล้ว แต่ต้องทดสอบผ่านหน้าจอหลังตั้งค่า · ⏳ ต้องมี credentials จริง

| # | รายการ | สถานะ | หลักฐาน |
|---|---|---|---|
| 1 | เปิดเว็บไซต์ได้ | 🟡 | ต้อง `npm run build` + deploy |
| 2 | ปฏิทินแสดงถูกต้อง | 🟡 | unit: monthGrid, summarizeDay; SQL: get_availability |
| 3 | เลือกวันที่ได้ | 🟡 | UI |
| 4 | แสดง 9 รอบ | ✅ | SQL "availability returns 9 slots/day", unit "9 standard slots" |
| 5 | เลือกรอบว่างได้ | 🟡 | UI ปิดปุ่มรอบที่ไม่ว่าง |
| 6 | จองรอบเต็มไม่ได้ | ✅ | SQL SLOT_TAKEN, concurrency |
| 7 | จองวันหยุดไม่ได้ | ✅ | SQL "customer cannot book on holiday" |
| 8 | จองวันที่ผ่านมาไม่ได้ | ✅ | SQL PAST_SLOT |
| 9–10 | กรอกชื่อ / เบอร์ | ✅ | unit validation + SQL constraints |
| 11 | บริการ 4 ประเภท | ✅ | unit "all 4 service types" |
| 12 | อื่น ๆ + รายละเอียด | ✅ | unit + SQL "other without detail" |
| 13–14 | ยืนยันการจอง / ได้ Booking ID | ✅ | SQL CREATED + รูปแบบ SE-YYMMDD-XXXX, ไม่ซ้ำ (unique) |
| 15 | เปิดผ่าน LINE ดึงชื่อได้ | ⏳ | ต้องมี LIFF ID + Channel ID จริง |
| 16 | เบราว์เซอร์ปกติจองได้ | 🟡 | LIFF โหลดเฉพาะเมื่อเปิดจาก LINE; ไม่มี token ก็จองได้ |
| 17–19 | Login / หลายบัญชี / สิทธิ์เท่ากัน | ✅ (DB) | SQL admin1 + admin2 ทำได้เท่ากัน; ⏳ หน้า login ต้องมี Supabase จริง |
| 20–22 | Dashboard / ดู / ค้นหา Booking | 🟡 | RLS ให้ admin เห็นทั้งหมด (SQL) |
| 23 | แก้ไข Booking | ✅ | SQL move / SLOT_TAKEN / SLOT_CLOSED |
| 24 | ยกเลิก Booking → รอบว่าง | ✅ | SQL "cancelled slot is available again", "new customer can book the cancelled slot" |
| 25 | เปลี่ยนสถานะ | ✅ | SQL "status -> completed" |
| 26 | ตั้งวันหยุด | ✅ | SQL SAVED + conflicting_bookings, ไม่ลบ booking |
| 27–28 | ปิด / เปิดรอบ | ✅ | SQL CLOSED / HAS_BOOKING / OPENED |
| 29 | Export | ✅ (logic) | unit CSV; 🟡 ปุ่มดาวน์โหลด |
| 30 | ลูกค้าเข้า Admin ไม่ได้ | ✅ | SQL non-admin เห็น 0 แถว, เรียก admin function ไม่ได้ |
| 31 | ลูกค้าดูข้อมูลคนอื่นไม่ได้ | ✅ | SQL "anon cannot read bookings table" |
| 32–33 | กันจองซ้ำ / พร้อมกัน | ✅ | concurrency 50 คำขอ |
| 34 | กันข้อมูลปลอม | ✅ | SQL INVALID_INPUT ×4, raw insert ถูก unique index บล็อก, unit honeypot, LINE id มาจาก token เท่านั้น |
| 35 | ข้อมูลไม่หายเมื่อปิด Browser | ✅ | เก็บใน PostgreSQL; sessionStorage ใช้แค่จำสถานะหน้าจอ |
| 36 | ทำงานหลัง Deploy ใหม่ | 🟡 | ไม่มี state ในเซิร์ฟเวอร์ ข้อมูลอยู่ Supabase |

## 5. ต้องทดสอบหลังตั้งค่า (บน Production)

1. `npm install && npm run typecheck && npm run build` ผ่านโดยไม่มี error
2. เปิด `/` บน iPhone Safari, Android Chrome, iPad, Desktop → ปฏิทินโหลด, เลื่อนเดือนได้
3. จองครบขั้นตอน → ได้ Booking ID → เห็นรายการใน `/admin/bookings`
4. เปิดลิงก์ `https://liff.line.me/<LIFF_ID>` จาก LINE → ชื่อ LINE ขึ้นในช่อง Username → จอง → ใน admin เห็นคอลัมน์ LINE
5. เปิดสองเครื่อง เลือกรอบเดียวกัน กดยืนยันพร้อมกัน → เครื่องหนึ่งสำเร็จ อีกเครื่องเห็น "รอบนี้เพิ่งถูกจองไปแล้ว"
6. ปิดอินเทอร์เน็ตแล้วกดยืนยัน → เห็นข้อความ + ปุ่มลองอีกครั้ง → เปิดเน็ต กดลองอีกครั้ง → ได้ Booking เดิม ไม่ซ้ำ
7. Admin: ตั้งวันหยุดวันที่มีการจอง → เห็นคำเตือน; ปิดรอบที่มีการจอง → เห็นคำเตือน; ยกเลิก booking → ลูกค้าจองรอบนั้นได้
8. เปิด `/admin` ในหน้าต่างไม่ระบุตัวตน → ถูกพาไปหน้า login; login ด้วยบัญชีที่ไม่ใช่ admin → ถูกปฏิเสธ
9. Export CSV เปิดใน Excel → ภาษาไทยแสดงถูกต้อง
