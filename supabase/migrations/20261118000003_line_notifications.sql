-- =====================================================================
-- Migration 0003: LINE notifications (booking confirmation + reminder)
--
-- The web server (publishable key) can read only what a reminder needs,
-- and only with the server token from booking_settings.server_token.
-- =====================================================================

alter table public.bookings add column if not exists reminder_sent_at timestamptz;

create index if not exists bookings_reminder_due_idx
  on public.bookings (booking_date)
  where booking_status = 'confirmed' and line_user_id is not null and reminder_sent_at is null;

create or replace function public.server_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p_token is not null and p_token = (setting_value #>> '{}')
       from public.booking_settings where setting_key = 'server_token'),
    false)
$$;

-- Bookings on p_date that still need a LINE reminder
create or replace function public.get_due_reminders(p_date date, p_token text)
returns table (
  id            uuid,
  booking_code  text,
  booking_date  date,
  start_time    time,
  end_time      time,
  username      text,
  service_type  text,
  line_user_id  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.server_token_ok(p_token) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
    select b.id, b.booking_code, b.booking_date, b.start_time, b.end_time,
           b.username, b.service_type, b.line_user_id
    from public.bookings b
    where b.booking_date = p_date
      and b.booking_status = 'confirmed'
      and b.line_user_id is not null
      and b.reminder_sent_at is null
    order by b.start_time;
end;
$$;

create or replace function public.mark_reminders_sent(p_ids uuid[], p_token text)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.server_token_ok(p_token) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update public.bookings set reminder_sent_at = now()
  where id = any(p_ids) and reminder_sent_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.server_token_ok(text) from public, anon, authenticated;
revoke execute on function public.get_due_reminders(date, text) from public;
revoke execute on function public.mark_reminders_sent(uuid[], text) from public;
grant execute on function public.get_due_reminders(date, text)     to anon, authenticated, service_role;
grant execute on function public.mark_reminders_sent(uuid[], text) to anon, authenticated, service_role;

-- Moving a booking to another day/time → it needs a new reminder
create or replace function public.reset_reminder_on_move()
returns trigger
language plpgsql
as $$
begin
  if (new.booking_date, new.start_time) is distinct from (old.booking_date, old.start_time) then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_reset_reminder on public.bookings;
create trigger bookings_reset_reminder
  before update on public.bookings
  for each row execute function public.reset_reminder_on_move();

-- LINE settings, editable by admins in /admin/settings
insert into public.booking_settings (setting_key, setting_value, description, is_public) values
  ('liff_id',                   '"2012686937-u7uuHRUX"'::jsonb, 'LINE LIFF ID (เช่น 2001234567-AbCdEfGh)', true),
  ('line_login_channel_id',     '"2012686937"'::jsonb, 'LINE Login Channel ID (ตัวเลข 10 หลัก)', false),
  ('line_channel_access_token', '""'::jsonb, 'Messaging API Channel access token (long-lived)', false)
on conflict (setting_key) do nothing;

-- Server reads the private LINE settings with the server token
create or replace function public.get_line_config(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.server_token_ok(p_token) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(setting_key, setting_value)
    from public.booking_settings
    where setting_key in ('liff_id', 'line_login_channel_id', 'line_channel_access_token')
  ), '{}'::jsonb);
end;
$$;

revoke execute on function public.get_line_config(text) from public;
grant execute on function public.get_line_config(text) to anon, authenticated, service_role;
