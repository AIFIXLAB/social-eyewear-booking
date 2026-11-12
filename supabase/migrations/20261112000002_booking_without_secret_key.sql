-- =====================================================================
-- Migration 0002: let the server create bookings with the PUBLISHABLE key
-- (no Supabase secret key needed on Vercel).
--
-- create_booking_public() is a thin wrapper around create_booking(). All
-- the same rules apply (slot checks, lock, unique index, phone format,
-- holiday/closed, per-phone limit). The only extra protection the secret
-- key used to give was that LINE user id/name could only come from our
-- server after it verified the LINE ID token. That is now enforced with a
-- server token: without the correct token the LINE fields are dropped.
-- =====================================================================

insert into public.booking_settings (setting_key, setting_value, description, is_public)
values ('server_token', to_jsonb('c7fa22a1a212ee49322e8f54f8bd995afa19a1a403c8fa89'::text), 'internal: shared with the web server, do not edit', false)
on conflict (setting_key) do update set setting_value = excluded.setting_value;

create or replace function public.create_booking_public(
  p_booking_date      date,
  p_start_time        time,
  p_username          text,
  p_phone_number      text,
  p_service_type      text,
  p_service_detail    text,
  p_line_user_id      text,
  p_line_display_name text,
  p_idempotency_key   uuid,
  p_server_token      text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  select p_server_token is not null and p_server_token = (setting_value #>> '{}')
    into v_ok
  from public.booking_settings where setting_key = 'server_token';

  return public.create_booking(
    p_booking_date, p_start_time, p_username, p_phone_number, p_service_type, p_service_detail,
    case when coalesce(v_ok, false) then p_line_user_id end,
    case when coalesce(v_ok, false) then p_line_display_name end,
    p_idempotency_key);
end;
$$;

revoke execute on function public.create_booking_public(date, time, text, text, text, text, text, text, uuid, text) from public;
grant execute on function public.create_booking_public(date, time, text, text, text, text, text, text, uuid, text)
  to anon, authenticated, service_role;
