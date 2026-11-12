import type { DayAvailability, DaySummary, SlotAvailability, SlotStatus } from "../../types";
import { SLOTS_PER_DAY, slotEnd } from "./constants";

interface AvailabilityRow {
  slot_date: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  holiday_note: string | null;
}

/** Group get_availability rows into days */
export function groupAvailability(rows: AvailabilityRow[]): DayAvailability[] {
  const byDay = new Map<string, DayAvailability>();
  for (const r of rows) {
    let day = byDay.get(r.slot_date);
    if (!day) {
      day = { date: r.slot_date, slots: [], holidayNote: r.holiday_note ?? null };
      byDay.set(r.slot_date, day);
    }
    const start = r.start_time.slice(0, 5);
    day.slots.push({ date: r.slot_date, start, end: r.end_time?.slice(0, 5) || slotEnd(start), status: r.status });
  }
  for (const d of byDay.values()) d.slots.sort((a, b) => a.start.localeCompare(b.start));
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Day status for the calendar:
 *  holiday      – shop holiday
 *  unavailable  – past day / beyond booking window / every remaining slot already passed
 *  full         – no free slot left and at least one is booked
 *  closed       – no free slot left, none booked (admin closed them)
 *  partial      – some slots booked, some free
 *  available    – free slots, nothing booked yet
 */
export function summarizeDay(day: DayAvailability): DaySummary {
  const count = (s: SlotStatus) => day.slots.filter((x: SlotAvailability) => x.status === s).length;
  const available = count("available");
  const booked = count("booked");
  const closed = count("closed");
  const base = { date: day.date, available, booked, closed, holidayNote: day.holidayNote };

  if (day.slots.length > 0 && day.slots.every((s) => s.status === "holiday")) return { ...base, status: "holiday" };
  if (available > 0) return { ...base, status: booked > 0 ? "partial" : "available" };

  const pastOrOut = day.slots.filter((s) => s.status === "past" || s.status === "out_of_range").length;
  if (pastOrOut === day.slots.length) return { ...base, status: "unavailable" };
  if (booked === SLOTS_PER_DAY || booked > 0) return { ...base, status: "full" };
  if (closed > 0) return { ...base, status: "closed" };
  return { ...base, status: "unavailable" };
}
