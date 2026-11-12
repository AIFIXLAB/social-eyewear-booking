-- =====================================================================
-- Social Eyewear Booking — V1.0
-- Migration 0001: schema, constraints, indexes, RLS, atomic functions
--
-- Time model:
--   booking_date (date) + start_time (time) are LOCAL wall-clock values
--   in Asia/Bangkok. Every function that compares with "now" converts
--   now() explicitly to Asia/Bangkok, so the result never depends on the
--   database server timezone. created_at/updated_at are timestamptz.
-- =====================================================================

-- Only core PostgreSQL functions are used (gen_random_uuid, hashtextextended),
-- so nothing depends on which schema Supabase installs extensions into.

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Local "now" in Bangkok (timestamp without time zone)
create or replace function public.bkk_now()
returns timestamp
language sql
stable
as $$ select (now() at time zone 'Asia/Bangkok') $$;

-- The 9 standard slots (11:00 .. 19:00 start). Slots are generated from
-- this constant; they are NOT pre-created per day in the database.
create or replace function public.standard_slot_starts()
returns setof time
language sql
immutable
as $$
  select (time '11:00' + make_interval(hours => g))::time
  from generate_series(0, 8) as g
$$;

create or replace function public.is_standard_slot(p_start time)
returns boolean
language sql
immutable
as $$
  select p_start is not null
     and extract(minute from p_start) = 0
     and extract(second from p_start) = 0
     and extract(hour from p_start) between 11 and 19
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- 12.1 admins — linked 1:1 with Supabase Auth users
create table public.admins (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  created_at  timestamptz not null default now()
);

-- 12.2 bookings
create table public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  booking_code       text not null unique,
  booking_date       date not null,
  start_time         time not null,
  end_time           time not null,
  username           text not null,
  phone_number       text not null,
  service_type       text not null,
  service_detail     text,
  line_user_id       text,
  line_display_name  text,
  booking_status     text not null default 'confirmed',
  idempotency_key    uuid unique,
  admin_note         text,
  cancelled_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint bookings_slot_valid
    check (public.is_standard_slot(start_time)),
  constraint bookings_end_after_start
    check (end_time = (start_time + interval '1 hour')::time),
  constraint bookings_username_len
    check (char_length(btrim(username)) between 1 and 100),
  -- Thai phone: stored as text to keep the leading zero. 0 + 8–9 digits
  constraint bookings_phone_format
    check (phone_number ~ '^0[0-9]{8,9}$'),
  constraint bookings_service_type_valid
    check (service_type in ('eye_exam', 'repair', 'pickup', 'other')),
  constraint bookings_other_needs_detail
    check (service_type <> 'other' or char_length(btrim(coalesce(service_detail, ''))) > 0),
  constraint bookings_detail_len
    check (service_detail is null or char_length(service_detail) <= 500),
  constraint bookings_status_valid
    check (booking_status in ('confirmed', 'completed', 'cancelled')),
  constraint bookings_line_user_id_format
    check (line_user_id is null or line_user_id ~ '^U[0-9a-f]{32}$'),
  constraint bookings_line_name_len
    check (line_display_name is null or char_length(line_display_name) <= 200),
  constraint bookings_admin_note_len
    check (admin_note is null or char_length(admin_note) <= 1000)
);

-- THE double-booking guard: one active (non-cancelled) booking per slot.
-- Cancelled bookings are excluded, so a cancelled slot can be re-booked.
create unique index bookings_active_slot_uniq
  on public.bookings (booking_date, start_time)
  where booking_status <> 'cancelled';

