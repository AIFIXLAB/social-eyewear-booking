import { test } from "node:test";
import assert from "node:assert/strict";
import { groupAvailability, summarizeDay } from "../lib/booking/calendar";
import { SLOT_STARTS, slotEnd, isStandardSlot } from "../lib/booking/constants";
import {
  addDays, addMonths, bangkokToday, formatThaiDate, formatThaiMonth, isYm, isYmd, monthGrid, monthRange, weekday,
} from "../lib/booking/dates";
import { toCsv } from "../lib/booking/csv";
import type { SlotStatus } from "../types";

function day(date: string, statuses: SlotStatus[], note: string | null = null) {
  return groupAvailability(
    SLOT_STARTS.map((s, i) => ({ slot_date: date, start_time: `${s}:00`, end_time: `${slotEnd(s)}:00`, status: statuses[i], holiday_note: note })),
  )[0];
}
const all = (s: SlotStatus) => Array(9).fill(s) as SlotStatus[];

test("9 standard slots 11:00–20:00", () => {
  assert.equal(SLOT_STARTS.length, 9);
  assert.equal(SLOT_STARTS[0], "11:00");
  assert.equal(slotEnd("19:00"), "20:00");
  assert.ok(isStandardSlot("15:00"));
  assert.ok(!isStandardSlot("10:00"));
  assert.ok(!isStandardSlot("20:00"));
});

test("day status: available / partial / full / holiday / closed / unavailable", () => {
  assert.equal(summarizeDay(day("2026-11-20", all("available"))).status, "available");

  const partial = summarizeDay(day("2026-11-20", ["booked", "booked", ...Array(7).fill("available")]));
  assert.equal(partial.status, "partial");
  assert.equal(partial.available, 7);
  assert.equal(partial.booked, 2);

  assert.equal(summarizeDay(day("2026-11-20", all("booked"))).status, "full");
  assert.equal(summarizeDay(day("2026-11-20", ["closed", ...Array(8).fill("booked")])).status, "full");

  const h = summarizeDay(day("2026-11-13", all("holiday"), "หยุดประจำเดือน"));
  assert.equal(h.status, "holiday");
  assert.equal(h.holidayNote, "หยุดประจำเดือน");

  assert.equal(summarizeDay(day("2026-11-20", all("closed"))).status, "closed");
  assert.equal(summarizeDay(day("2026-11-01", all("past"))).status, "unavailable");
  assert.equal(summarizeDay(day("2027-06-01", all("out_of_range"))).status, "unavailable");
  // today: morning passed, rest booked → full
  assert.equal(summarizeDay(day("2026-11-12", [...Array(5).fill("past"), ...Array(4).fill("booked")])).status, "full");
  // today: morning passed, afternoon free → available
  assert.equal(summarizeDay(day("2026-11-12", [...Array(5).fill("past"), ...Array(4).fill("available")])).status, "available");
});

test("groupAvailability trims times and sorts", () => {
  const d = day("2026-11-20", all("available"));
  assert.equal(d.slots[0].start, "11:00");
  assert.equal(d.slots[8].end, "20:00");
});

test("date helpers (timezone-independent)", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.deepEqual(monthRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.equal(weekday("2026-11-12"), 4); // Thursday
  const g = monthGrid("2026-11"); // 1 Nov 2026 is a Sunday
  assert.equal(g[0], "2026-11-01");
  assert.equal(g.length % 7, 0);
  assert.ok(isYmd("2026-11-13") && !isYmd("2026-13-01") && !isYmd("2026-11-31"));
  assert.ok(isYm("2026-11") && !isYm("2026-13"));
});

test("Bangkok 'today' is correct regardless of server timezone", () => {
  // 2026-11-12 18:30 UTC = 2026-11-13 01:30 in Bangkok
  assert.equal(bangkokToday(new Date("2026-11-12T18:30:00Z")), "2026-11-13");
  assert.equal(bangkokToday(new Date("2026-11-12T16:59:00Z")), "2026-11-12");
});

test("Thai date formatting uses Buddhist year", () => {
  assert.equal(formatThaiDate("2026-11-13"), "วันศุกร์ที่ 13 พฤศจิกายน 2569");
  assert.equal(formatThaiDate("2026-11-13", { weekday: false }), "13 พฤศจิกายน 2569");
  assert.equal(formatThaiMonth("2026-11"), "พฤศจิกายน 2569");
});

test("CSV export: BOM, quoting, formula-injection guard, Thai text", () => {
  const csv = toCsv(["ชื่อ", "หมายเหตุ"], [["สมชาย", 'มี "เครื่องหมาย", คอมมา'], ["=HYPERLINK(1)", null]]);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes('"มี ""เครื่องหมาย"", คอมมา"'));
  assert.ok(csv.includes("'=HYPERLINK(1)"));
  assert.ok(csv.includes("สมชาย"));
});
