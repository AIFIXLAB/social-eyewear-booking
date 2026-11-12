import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeThaiPhone,
  validateBookingRequest,
  validateCustomerFields,
  validateAdminUpdate,
  cleanText,
} from "../lib/validation/booking";

const KEY = "3b241101-e2bb-4255-8caf-4136c566a962";
const base = {
  date: "2026-11-20", startTime: "14:00", username: "สมชาย ใจดี", phone: "081-234-5678",
  serviceType: "eye_exam", serviceDetail: "", consent: true, idempotencyKey: KEY,
};

test("Thai phone normalisation keeps leading zero and accepts common formats", () => {
  assert.equal(normalizeThaiPhone("081-234-5678"), "0812345678");
  assert.equal(normalizeThaiPhone("081 234 5678"), "0812345678");
  assert.equal(normalizeThaiPhone("+66812345678"), "0812345678");
  assert.equal(normalizeThaiPhone("66812345678"), "0812345678");
  assert.equal(normalizeThaiPhone("02-123-4567"), "021234567"); // Bangkok landline
  assert.equal(normalizeThaiPhone("(034) 123456"), "034123456"); // provincial landline
  assert.equal(normalizeThaiPhone("034 12345"), null); // too short
  assert.equal(normalizeThaiPhone("812345678"), null); // missing 0
  assert.equal(normalizeThaiPhone("0112345678"), null); // invalid prefix
  assert.equal(normalizeThaiPhone("08123456789"), null); // too long
  assert.equal(normalizeThaiPhone(""), null);
  assert.equal(normalizeThaiPhone(812345678 as unknown as string), null); // number type rejected
});

test("valid booking request is accepted and cleaned", () => {
  const r = validateBookingRequest({ ...base, username: "  สมชาย   ใจดี  " });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.phone, "0812345678");
    assert.equal(r.value.username, "สมชาย ใจดี");
    assert.equal(r.value.serviceDetail, null);
    assert.equal(r.value.lineIdToken, null);
  }
});

test("all 4 service types are accepted; other requires detail", () => {
  for (const s of ["eye_exam", "repair", "pickup"]) assert.ok(validateBookingRequest({ ...base, serviceType: s }).ok, s);
  assert.equal(validateBookingRequest({ ...base, serviceType: "other" }).ok, false);
  assert.equal(validateBookingRequest({ ...base, serviceType: "other", serviceDetail: "   " }).ok, false);
  assert.ok(validateBookingRequest({ ...base, serviceType: "other", serviceDetail: "เปลี่ยนแป้นจมูก" }).ok);
  assert.equal(validateBookingRequest({ ...base, serviceType: "massage" }).ok, false);
});

test("rejects missing consent, bad slot, bad date, bad key, honeypot", () => {
  const bad = (patch: Record<string, unknown>) => validateBookingRequest({ ...base, ...patch });
  const c = bad({ consent: false });
  assert.equal(c.ok, false);
  if (!c.ok) assert.equal(c.errors.consent, "CONSENT_REQUIRED");
  assert.equal(bad({ startTime: "10:00" }).ok, false);
  assert.equal(bad({ startTime: "20:00" }).ok, false);
  assert.equal(bad({ startTime: "14:30" }).ok, false);
  assert.equal(bad({ date: "2026-02-30" }).ok, false);
  assert.equal(bad({ date: "20/11/2026" }).ok, false);
  assert.equal(bad({ idempotencyKey: "abc" }).ok, false);
  assert.equal(bad({ website: "http://spam" }).ok, false);
  assert.equal(bad({ username: "" }).ok, false);
  assert.equal(bad({ phone: "" }).ok, false);
  assert.equal(validateBookingRequest(null).ok, false);
  assert.equal(validateBookingRequest("x").ok, false);
});

test("all 9 standard slots are valid", () => {
  for (const t of ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"])
    assert.ok(validateBookingRequest({ ...base, startTime: t }).ok, t);
});

test("client never gets to supply LINE user id / display name", () => {
  const r = validateBookingRequest({ ...base, lineUserId: "Uabc", lineDisplayName: "fake", lineIdToken: "tok" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.lineIdToken, "tok");
    assert.equal("lineUserId" in r.value, false);
    assert.equal("lineDisplayName" in r.value, false);
  }
});

test("text cleaning strips control chars and limits length", () => {
  assert.equal(cleanText("a\u0000b\u0007c", 10), "abc");
  assert.equal(cleanText("x".repeat(200), 100).length, 100);
  assert.equal(cleanText(undefined, 10), "");
});

test("form validation messages are in Thai", () => {
  const e = validateCustomerFields({ username: "", phone: "123", serviceType: "", serviceDetail: "" });
  assert.match(e.username!, /กรุณา/);
  assert.match(e.phone!, /เบอร์/);
  assert.match(e.serviceType!, /บริการ/);
});

test("admin update validation", () => {
  const ok = validateAdminUpdate({ date: "2026-11-20", startTime: "19:00", username: "ก้อง", phone: "0899999999", serviceType: "pickup", status: "completed", adminNote: "  มาแล้ว " });
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(ok.value.adminNote, "มาแล้ว");
  assert.equal(validateAdminUpdate({ date: "2026-11-20", startTime: "19:00", username: "ก้อง", phone: "0899999999", serviceType: "pickup", status: "deleted" }).ok, false);
});
