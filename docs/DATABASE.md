# Database Schema & Security — Social Eyewear Booking

ไฟล์ต้นฉบับ: `supabase/migrations/20261112000001_init_schema.sql` (ไฟล์เดียว รันครั้งเดียว)

## ตาราง

### `admins`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | uuid PK | FK → `auth.users.id` (on delete cascade) |
| email | text unique | |
| created_at | timestamptz | |

### `bookings`
| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| booking_code | text unique | `SE-YYMMDD-XXXX` (แสดงให้ลูกค้าเป็น Booking ID) |
| booking_date | date | วันที่ตามเวลากรุงเทพฯ |
| start_time / end_time | time | ต้องเป็น 11:00–19:00 ต้นชั่วโมง, end = start + 1 ชม. |
| username | text | 1–100 ตัวอักษร |
| phone_number | text | `^0[0-9]{8,9}$` เก็บเป็นข้อความ รักษาเลข 0 นำหน้า |
| service_type | text | `eye_exam` · `repair` · `pickup` · `other` |
| service_detail | text | บังคับเมื่อ `other`, ≤ 500 |
| line_user_id | text | `^U[0-9a-f]{32}$` มาจาก ID token ที่ LINE ยืนยันแล้วเท่านั้น |
| line_display_name | text | |
| booking_status | text | `confirmed` · `completed` · `cancelled` |
| idempotency_key | uuid unique | กันคำขอซ้ำ |
| admin_note | text | หมายเหตุภายใน (ลูกค้าไม่เห็น) |
| cancelled_at | timestamptz | |
| created_at / updated_at | timestamptz | updated_at ปรับอัตโนมัติด้วย trigger |

**ดัชนีกันจองซ้ำ:** `bookings_active_slot_uniq UNIQUE (booking_date, start_time) WHERE booking_status <> 'cancelled'`
ดัชนีค้นหา: วันที่+เวลา, เบอร์โทร, สถานะ, created_at, line_user_id, lower(username)

### `holidays`
`id`, `holiday_date` (unique), `note`, `created_by` → admins, `created_at`, `updated_at`

### `slot_overrides`
`id`, `slot_date`, `start_time`, `end_time`, `status` (`closed`), `note`, `created_by`, timestamps · unique (`slot_date`, `start_time`)
การ "เปิดรอบกลับ" = ลบแถว override

### `booking_settings`
`setting_key` (unique), `setting_value` (jsonb), `description`, `is_public`
ค่าเริ่มต้น: `max_advance_days`=60, `min_lead_minutes`=30, `max_active_bookings_per_phone`=3, `announcement`="", `shop_phone`=""

> รอบตรวจ 9 รอบ **ไม่ได้สร้างล่วงหน้าในฐานข้อมูล** — สร้างจาก `standard_slot_starts()` แล้วตรวจกับ bookings / holidays / slot_overrides จริงทุกครั้ง

## ฟังก์ชัน

| ฟังก์ชัน | เรียกได้โดย | หน้าที่ |
|---|---|---|
| `get_availability(from, to)` | anon, authenticated | สถานะรายรอบ: available/booked/closed/holiday/past/out_of_range — ไม่มีข้อมูลส่วนตัว (จำกัด 62 วัน) |
| `get_public_settings()` | anon | ค่าตั้งที่ `is_public` |
| `create_booking(...)` | **service_role เท่านั้น** | จองแบบ atomic: idempotency → advisory lock → ตรวจกฎ → insert (+ จับ unique violation) |
| `admin_update_booking(...)` | authenticated + `is_admin()` | แก้ไข/ย้าย/ยกเลิก/เปลี่ยนสถานะ ตรวจรอบใหม่ใต้ lock |
| `admin_set_holiday(date, note)` | authenticated + `is_admin()` | ล็อกทั้ง 9 รอบ, upsert วันหยุด, คืนรายการจองที่ต้องจัดการ (ไม่ลบ) |
| `admin_close_slot(date, start, note, force)` | authenticated + `is_admin()` | ถ้ามีการจอง → `HAS_BOOKING` (ไม่ปิด) เว้นแต่ `force` |
| `admin_open_slot(date, start)` | authenticated + `is_admin()` | เปิดรอบ |
| `is_admin()` | authenticated | ใช้ใน RLS |

## RLS / สิทธิ์

| ตาราง | anon | authenticated (ไม่ใช่ admin) | admin |
|---|---|---|---|
| admins | ✗ | ✗ | อ่าน (เพิ่ม/ลบผ่าน server ด้วย service role) |
| bookings | ✗ | ✗ (0 แถว) | อ่าน, แก้ไข · **ไม่มีใคร insert ตรง / ลบ ได้** |
| holidays | ✗ | ✗ | อ่าน/เขียน/ลบ |
| slot_overrides | ✗ | ✗ | อ่าน/เขียน/ลบ |
| booking_settings | ✗ | ✗ | อ่าน/แก้ไข |

`service_role` (ใช้เฉพาะใน server) ข้าม RLS ตามปกติของ Supabase

## Lock model

ทุกการเขียนที่กระทบรอบใดรอบหนึ่งใช้ `pg_advisory_xact_lock(slot_lock_key(date, time))` — lock ปลดอัตโนมัติเมื่อจบ transaction
`admin_set_holiday` ล็อกทั้ง 9 รอบเรียงตามเวลา ส่วนฟังก์ชันอื่นล็อกรอบเดียว จึงไม่เกิด deadlock