create index bookings_date_idx        on public.bookings (booking_date, start_time);
create index bookings_phone_idx       on public.bookings (phone_number);
create index bookings_status_idx      on public.bookings (booking_status);
create index bookings_created_at_idx  on public.bookings (created_at desc);
create index bookings_line_user_idx   on public.bookings (line_user_id) where line_user_id is not null;
create index bookings_username_idx    on public.bookings (lower(username));

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- 12.3 holidays
create table public.holidays (
  id            uuid primary key default gen_random_uuid(),
  holiday_date  date not null unique,
  note          text,
  created_by    uuid references public.admins (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint holidays_note_len check (note is null or char_length(note) <= 300)
);

create trigger holidays_set_updated_at
  before update on public.holidays
  for each row execute function public.set_updated_at();

-- 12.4 slot_overrides (per-slot closures)
create table public.slot_overrides (
  id          uuid primary key default gen_random_uuid(),
  slot_date   date not null,
  start_time  time not null,
  end_time    time not null,
  status      text not null default 'closed',
  note        text,
  created_by  uuid references public.admins (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint slot_overrides_unique unique (slot_date, start_time),
  constraint slot_overrides_slot_valid check (public.is_standard_slot(start_time)),
  constraint slot_overrides_end_after_start check (end_time = (start_time + interval '1 hour')::time),
  -- 'closed' only in V1; kept as text for future statuses
  constraint slot_overrides_status_valid check (status in ('closed')),
  constraint slot_overrides_note_len check (note is null or char_length(note) <= 300)
);

create trigger slot_overrides_set_updated_at
  before update on public.slot_overrides
  for each row execute function public.set_updated_at();

-- 12.5 booking_settings
create table public.booking_settings (
  id             uuid primary key default gen_random_uuid(),
  setting_key    text not null unique,
  setting_value  jsonb not null,
  description    text,
  is_public      boolean not null default false,
  updated_at     timestamptz not null default now()
);

create trigger booking_settings_set_updated_at
  before update on public.booking_settings
  for each row execute function public.set_updated_at();

insert into public.booking_settings (setting_key, setting_value, description, is_public) values
  ('max_advance_days',              '60'::jsonb, 'จองล่วงหน้าได้สูงสุดกี่วัน', true),
  ('min_lead_minutes',              '30'::jsonb, 'ต้องจองก่อนเวลาเริ่มรอบอย่างน้อยกี่นาที', true),
  ('max_active_bookings_per_phone', '3'::jsonb,  'จำนวนนัดที่ยังไม่ถึงกำหนดสูงสุดต่อเบอร์โทร (กันสแปม)', false),
  ('announcement',                  '""'::jsonb, 'ข้อความประกาศบนหน้าจอง (เว้นว่างได้)', true),
  ('shop_phone',                    '""'::jsonb, 'เบอร์โทรร้านสำหรับติดต่อ', true)
on conflict (setting_key) do nothing;

create or replace function public.setting_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when jsonb_typeof(setting_value) = 'number'
                 then (setting_value #>> '{}')::int end
       from public.booking_settings where setting_key = p_key),
    p_default)
$$;

-- ---------------------------------------------------------------------
-- Admin check
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid())
$$;

-- Advisory lock key for one slot. Every writer that touches a slot
-- (customer booking, admin move, slot close, holiday) takes this lock,
-- so availability checks and the insert happen atomically.
create or replace function public.slot_lock_key(p_date date, p_start time)
returns bigint
language sql
immutable
as $$ select hashtextextended('se-slot:' || p_date::text || ' ' || p_start::text, 0) $$;

-- Booking code: SE-YYMMDD-XXXX (no 0/O/1/I to avoid confusion)
create or replace function public.generate_booking_code(p_date date)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  rnd   bytea := uuid_send(gen_random_uuid());  -- bytes 0-3 of a v4 UUID are fully random
  suffix text := '';
  i int;
begin
  for i in 0..3 loop
    suffix := suffix || substr(alphabet, 1 + (get_byte(rnd, i) % 32), 1);
  end loop;
  return 'SE-' || to_char(p_date, 'YYMMDD') || '-' || suffix;
end;
$$;

-- ---------------------------------------------------------------------
-- Public read: availability (NO personal data)
-- ---------------------------------------------------------------------
create or replace function public.get_availability(p_from date, p_to date)
returns table (
  slot_date     date,
  start_time    time,
  end_time      time,
  status        text,   -- available | booked | closed | holiday | past | out_of_range
  holiday_note  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_now      timestamp := public.bkk_now();
  v_today    date := v_now::date;
  v_lead     int  := public.setting_int('min_lead_minutes', 30);
  v_max_day  date := v_today + public.setting_int('max_advance_days', 60);
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'INVALID_RANGE' using errcode = '22023';
  end if;
  if p_to - p_from > 62 then
    raise exception 'RANGE_TOO_LARGE' using errcode = '22023';
  end if;

  return query
  select d::date,
         s.t,
         (s.t + interval '1 hour')::time,
         case
           when h.holiday_date is not null then 'holiday'
           when b.id is not null           then 'booked'
           when o.id is not null           then 'closed'
           when (d::date + s.t) <= v_now + make_interval(mins => v_lead) then 'past'
           when d::date > v_max_day        then 'out_of_range'
           else 'available'
         end,
         h.note
  from generate_series(p_from, p_to, interval '1 day') as d
  cross join public.standard_slot_starts() as s(t)
  left join public.holidays h on h.holiday_date = d::date
  left join public.slot_overrides o on o.slot_date = d::date and o.start_time = s.t and o.status = 'closed'
  left join public.bookings b on b.booking_date = d::date and b.start_time = s.t and b.booking_status <> 'cancelled'
  order by 1, 2;
end;
$$;

create or replace function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(setting_key, setting_value), '{}'::jsonb)
  from public.booking_settings where is_public
