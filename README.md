# Social Eyewear Booking — V1.0

ระบบจองคิวตรวจสายตาออนไลน์สำหรับร้าน **Social Eyewear**
Next.js 15 · React 19 · TypeScript · Tailwind CSS · Supabase (PostgreSQL + Auth + RLS) · LINE LIFF · Vercel

- ลูกค้า: `https://socialeyewearbooking.vercel.app/`
- ผู้ดูแล: `https://socialeyewearbooking.vercel.app/admin`

---

## สารบัญ
1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [โครงสร้างโปรเจกต์](#2-โครงสร้างโปรเจกต์)
3. [ติดตั้งและรันบนเครื่อง](#3-ติดตั้งและรันบนเครื่อง)
4. [ตั้งค่า Supabase](#4-ตั้งค่า-supabase)
5. [สร้างบัญชี Admin](#5-สร้างบัญชี-admin)
6. [ตั้งค่า LINE LIFF](#6-ตั้งค่า-line-liff)
7. [Deploy บน Vercel](#7-deploy-บน-vercel)
8. [Environment Variables](#8-environment-variables)
9. [การทดสอบ](#9-การทดสอบ)
10. [API](#10-api)
11. [รายการที่ต้องตั้งค่าด้วยตนเอง](#11-รายการที่ต้องตั้งค่าด้วยตนเอง)

---

## 1. ภาพรวมระบบ

| ส่วน | ความสามารถ |
|---|---|
| ลูกค้า | ปฏิทินรายเดือน (ว่าง / จองบางรอบ / เต็ม / วันหยุด), 9 รอบต่อวัน 11:00–20:00, ฟอร์มชื่อ-เบอร์-บริการ 4 ประเภท, สรุปก่อนยืนยัน + ยินยอม PDPA, หน้าสำเร็จพร้อม Booking ID |
| LINE | เปิดผ่าน LINE OA → ดึงชื่อ LINE อัตโนมัติ, Server ยืนยัน ID Token กับ LINE ก่อนบันทึก, เปิดผ่านเบราว์เซอร์ปกติก็จองได้ |
| Admin | Login หลายบัญชี (สิทธิ์เท่ากัน), Dashboard, จัดการรายการจอง (ค้นหา/กรอง/แก้ไข/ย้าย/ยกเลิก/เปลี่ยนสถานะ/จองแทนลูกค้า), ปฏิทิน, วันหยุด, เปิด-ปิดรอบ, รายงานรายวัน-รายเดือน, Export CSV, ตั้งค่า, เพิ่ม/ถอนสิทธิ์ผู้ดูแล |

### หลักการป้องกันการจองซ้ำ (สำคัญที่สุด)

```
ลูกค้า ──► POST /api/bookings ──► ตรวจข้อมูลฝั่ง Server ──► ตรวจ LINE ID Token
                                         │
                                         ▼
                         create_booking()  (PostgreSQL function, 1 transaction)
                           1. idempotency key ซ้ำ? → คืนรายการเดิม (กดซ้ำ/รีเฟรช/timeout ปลอดภัย)
                           2. pg_advisory_xact_lock(วัน+เวลา)  ← คิวเดียวกันเข้าทีละคำขอ
                           3. ตรวจ อดีต / วันหยุด / รอบปิด / มีคนจองแล้ว / จำกัดต่อเบอร์
                           4. INSERT
                                         │
                       UNIQUE INDEX (booking_date, start_time) WHERE status <> 'cancelled'
                       ← ด่านสุดท้าย: ฐานข้อมูลไม่ยอมให้มี 2 รายการ active ในรอบเดียว
```

- Booking ที่ **ยกเลิก** ไม่นับใน unique index → รอบกลับมาว่างทันที
- Admin ปิดรอบ / ตั้งวันหยุด / ย้ายนัด ใช้ lock เดียวกัน จึงไม่มี race กับลูกค้า
- ทดสอบจริงด้วย 50 คำขอพร้อมกันในรอบเดียว → สำเร็จ 1 รายการเสมอ (ดู [TEST_REPORT.md](docs/TEST_REPORT.md))

### ความปลอดภัย
- `anon` (เบราว์เซอร์) **ไม่มีสิทธิ์อ่านตารางใดเลย** อ่านได้เฉพาะ `get_availability()` ซึ่งคืนแค่สถานะรอบ ไม่มีชื่อ/เบอร์
- `create_booking()` เรียกได้เฉพาะ Server (service role) หลังตรวจข้อมูลและ LINE token แล้ว
- Admin: ตรวจ session (`auth.getUser()`) + `is_admin()` ใน Server ทุกหน้า/ทุก API และ RLS ตรวจซ้ำในฐานข้อมูล
- ไม่มีใครลบ booking ได้ (แม้แต่ admin) — ใช้สถานะ "ยกเลิก" เพื่อเก็บประวัติ
- Service Role Key อยู่เฉพาะไฟล์ที่ import `server-only` (build จะล้มทันทีถ้าถูกนำไปใช้ฝั่ง client)
- Security headers (HSTS, nosniff, X-Frame-Options สำหรับ /admin), same-origin check, rate limit, honeypot กันบอท, กัน CSV formula injection

---

## 2. โครงสร้างโปรเจกต์

```
social-eyewear-booking/
├── app/
│   ├── page.tsx                      # หน้าจองคิว (ลูกค้า)
│   ├── privacy/page.tsx              # Privacy Notice (PDPA)
│   ├── admin/
│   │   ├── login/page.tsx            # เข้าสู่ระบบผู้ดูแล
│   │   └── (panel)/                  # ทุกหน้าในนี้ต้องเป็น admin (ตรวจใน layout.tsx)
│   │       ├── page.tsx              # Dashboard
│   │       ├── bookings/  calendar/  holidays/  slots/  reports/  settings/
│   └── api/
│       ├── availability/route.ts     # GET สถานะรอบ (public, ไม่มีข้อมูลส่วนตัว)
│       ├── bookings/route.ts         # POST สร้างการจอง (public, ตรวจฝั่ง server)
│       └── admin/…                   # API ผู้ดูแลทั้งหมด (ต้อง login + is_admin)
├── components/{booking,calendar,admin,ui}/
├── lib/
│   ├── booking/      # ค่าคงที่ 9 รอบ, วันที่ (Asia/Bangkok), สถานะปฏิทิน, CSV
│   ├── validation/   # ตรวจข้อมูล (ใช้ทั้ง client และ server)
│   ├── supabase/     # client: server (session), service (server-only), browser
│   ├── line/         # useLiff (client), verifyLineIdToken (server)
│   └── auth/         # getAdmin / withAdmin
├── types/
├── supabase/
│   ├── migrations/20261112000001_init_schema.sql   # schema + RLS + functions (ไฟล์เดียวครบ)
│   └── tests/        # SQL functional tests + concurrency test (สำหรับ DB ทดสอบเท่านั้น)
├── scripts/create-admin.mjs
├── tests/            # unit tests (node:test)
├── docs/             # DATABASE.md, TEST_REPORT.md
├── middleware.ts     # refresh session + กันหน้า /admin
└── .env.example
```

---

## 3. ติดตั้งและรันบนเครื่อง

ต้องใช้ Node.js 20 ขึ้นไป

```bash
npm install
cp .env.example .env.local       # แล้วใส่ค่าจริง (ดูหัวข้อ 8)
npm run dev                      # http://localhost:3000
```

คำสั่งอื่น
```bash
npm test            # unit tests
npm run typecheck   # TypeScript
npm run lint
npm run build       # build production
```

---

## 4. ตั้งค่า Supabase

1. สร้างโปรเจกต์ที่ <https://supabase.com> — แนะนำ Region **Southeast Asia (Singapore)**
2. **รัน Migration** (เลือกวิธีใดวิธีหนึ่ง)
   - **SQL Editor:** เปิด `supabase/migrations/20261112000001_init_schema.sql` คัดลอกทั้งไฟล์ไปวางใน SQL Editor → Run
   - **Supabase CLI:** `supabase link --project-ref <ref>` แล้ว `supabase db push`
3. **ปิดการสมัครสมาชิกสาธารณะ:** Authentication → Sign In / Providers → **ปิด "Allow new users to sign up"**
   (แม้ไม่ปิด ผู้สมัครเองก็ไม่ใช่ admin และเข้าระบบไม่ได้ แต่ควรปิดเพื่อความสะอาด)
4. Authentication → URL Configuration → **Site URL** = `https://socialeyewearbooking.vercel.app`
5. Project Settings → API → คัดลอก `Project URL`, `anon public` key, `service_role` key ไปใส่ใน env
6. (ไม่บังคับ) ห้ามใช้ไฟล์ใน `supabase/tests/` กับฐานข้อมูลจริง — เป็นไฟล์ทดสอบที่สร้างข้อมูลจำลอง

> **เวลา:** วันที่/เวลานัดเก็บเป็นเวลาท้องถิ่นกรุงเทพฯ (`date` + `time`) ทุกฟังก์ชันแปลง `now()` เป็น Asia/Bangkok เองจึงไม่ขึ้นกับ timezone ของเซิร์ฟเวอร์ ส่วน `created_at/updated_at` เป็น `timestamptz`

---

## 5. สร้างบัญชี Admin

**บัญชีแรก** (เลือกวิธีใดวิธีหนึ่ง)

**วิธี A — สคริปต์ (แนะนำ)**
```bash
npm install
node --env-file=.env.local scripts/create-admin.mjs owner@example.com 'รหัสผ่านอย่างน้อย10ตัว'
```

**วิธี B — Supabase Dashboard**
1. Authentication → Users → **Add user** → Create new user → ใส่อีเมล/รหัสผ่าน → ติ๊ก **Auto Confirm User**
2. SQL Editor รัน:
   ```sql
   insert into public.admins (id, email)
   select id, email from auth.users where email = 'owner@example.com';
   ```

**บัญชีถัดไป:** เข้า `/admin/settings` → "เพิ่มผู้ดูแล" (ทำได้ทุกบัญชี เพราะสิทธิ์เท่ากัน) — ระบบสร้างบัญชีผ่าน server ด้วย service role
**ถอนสิทธิ์:** `/admin/settings` → "ถอนสิทธิ์" (ถอนตัวเองหรือบัญชีสุดท้ายไม่ได้)

---

## 6. ตั้งค่า LINE LIFF

1. <https://developers.line.biz/console/> → เลือก Provider ของร้าน → **Create a new channel → LINE Login**
   - App types: ติ๊ก **Web app**
   - แนะนำให้ Link กับ LINE Official Account ของร้าน (Basic settings → Linked OA)
2. แท็บ **LIFF → Add**
   - LIFF app name: `Social Eyewear Booking`
   - Size: **Full**
   - Endpoint URL: `https://socialeyewearbooking.vercel.app/`
   - Scopes: ติ๊ก **`openid`** และ **`profile`** (ต้องมี `openid` เพื่อให้ได้ ID Token สำหรับยืนยันฝั่ง server — ไม่ขอ `email` หรือสิทธิ์อื่น)
   - Add friend option: ตามต้องการ (เช่น On (Normal))
3. คัดลอก **LIFF ID** → `NEXT_PUBLIC_LIFF_ID`
4. แท็บ **Basic settings** → คัดลอก **Channel ID** → `LINE_CHANNEL_ID`
5. **Publish** channel (เปลี่ยนจาก Developing เป็น Published) ไม่เช่นนั้นจะใช้ได้เฉพาะผู้ทดสอบ
6. นำลิงก์ `https://liff.line.me/<LIFF_ID>` ไปใส่ใน Rich Menu / ข้อความตอบกลับของ LINE OA

**การทำงาน:** เมื่อเปิดใน LINE ระบบ init LIFF → (ถ้ายังไม่ login จะพาไป login) → ดึงชื่อ LINE มาใส่ช่อง Username → ตอนยืนยัน ส่ง **ID Token** ไป server → server เรียก `https://api.line.me/oauth2/v2.1/verify` ตรวจว่า token ออกให้ channel ของร้านจริง แล้วจึงบันทึก `line_user_id` และ `line_display_name` ที่ LINE ยืนยัน (ไม่เชื่อค่าที่เบราว์เซอร์ส่งมา)
ถ้า LIFF ล้มเหลวหรือไม่ได้ตั้งค่า → หน้าเว็บทำงานแบบเบราว์เซอร์ปกติ ให้กรอกชื่อเอง

---

## 7. Deploy บน Vercel

1. Push โค้ดขึ้น GitHub (repository ส่วนตัว)
2. <https://vercel.com/new> → Import repository → Framework: **Next.js** (ตรวจจับอัตโนมัติ)
3. **Project name: `socialeyewearbooking`** เพื่อให้ได้โดเมน `socialeyewearbooking.vercel.app`
   (ถ้าชื่อถูกใช้แล้ว เปลี่ยนได้ที่ Settings → Domains)
4. Settings → Environment Variables → ใส่ทุกค่าในหัวข้อ 8 (Production + Preview)
5. Deploy → เปิด `/` และ `/admin/login` ตรวจสอบ
6. Settings → Functions → Region: **Singapore (sin1)** ให้ใกล้ฐานข้อมูล (ไม่บังคับ แต่เร็วขึ้น)

ทุกครั้งที่ push ไป `main` Vercel จะ deploy ใหม่ ข้อมูลอยู่ใน Supabase จึงไม่หายเมื่อ deploy

---

## 8. Environment Variables

| ตัวแปร | ที่มา | ฝั่ง |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → `anon` `public` | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` | **server เท่านั้น — ห้ามใส่ NEXT_PUBLIC_** |
| `NEXT_PUBLIC_LIFF_ID` | LINE Login channel → LIFF | public |
| `LINE_CHANNEL_ID` | LINE Login channel → Basic settings | server |
| `NEXT_PUBLIC_SITE_URL` | `https://socialeyewearbooking.vercel.app` | public |

ถ้ายังไม่ได้ตั้งค่า Supabase หน้าเว็บจะแสดงข้อความ "ระบบยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล" — ไม่มีการแสดงข้อมูลปลอม

---

## 9. การทดสอบ

```bash
npm test     # unit tests: validation, เบอร์ไทย, สถานะปฏิทิน, วันที่ Asia/Bangkok, CSV
```

**ทดสอบฐานข้อมูล** (ใช้ PostgreSQL ทดสอบ เช่น `supabase start` หรือ Postgres 15+ เปล่า — ห้ามใช้ฐานข้อมูลจริง)
```bash
# Postgres เปล่า: สร้าง role/ฟังก์ชันจำลองของ Supabase ก่อน
psql "$PGURL" -f supabase/tests/00_supabase_stub.sql
psql "$PGURL" -f supabase/migrations/20261112000001_init_schema.sql
psql "$PGURL" -f supabase/tests/01_functional_tests.sql       # 67 checks
PGURL="$PGURL" N=50 ./supabase/tests/concurrency_test.sh       # 50 คำขอพร้อมกัน
```

ผลการทดสอบล่าสุด: [docs/TEST_REPORT.md](docs/TEST_REPORT.md)

---

## 10. API

| Method | Path | สิทธิ์ | คำอธิบาย |
|---|---|---|---|
| GET | `/api/availability?month=YYYY-MM` | public | สถานะ 9 รอบของทุกวันในเดือน + สรุปรายวัน (ไม่มีข้อมูลส่วนตัว) |
| POST | `/api/bookings` | public | สร้างการจอง `{date,startTime,username,phone,serviceType,serviceDetail,consent,idempotencyKey,lineIdToken?}` |
| GET/POST | `/api/admin/bookings` | admin | ค้นหา/กรอง/แบ่งหน้า · เพิ่มการจองแทนลูกค้า |
| GET/PATCH | `/api/admin/bookings/:id` | admin | ดู · แก้ไข/ย้าย/ยกเลิก/เปลี่ยนสถานะ (atomic) |
| GET | `/api/admin/day?date=` | admin | 9 รอบของวัน + ผู้จอง + รอบปิด + วันหยุด |
| GET/POST/DELETE | `/api/admin/holidays` | admin | รายการ · ตั้ง/แก้ไข · ยกเลิกวันหยุด |
| POST/DELETE | `/api/admin/slots` | admin | ปิดรอบ (เตือนถ้ามีการจอง) · เปิดรอบ |
| GET | `/api/admin/reports?from=&to=` | admin | สรุปตามสถานะ/บริการ/วัน |
| GET | `/api/admin/export?from=&to=` | admin | ดาวน์โหลด CSV (UTF-8 BOM เปิดใน Excel ได้) |
| GET/PATCH | `/api/admin/settings` | admin | การตั้งค่าระบบ |
| GET/POST/DELETE | `/api/admin/admins` | admin | บัญชีผู้ดูแล |

รหัสผลลัพธ์ของการจอง: `CREATED` 201 · `REPLAYED` 200 · `SLOT_TAKEN` / `SLOT_CLOSED` / `HOLIDAY` / `PAST_SLOT` 409 · `TOO_MANY_BOOKINGS` 429 · `INVALID_INPUT` 422 · `LINE_TOKEN_INVALID` 401

---

## 11. รายการที่ต้องตั้งค่าด้วยตนเอง

- [ ] สร้างโปรเจกต์ Supabase และรัน migration
- [ ] ปิด public sign-up ใน Supabase Auth
- [ ] สร้าง admin คนแรก (หัวข้อ 5)
- [ ] สร้าง LINE Login channel + LIFF (scope `openid`, `profile`) และ Publish
- [ ] สร้างโปรเจกต์ Vercel ชื่อ `socialeyewearbooking` และใส่ Environment Variables
- [ ] ใส่ลิงก์ LIFF ใน Rich Menu ของ LINE OA
- [ ] แก้ไขหัวข้อ 6 ใน `/privacy` ให้มีที่อยู่และช่องทางติดต่อร้านจริง
- [ ] (ถ้ามี) เปลี่ยน `public/logo.svg` เป็นโลโก้จริงของร้าน
- [ ] ตั้งค่า `/admin/settings`: เบอร์โทรร้าน, จองล่วงหน้ากี่วัน, ประกาศ
- [ ] ทดสอบ end-to-end บน Production ตาม checklist ใน TEST_REPORT.md หัวข้อ "ต้องทดสอบหลังตั้งค่า"
