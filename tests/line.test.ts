import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingConfirmedMessage, bookingReminderMessage, bookingCancelledMessage, bookingChangedMessage } from "../lib/line/messages";

const b = { bookingCode: "SE-261120-ABCD", date: "2026-11-20", start: "14:00", end: "15:00", username: "เมธี", serviceType: "eye_exam" as const };

test("confirmation is a valid Flex bubble with booking details", () => {
  const m = bookingConfirmedMessage(b, "https://socialeyewearbooking.vercel.app") as any;
  assert.equal(m.type, "flex");
  assert.ok(m.altText.length > 0 && m.altText.length <= 400, "altText within LINE limit");
  assert.equal(m.contents.type, "bubble");
  const json = JSON.stringify(m);
  for (const s of ["SE-261120-ABCD", "เมธี", "วัดสายตา ตัดแว่น", "20 พฤศจิกายน 2569", "14:00–15:00"]) assert.ok(json.includes(s), s);
  assert.equal(m.contents.footer.contents[0].action.uri, "https://socialeyewearbooking.vercel.app");
});

test("reminder, change and cancel messages", () => {
  const r = bookingReminderMessage(b) as any;
  assert.equal(r.type, "flex");
  assert.match(r.altText, /พรุ่งนี้/);
  assert.equal(r.contents.footer, undefined);
  const c = bookingCancelledMessage(b) as any;
  assert.equal(c.type, "text");
  assert.match(c.text, /ยกเลิก/);
  assert.ok(c.text.includes("SE-261120-ABCD"));
  const ch = bookingChangedMessage(b) as any;
  assert.match(ch.altText, /เปลี่ยนเวลานัด/);
});

test("messages are JSON-serialisable and under LINE's 30KB flex limit", () => {
  for (const m of [bookingConfirmedMessage(b, "https://x.y"), bookingReminderMessage(b), bookingChangedMessage(b)]) {
    assert.ok(Buffer.byteLength(JSON.stringify(m)) < 30_000);
  }
});
