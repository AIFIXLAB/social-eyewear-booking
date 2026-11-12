#!/usr/bin/env bash
# Real concurrency test: fires many simultaneous connections at the SAME slot.
# Usage: PGURL="postgres://..." ./supabase/tests/concurrency_test.sh
# (run against a scratch DB that has the migration applied; it writes test rows)
set -euo pipefail
PGURL="${PGURL:?set PGURL}"
N="${N:-50}"
OUT="$(mktemp -d)"
D=$(psql "$PGURL" -tAc "select public.bkk_now()::date + 5")
fail=0

# start clean so the script can be re-run (only touches its own test dates)
psql "$PGURL" -q -c "delete from bookings where booking_date between public.bkk_now()::date + 5 and public.bkk_now()::date + 7;
                     delete from holidays where holiday_date between public.bkk_now()::date + 5 and public.bkk_now()::date + 7;
                     delete from slot_overrides where slot_date between public.bkk_now()::date + 5 and public.bkk_now()::date + 7;"

run_parallel () {  # $1 label, $2 sql-template with {i}
  local label="$1" tpl="$2"
  rm -f "$OUT"/*.res
  for i in $(seq 1 "$N"); do
    ( psql "$PGURL" -tAq -c "set role service_role; ${tpl//\{i\}/$i}" > "$OUT/$i.res" 2>&1 ) &
  done
  wait
}

check () { if [ "$1" = "$2" ]; then echo "PASS: $3 (got $1)"; else echo "FAIL: $3 (expected $2, got $1)"; fail=1; fi; }

# --- 1) N different customers, same slot, same instant -------------------
run_parallel "race" "select public.create_booking('$D','14:00','Customer {i}','08100000'||lpad('{i}',2,'0'),'eye_exam',null,null,null,gen_random_uuid())->>'code';"
created=$(cat "$OUT"/*.res | grep -c '^CREATED$' || true)
taken=$(cat "$OUT"/*.res | grep -c '^SLOT_TAKEN$' || true)
rows=$(psql "$PGURL" -tAc "select count(*) from bookings where booking_date='$D' and start_time='14:00' and booking_status<>'cancelled'")
check "$created" 1 "$N concurrent customers -> exactly 1 CREATED"
check "$taken" $((N-1)) "the other $((N-1)) get SLOT_TAKEN"
check "$rows" 1 "exactly 1 active row in DB for the slot"

# --- 2) same request sent N times at once (double click / retry) ----------
KEY=$(psql "$PGURL" -tAc "select gen_random_uuid()")
run_parallel "dup" "select public.create_booking('$D','15:00','Dup','0899999999','repair',null,null,null,'$KEY')->>'code';"
okc=$(cat "$OUT"/*.res | grep -cE '^(CREATED|REPLAYED)$' || true)
cre=$(cat "$OUT"/*.res | grep -c '^CREATED$' || true)
rows=$(psql "$PGURL" -tAc "select count(*) from bookings where idempotency_key='$KEY'")
check "$okc" "$N" "$N duplicate submits all answered OK (idempotent)"
check "$cre" 1 "only 1 of them actually CREATED"
check "$rows" 1 "only 1 row stored for the idempotency key"

# --- 3) customers vs admin closing the whole day as holiday at once -------
psql "$PGURL" -q -c "insert into auth.users values ('99999999-9999-9999-9999-999999999999','c@t') on conflict do nothing;
                     insert into admins values ('99999999-9999-9999-9999-999999999999','c@t') on conflict do nothing;"
D2=$(psql "$PGURL" -tAc "select public.bkk_now()::date + 6")
rm -f "$OUT"/*.res
for i in $(seq 1 9); do
  h=$((10+i))
  ( psql "$PGURL" -tAq -c "set role service_role; select public.create_booking('$D2','$h:00','C$i','08200000'||lpad('$i',2,'0'),'eye_exam',null,null,null,gen_random_uuid())->>'code';" > "$OUT/c$i.res" 2>&1 ) &
done
( psql "$PGURL" -tAq -c "set role authenticated; set request.jwt.claim.sub='99999999-9999-9999-9999-999999999999';
   select jsonb_array_length(public.admin_set_holiday('$D2','race test')->'conflicting_bookings');" > "$OUT/h.res" 2>&1 ) &
wait
created=$(cat "$OUT"/c*.res | grep -c '^CREATED$' || true)
reported=$(tr -d '[:space:]' < "$OUT/h.res")
check "$reported" "$created" "holiday race: every booking that got in is reported to admin (none lost/hidden)"
after=$(psql "$PGURL" -tAq -c "set role service_role; select public.create_booking('$D2','19:00','late','0830000000','eye_exam',null,null,null,null)->>'code'")
[ "$created" -lt 9 ] || after=HOLIDAY  # if all 9 got in before the lock, 19:00 is taken anyway
check "$after" "HOLIDAY" "after holiday is set, new bookings are refused"

# --- 4) customers vs admin closing a slot at once ------------------------
D3=$(psql "$PGURL" -tAc "select public.bkk_now()::date + 7")
rm -f "$OUT"/*.res
for i in $(seq 1 20); do
  ( psql "$PGURL" -tAq -c "set role service_role; select public.create_booking('$D3','12:00','S$i','08300000'||lpad('$i',2,'0'),'eye_exam',null,null,null,gen_random_uuid())->>'code';" > "$OUT/s$i.res" 2>&1 ) &
done
( psql "$PGURL" -tAq -c "set role authenticated; set request.jwt.claim.sub='99999999-9999-9999-9999-999999999999';
   select public.admin_close_slot('$D3','12:00','race')->>'code';" > "$OUT/x.res" 2>&1 ) &
wait
created=$(cat "$OUT"/s*.res | grep -c '^CREATED$' || true)
closed=$(tr -d '[:space:]' < "$OUT/x.res")
if { [ "$created" = 1 ] && [ "$closed" = HAS_BOOKING ]; } || { [ "$created" = 0 ] && [ "$closed" = CLOSED ]; }; then
  echo "PASS: close-vs-book race is consistent (created=$created, close=$closed)"
else
  echo "FAIL: close-vs-book race inconsistent (created=$created, close=$closed)"; fail=1
fi

rm -rf "$OUT"
[ $fail = 0 ] && echo "ALL CONCURRENCY TESTS PASSED" || { echo "CONCURRENCY TESTS FAILED"; exit 1; }
