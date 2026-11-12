-- Functional + security tests for the migration.
-- Run on a scratch DB after 00_supabase_stub.sql and the migration.
\set ON_ERROR_STOP 1
\set QUIET 1

create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', msg; end if;
  raise notice 'PASS: %', msg;
end $$;
grant execute on function pg_temp.ok(boolean, text) to public;

-- fixed test dates relative to Bangkok "today"
select (public.bkk_now()::date + 1) as d1, (public.bkk_now()::date + 2) as d2,
       (public.bkk_now()::date + 3) as d3, (public.bkk_now()::date - 1) as dpast,
       (public.bkk_now()::date + 90) as dfar \gset

-- users: one admin, one ordinary signed-in user
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'admin1@shop.test'),
                              ('22222222-2222-2222-2222-222222222222', 'admin2@shop.test'),
                              ('33333333-3333-3333-3333-333333333333', 'random@user.test');
insert into public.admins (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin1@shop.test'),
  ('22222222-2222-2222-2222-222222222222', 'admin2@shop.test');

-- ================= ANON (public website, anon key) ======================
set role anon;
select pg_temp.ok((select count(*) from public.get_availability(:'d1', :'d1')) = 9, 'anon: availability returns 9 slots/day');
select pg_temp.ok((select count(*) from public.get_availability(:'d1', :'d1') where status='available') = 9, 'anon: all 9 slots available by default');
do $$ begin perform * from public.bookings; raise exception 'FAIL: anon could read bookings';
exception when insufficient_privilege then raise notice 'PASS: anon cannot read bookings table'; end $$;
do $$ begin perform public.create_booking(current_date+5, '14:00', 'x', '0812345678', 'eye_exam', null, null, null, null);
  raise exception 'FAIL: anon could call create_booking';
exception when insufficient_privilege then raise notice 'PASS: anon cannot call create_booking directly'; end $$;
do $$ begin insert into public.holidays(holiday_date) values (current_date+5); raise exception 'FAIL';
exception when insufficient_privilege then raise notice 'PASS: anon cannot write holidays'; end $$;
reset role;

-- ================= SERVER (service_role) ================================
set role service_role;
select public.create_booking(:'d1', '14:00', ' สมชาย ใจดี ', '0812345678', 'eye_exam', null, null, null,
       'aaaaaaaa-0000-0000-0000-000000000001') as r \gset
select pg_temp.ok((:'r'::jsonb)->>'code' = 'CREATED', 'create booking -> CREATED');
select pg_temp.ok((:'r'::jsonb)#>>'{booking,booking_code}' ~ '^SE-[0-9]{6}-[A-Z2-9]{4}$', 'booking code format SE-YYMMDD-XXXX');
select pg_temp.ok((:'r'::jsonb)#>>'{booking,username}' = 'สมชาย ใจดี', 'Thai username stored and trimmed');
select pg_temp.ok((:'r'::jsonb)#>>'{booking,phone_number}' = '0812345678', 'phone stored as text with leading zero');
select pg_temp.ok(not ((:'r'::jsonb)->'booking' ? 'idempotency_key'), 'response does not leak idempotency key');
select (:'r'::jsonb)#>>'{booking,id}' as b1 \gset

select pg_temp.ok((public.create_booking(:'d1', '14:00', 'B', '0898765432', 'repair', null, null, null,
       'aaaaaaaa-0000-0000-0000-000000000002'))->>'code' = 'SLOT_TAKEN', 'second customer same slot -> SLOT_TAKEN');
select pg_temp.ok((public.create_booking(:'d1', '14:00', ' สมชาย ใจดี ', '0812345678', 'eye_exam', null, null, null,
       'aaaaaaaa-0000-0000-0000-000000000001'))->>'code' = 'REPLAYED', 'same idempotency key -> REPLAYED (no duplicate)');
select pg_temp.ok((select count(*) from public.bookings where booking_date = :'d1' and start_time='14:00') = 1, 'exactly one row for the slot');
select pg_temp.ok((public.create_booking(:'d1', '15:00', 'A', '0812345678', 'eye_exam', null, null, null,
       'aaaaaaaa-0000-0000-0000-000000000001'))->>'code' = 'IDEMPOTENCY_MISMATCH', 'reused key for another slot -> IDEMPOTENCY_MISMATCH');
select pg_temp.ok((public.create_booking(:'dpast', '14:00', 'A', '0812345678', 'eye_exam', null, null, null, null))->>'code' = 'PAST_SLOT', 'past date -> PAST_SLOT');
select pg_temp.ok((public.create_booking(:'dfar', '14:00', 'A', '0812345678', 'eye_exam', null, null, null, null))->>'code' = 'OUT_OF_RANGE', 'beyond max_advance_days -> OUT_OF_RANGE');
select pg_temp.ok((public.create_booking(:'d1', '10:00', 'A', '0812345678', 'eye_exam', null, null, null, null))->>'code' = 'INVALID_SLOT', '10:00 is not a slot -> INVALID_SLOT');
select pg_temp.ok((public.create_booking(:'d1', '20:00', 'A', '0812345678', 'eye_exam', null, null, null, null))->>'code' = 'INVALID_SLOT', '20:00 is not a slot -> INVALID_SLOT');
select pg_temp.ok((public.create_booking(:'d1', '11:00', 'A', '812345678', 'eye_exam', null, null, null, null))->>'code' = 'INVALID_INPUT', 'bad phone -> INVALID_INPUT');
select pg_temp.ok((public.create_booking(:'d1', '11:00', 'A', '0812345678', 'other', '  ', null, null, null))->>'code' = 'INVALID_INPUT', 'other without detail -> INVALID_INPUT');
select pg_temp.ok((public.create_booking(:'d1', '11:00', 'A', '0812345678', 'hack', null, null, null, null))->>'code' = 'INVALID_INPUT', 'unknown service type -> INVALID_INPUT');
select pg_temp.ok((public.create_booking(:'d1', '11:00', '', '0812345678', 'eye_exam', null, null, null, null))->>'code' = 'INVALID_INPUT', 'empty name -> INVALID_INPUT');
select pg_temp.ok((public.create_booking(:'d1', '11:00', 'L', '021234567', 'other', 'เปลี่ยนแป้นจมูก',
       'U0123456789abcdef0123456789abcdef', 'LINE ชื่อ', null))->>'code' = 'CREATED', 'LINE booking + landline + other detail -> CREATED');
select pg_temp.ok((select count(*) from public.get_availability(:'d1', :'d1') where status='booked') = 2, 'availability shows 2 booked');
select pg_temp.ok((select count(*) from public.get_availability(:'d1', :'d1') where status='available') = 7, 'availability shows 7 available');

-- per-phone spam limit (default 3 active future bookings; 0812345678 already has 1)
select public.create_booking(:'d2', '11:00', 'A', '0812345678', 'eye_exam', null, null, null, null) \gset dummy_
select public.create_booking(:'d2', '12:00', 'A', '0812345678', 'eye_exam', null, null, null, null) \gset dummy_
select pg_temp.ok((public.create_booking(:'d2', '13:00', 'A', '0812345678', 'eye_exam', null, null, null, null))->>'code' = 'TOO_MANY_BOOKINGS', '4th active booking same phone -> TOO_MANY_BOOKINGS');
reset role;

-- ================= SIGNED-IN BUT NOT ADMIN ==============================
set role authenticated;
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.ok((select count(*) from public.bookings) = 0, 'non-admin user sees 0 bookings (RLS)');
select pg_temp.ok(not public.is_admin(), 'non-admin: is_admin() = false');
do $$ begin perform public.admin_set_holiday(current_date + 10, 'x'); raise exception 'FAIL';
exception when insufficient_privilege then raise notice 'PASS: non-admin cannot set holiday (FORBIDDEN)'; end $$;
do $$ begin insert into public.holidays(holiday_date) values (current_date + 10); raise exception 'FAIL';
exception when insufficient_privilege then raise notice 'PASS: non-admin direct insert blocked by RLS'; end $$;
do $$ begin insert into public.admins(id, email) values ('33333333-3333-3333-3333-333333333333','random@user.test'); raise exception 'FAIL';
exception when insufficient_privilege then raise notice 'PASS: user cannot promote self to admin'; end $$;
do $$ begin perform public.create_booking(current_date+5, '14:00', 'x', '0812345678', 'eye_exam', null, null, null, null); raise exception 'FAIL';
exception when insufficient_privilege then raise notice 'PASS: authenticated cannot call create_booking (server-only)'; end $$;
reset role;

-- ================= ADMIN #2 (equal rights) ==============================
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.ok(public.is_admin(), 'admin2 is admin');
select pg_temp.ok((select count(*) from public.bookings) = 4, 'admin2 sees all 4 bookings');
select pg_temp.ok((select count(*) from public.admins) = 2, 'admin sees admin list');

-- cancel booking #1 -> slot returns to available
select public.admin_update_booking(:'b1', :'d1', '14:00', 'สมชาย ใจดี', '0812345678', 'eye_exam', null, 'cancelled', 'ลูกค้าโทรยกเลิก') as r \gset
select pg_temp.ok((:'r'::jsonb)->>'code' = 'UPDATED' and (:'r'::jsonb)#>>'{booking,cancelled_at}' is not null, 'admin cancel -> cancelled_at set');
select pg_temp.ok((select status from public.get_availability(:'d1', :'d1') where start_time='14:00') = 'available', 'cancelled slot is available again');
reset role;

set role service_role;
select public.create_booking(:'d1', '14:00', 'ลูกค้าใหม่', '0611111111', 'pickup', null, null, null, null) as r \gset
select pg_temp.ok((:'r'::jsonb)->>'code' = 'CREATED', 'new customer can book the cancelled slot');
select (:'r'::jsonb)#>>'{booking,id}' as b_new \gset
reset role;

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.ok((public.admin_update_booking(:'b1', :'d1', '14:00', 'สมชาย', '0812345678', 'eye_exam', null, 'confirmed', null))->>'code' = 'SLOT_TAKEN',
                  'reactivating cancelled booking into a taken slot -> SLOT_TAKEN');
select pg_temp.ok((public.admin_update_booking(:'b_new', :'d1', '11:00', 'ลูกค้าใหม่', '0611111111', 'pickup', null, 'confirmed', null))->>'code' = 'SLOT_TAKEN',
                  'moving booking onto an occupied slot -> SLOT_TAKEN');
select pg_temp.ok((public.admin_update_booking(:'b_new', :'d1', '16:00', 'ลูกค้าใหม่', '0611111111', 'pickup', null, 'confirmed', null))->>'code' = 'UPDATED',
                  'moving booking to a free slot -> UPDATED');
select pg_temp.ok((select status from public.get_availability(:'d1', :'d1') where start_time='14:00') = 'available', 'old slot freed after move');
select pg_temp.ok((public.admin_update_booking(:'b_new', :'d1', '16:00', 'ลูกค้าใหม่', '0611111111', 'pickup', null, 'completed', null))->>'code' = 'UPDATED',
                  'status -> completed');

-- slot close / open
select pg_temp.ok((public.admin_close_slot(:'d1', '16:00', 'ธุระ'))->>'code' = 'HAS_BOOKING', 'close slot with booking -> HAS_BOOKING warning (not closed)');
select pg_temp.ok((select count(*) from public.slot_overrides) = 0, 'nothing closed without confirmation');
select pg_temp.ok((public.admin_close_slot(:'d1', '17:00', 'มีธุระส่วนตัว'))->>'code' = 'CLOSED', 'close free slot -> CLOSED');
select pg_temp.ok((select status from public.get_availability(:'d1', :'d1') where start_time='17:00') = 'closed', 'availability shows closed');
reset role;
set role service_role;
select pg_temp.ok((public.create_booking(:'d1', '17:00', 'X', '0622222222', 'eye_exam', null, null, null, null))->>'code' = 'SLOT_CLOSED', 'customer cannot book closed slot');
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.ok((public.admin_update_booking(:'b_new', :'d1', '17:00', 'ลูกค้าใหม่', '0611111111', 'pickup', null, 'confirmed', null))->>'code' = 'SLOT_CLOSED',
                  'admin cannot move booking into closed slot');
select pg_temp.ok((public.admin_open_slot(:'d1', '17:00'))->>'code' = 'OPENED', 're-open slot -> OPENED');
select pg_temp.ok((select status from public.get_availability(:'d1', :'d1') where start_time='17:00') = 'available', 're-opened slot available');
select pg_temp.ok((public.admin_close_slot(:'d1', '16:00', 'ธุระ', true))->>'code' = 'CLOSED', 'force close after warning -> CLOSED');
select pg_temp.ok((select count(*) from public.bookings where id = :'b_new') = 1, 'forced close keeps the booking');

-- holidays
select public.admin_set_holiday(:'d2', 'หยุดประจำเดือน') as r \gset
select pg_temp.ok((:'r'::jsonb)->>'code' = 'SAVED', 'set holiday -> SAVED');
select pg_temp.ok(jsonb_array_length((:'r'::jsonb)->'conflicting_bookings') = 2, 'holiday reports 2 existing bookings to handle');
select pg_temp.ok((select count(*) from public.bookings where booking_date = :'d2' and booking_status='confirmed') = 2, 'holiday does NOT delete/cancel bookings');
select pg_temp.ok((select count(*) from public.get_availability(:'d2', :'d2') where status='holiday' and holiday_note='หยุดประจำเดือน') = 9, 'all 9 slots show holiday + note');
select pg_temp.ok((public.admin_set_holiday(:'d2', 'แก้หมายเหตุ'))->>'code' = 'SAVED', 'edit holiday note');
select pg_temp.ok((select note from public.holidays where holiday_date = :'d2') = 'แก้หมายเหตุ', 'holiday note updated');
select pg_temp.ok((public.admin_set_holiday(:'dpast', 'x'))->>'code' = 'PAST_DATE', 'cannot create holiday in the past');
reset role;
set role service_role;
select pg_temp.ok((public.create_booking(:'d2', '18:00', 'X', '0633333333', 'eye_exam', null, null, null, null))->>'code' = 'HOLIDAY', 'customer cannot book on holiday');
reset role;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
delete from public.holidays where holiday_date = :'d2';
select pg_temp.ok((select count(*) from public.get_availability(:'d2', :'d2') where status='holiday') = 0, 'cancel holiday via RLS delete');
do $$ begin delete from public.bookings; raise exception 'FAIL';
exception when insufficient_privilege then raise notice 'PASS: even admins cannot hard-delete bookings'; end $$;
update public.booking_settings set setting_value = '5'::jsonb where setting_key = 'max_active_bookings_per_phone';
select pg_temp.ok(public.setting_int('max_active_bookings_per_phone', 3) = 5, 'admin can change settings');
reset role;

-- range guard
do $$ begin perform * from public.get_availability(current_date, current_date + 100); raise exception 'FAIL';
exception when invalid_parameter_value then raise notice 'PASS: availability range limited to 62 days'; end $$;

-- DB-level guard even if someone bypasses the function (service_role raw insert)
do $$ begin
  insert into public.bookings (booking_code, booking_date, start_time, end_time, username, phone_number, service_type)
  select 'SE-RAW-0001', booking_date, start_time, end_time, 'raw', '0899999999', 'eye_exam'
  from public.bookings where booking_status = 'confirmed' limit 1;
  raise exception 'FAIL: raw duplicate insert succeeded';
exception when unique_violation then raise notice 'PASS: unique index blocks a raw duplicate insert'; end $$;

\echo ALL FUNCTIONAL TESTS PASSED