$$;

-- ---------------------------------------------------------------------
-- Customer: create booking (atomic). Called ONLY by the server
-- (service_role) after it has validated input and verified LINE ID token.
-- Returns jsonb: { ok, code, booking? }
-- ---------------------------------------------------------------------
create or replace function public.create_booking(
  p_booking_date      date,
  p_start_time        time,
  p_username          text,
  p_phone_number      text,
  p_service_type      text,
  p_service_detail    text,
  p_line_user_id      text,
  p_line_display_name text,
  p_idempotency_key   uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_now        timestamp := public.bkk_now();
  v_existing   public.bookings;
  v_new        public.bookings;
  v_constraint text;
  v_attempt    int := 0;
  v_active     int;
begin
  -- 1) Input sanity (server validates too; DB is the last line of defence)
  if p_booking_date is null or not public.is_standard_slot(p_start_time) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_SLOT');
  end if;

  -- 2) Idempotent replay (double click / retry after timeout / refresh)
  if p_idempotency_key is not null then
    select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
    if found then
      if v_existing.booking_date = p_booking_date and v_existing.start_time = p_start_time then
        return jsonb_build_object('ok', true, 'code', 'REPLAYED', 'booking', to_jsonb(v_existing) - 'idempotency_key' - 'admin_note');
      end if;
      return jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_MISMATCH');
    end if;
  end if;

  -- 3) Serialize everything that touches this slot
  perform pg_advisory_xact_lock(public.slot_lock_key(p_booking_date, p_start_time));

  -- re-check replay after waiting on the lock (concurrent duplicate request)
  if p_idempotency_key is not null then
    select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('ok', true, 'code', 'REPLAYED', 'booking', to_jsonb(v_existing) - 'idempotency_key' - 'admin_note');
    end if;
  end if;

  -- 4) Business rules, evaluated against real data under the lock
  if (p_booking_date + p_start_time) <= v_now + make_interval(mins => public.setting_int('min_lead_minutes', 30)) then
    return jsonb_build_object('ok', false, 'code', 'PAST_SLOT');
  end if;
  if p_booking_date > v_now::date + public.setting_int('max_advance_days', 60) then
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_RANGE');
  end if;
  if exists (select 1 from public.holidays where holiday_date = p_booking_date) then
    return jsonb_build_object('ok', false, 'code', 'HOLIDAY');
  end if;
  if exists (select 1 from public.slot_overrides
             where slot_date = p_booking_date and start_time = p_start_time and status = 'closed') then
    return jsonb_build_object('ok', false, 'code', 'SLOT_CLOSED');
  end if;
  if exists (select 1 from public.bookings
             where booking_date = p_booking_date and start_time = p_start_time
               and booking_status <> 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
  end if;

  select count(*) into v_active
  from public.bookings
  where phone_number = p_phone_number
    and booking_status = 'confirmed'
    and booking_date >= v_now::date;
  if v_active >= public.setting_int('max_active_bookings_per_phone', 3) then
    return jsonb_build_object('ok', false, 'code', 'TOO_MANY_BOOKINGS');
  end if;

  -- 5) Insert. The partial unique index is the final, absolute guard.
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.bookings (
        booking_code, booking_date, start_time, end_time,
        username, phone_number, service_type, service_detail,
        line_user_id, line_display_name, booking_status, idempotency_key
      ) values (
        public.generate_booking_code(p_booking_date), p_booking_date, p_start_time,
        (p_start_time + interval '1 hour')::time,
        btrim(p_username), p_phone_number, p_service_type, nullif(btrim(coalesce(p_service_detail, '')), ''),
        p_line_user_id, p_line_display_name, 'confirmed', p_idempotency_key
      )
      returning * into v_new;

      return jsonb_build_object('ok', true, 'code', 'CREATED', 'booking', to_jsonb(v_new) - 'idempotency_key' - 'admin_note');
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'bookings_active_slot_uniq' then
          return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
        elsif v_constraint = 'bookings_idempotency_key_key' then
          select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
          return jsonb_build_object('ok', true, 'code', 'REPLAYED', 'booking', to_jsonb(v_existing) - 'idempotency_key' - 'admin_note');
        elsif v_constraint = 'bookings_booking_code_key' and v_attempt < 5 then
          continue;  -- extremely rare code collision: retry with a new code
        else
          raise;
        end if;
      when check_violation then
        return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: update / move / cancel a booking (atomic, re-checks new slot)
-- ---------------------------------------------------------------------
create or replace function public.admin_update_booking(
  p_id             uuid,
  p_booking_date   date,
  p_start_time     time,
  p_username       text,
  p_phone_number   text,
  p_service_type   text,
  p_service_detail text,
  p_status         text,
  p_admin_note     text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_old        public.bookings;
  v_new        public.bookings;
  v_moved      boolean;
  v_reactivate boolean;
  v_constraint text;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not public.is_standard_slot(p_start_time) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_SLOT');
  end if;

  select * into v_old from public.bookings where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_moved      := (v_old.booking_date, v_old.start_time) is distinct from (p_booking_date, p_start_time);
  v_reactivate := v_old.booking_status = 'cancelled' and p_status <> 'cancelled';

  -- Any time the booking will occupy a (new) slot, verify that slot first
  if p_status <> 'cancelled' and (v_moved or v_reactivate) then
    perform pg_advisory_xact_lock(public.slot_lock_key(p_booking_date, p_start_time));

    if v_moved and (p_booking_date + p_start_time) <= public.bkk_now() then
      return jsonb_build_object('ok', false, 'code', 'PAST_SLOT');
    end if;
    if exists (select 1 from public.holidays where holiday_date = p_booking_date) then
      return jsonb_build_object('ok', false, 'code', 'HOLIDAY');
    end if;
    if exists (select 1 from public.slot_overrides
               where slot_date = p_booking_date and start_time = p_start_time and status = 'closed') then
      return jsonb_build_object('ok', false, 'code', 'SLOT_CLOSED');
    end if;
    if exists (select 1 from public.bookings
               where booking_date = p_booking_date and start_time = p_start_time
                 and booking_status <> 'cancelled' and id <> p_id) then
      return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
    end if;
  end if;

  begin
    update public.bookings set
      booking_date   = p_booking_date,
      start_time     = p_start_time,
      end_time       = (p_start_time + interval '1 hour')::time,
      username       = btrim(p_username),
      phone_number   = p_phone_number,
      service_type   = p_service_type,
      service_detail = nullif(btrim(coalesce(p_service_detail, '')), ''),
      booking_status = p_status,
      admin_note     = nullif(btrim(coalesce(p_admin_note, '')), ''),
      cancelled_at   = case
                         when p_status = 'cancelled' and v_old.booking_status <> 'cancelled' then now()
                         when p_status <> 'cancelled' then null
                         else v_old.cancelled_at
                       end
    where id = p_id
    returning * into v_new;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'bookings_active_slot_uniq' then
        return jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN');
      end if;
      raise;
    when check_violation then
      return jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  end;

  return jsonb_build_object('ok', true, 'code', 'UPDATED', 'booking', to_jsonb(v_new) - 'idempotency_key');
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: set / edit a holiday. Never deletes bookings; returns the
-- active bookings on that day so the admin can handle them manually.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_holiday(p_date date, p_note text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_t        time;
  v_holiday  public.holidays;
  v_conflict jsonb;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_date is null then
    return jsonb_build_object('ok', false, 'code', 'INVALID_DATE');
  end if;
  if p_date < public.bkk_now()::date
     and not exists (select 1 from public.holidays where holiday_date = p_date) then
    return jsonb_build_object('ok', false, 'code', 'PAST_DATE');
  end if;

  -- lock all 9 slots in a fixed order (prevents racing customer bookings)
  for v_t in select * from public.standard_slot_starts() order by 1 loop
    perform pg_advisory_xact_lock(public.slot_lock_key(p_date, v_t));
  end loop;

  insert into public.holidays (holiday_date, note, created_by)
  values (p_date, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (holiday_date) do update set note = excluded.note
  returning * into v_holiday;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'booking_code', booking_code, 'start_time', start_time,
           'username', username, 'phone_number', phone_number) order by start_time), '[]'::jsonb)
    into v_conflict
  from public.bookings
  where booking_date = p_date and booking_status = 'confirmed';

  return jsonb_build_object('ok', true, 'code', 'SAVED', 'holiday', to_jsonb(v_holiday),
                            'conflicting_bookings', v_conflict);
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: close a slot. Refuses if an active booking exists unless
-- p_force = true (UI shows a warning and asks first).
-- ---------------------------------------------------------------------
create or replace function public.admin_close_slot(
  p_date  date,
  p_start time,
  p_note  text,
  p_force boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_booking  public.bookings;
  v_override public.slot_overrides;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_date is null or not public.is_standard_slot(p_start) then
    return jsonb_build_object('ok', false, 'code', 'INVALID_SLOT');
  end if;

  perform pg_advisory_xact_lock(public.slot_lock_key(p_date, p_start));

  select * into v_booking from public.bookings
  where booking_date = p_date and start_time = p_start and booking_status <> 'cancelled';

  if found and not coalesce(p_force, false) then
    return jsonb_build_object('ok', false, 'code', 'HAS_BOOKING',
      'booking', jsonb_build_object('id', v_booking.id, 'booking_code', v_booking.booking_code,
                                    'username', v_booking.username, 'phone_number', v_booking.phone_number,
                                    'booking_status', v_booking.booking_status));
  end if;

  insert into public.slot_overrides (slot_date, start_time, end_time, status, note, created_by)
  values (p_date, p_start, (p_start + interval '1 hour')::time, 'closed',
          nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (slot_date, start_time) do update set note = excluded.note, status = 'closed'
  returning * into v_override;

  return jsonb_build_object('ok', true, 'code', 'CLOSED', 'override', to_jsonb(v_override),
                            'had_booking', v_booking.id is not null);
end;
$$;

create or replace function public.admin_open_slot(p_date date, p_start time)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(public.slot_lock_key(p_date, p_start));
  delete from public.slot_overrides where slot_date = p_date and start_time = p_start;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok', true, 'code', case when v_deleted > 0 then 'OPENED' else 'NOT_CLOSED' end,
                            'is_holiday', exists (select 1 from public.holidays where holiday_date = p_date));
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.admins           enable row level security;
alter table public.bookings         enable row level security;
alter table public.holidays         enable row level security;
alter table public.slot_overrides   enable row level security;
alter table public.booking_settings enable row level security;

-- Anonymous users get NO direct table access at all (belt and braces on top of RLS)
revoke all on public.admins, public.bookings, public.holidays,
              public.slot_overrides, public.booking_settings from anon;

-- admins: an admin can see the admin list. Adding admins is done with the
-- service role (scripts/create-admin.mjs or SQL editor), never from the app.
revoke insert, update, delete on public.admins from authenticated;
create policy admins_select on public.admins
  for select to authenticated using (public.is_admin());

-- bookings: admins read + update. No INSERT policy (inserts only via
-- create_booking), no DELETE (bookings are cancelled, never deleted).
revoke insert, delete on public.bookings from authenticated;
create policy bookings_admin_select on public.bookings
  for select to authenticated using (public.is_admin());
create policy bookings_admin_update on public.bookings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- holidays / slot_overrides: full admin management
create policy holidays_admin_all on public.holidays
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy slot_overrides_admin_all on public.slot_overrides
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- settings: admins read + update existing keys
revoke insert, delete on public.booking_settings from authenticated;
create policy settings_admin_select on public.booking_settings
  for select to authenticated using (public.is_admin());
create policy settings_admin_update on public.booking_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_availability(date, date) to anon, authenticated, service_role;
grant execute on function public.get_public_settings()        to anon, authenticated, service_role;
grant execute on function public.is_admin()                   to authenticated, service_role;

-- create_booking: server only (it verifies the LINE ID token first)
grant execute on function public.create_booking(date, time, text, text, text, text, text, text, uuid) to service_role;

grant execute on function public.admin_update_booking(uuid, date, time, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_holiday(date, text)              to authenticated;
grant execute on function public.admin_close_slot(date, time, text, boolean) to authenticated;
grant execute on function public.admin_open_slot(date, time)                to authenticated;

-- helpers used inside RLS/functions
grant execute on function public.bkk_now(), public.standard_slot_starts(), public.is_standard_slot(time),
                          public.setting_int(text, int), public.slot_lock_key(date, time)
  to authenticated, service_role;
