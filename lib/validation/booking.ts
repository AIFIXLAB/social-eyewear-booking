import type { BookingStatus, ServiceType } from "../../types";
import { isStandardSlot } from "../booking/constants";
import { isYmd } from "../booking/dates";

export const SERVICE_VALUES: ServiceType[] = ["eye_exam", "repair", "pickup", "other"];
export const STATUS_VALUES: BookingStatus[] = ["confirmed", "completed", "cancelled"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalise a Thai phone number to 0XXXXXXXX(X).
 * Accepts spaces, dashes, dots, brackets and +66 / 66 prefix.
 * Returns null if it is not a valid Thai number.
 *   Mobile: 06/08/09 + 8 digits (10 digits total)
 *   Landline: 02-07 + 7 digits (9 digits total)
 */
export function normalizeThaiPhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let s = input.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("+66")) s = "0" + s.slice(3);
  else if (/^66\d{8,9}$/.test(s)) s = "0" + s.slice(2);
  if (/^0[689]\d{8}$/.test(s)) return s;
  if (/^0[2-7]\d{7}$/.test(s)) return s;
  return null;
}

/** Strip control characters and collapse whitespace */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function cleanMultiline(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export interface BookingInput {
  date: string;
  startTime: string;
  username: string;
  phone: string;
  serviceType: ServiceType;
  serviceDetail: string | null;
  idempotencyKey: string;
  lineIdToken: string | null;
}

export type FieldErrors = Partial<Record<keyof BookingInput | "consent" | "form", string>>;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

/** Client-side form check (also reused on the server) */
export function validateCustomerFields(f: {
  username: string; phone: string; serviceType: string; serviceDetail: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const name = cleanText(f.username, 100);
  if (!name) errors.username = "กรุณากรอกชื่อผู้จอง";
  else if (name.length < 2) errors.username = "ชื่อสั้นเกินไป";

  if (!f.phone.trim()) errors.phone = "กรุณากรอกเบอร์โทรศัพท์";
  else if (!normalizeThaiPhone(f.phone)) errors.phone = "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง เช่น 081-234-5678";

  if (!SERVICE_VALUES.includes(f.serviceType as ServiceType)) errors.serviceType = "กรุณาเลือกประเภทบริการ";
  else if (f.serviceType === "other" && !cleanMultiline(f.serviceDetail, 500))
    errors.serviceDetail = "กรุณาระบุรายละเอียดบริการ";
  if (f.serviceDetail && f.serviceDetail.length > 500) errors.serviceDetail = "รายละเอียดยาวเกิน 500 ตัวอักษร";
  return errors;
}

/** Full server-side validation of the public booking request body */
export function validateBookingRequest(body: unknown): ValidationResult<BookingInput> {
  if (!body || typeof body !== "object") return { ok: false, errors: { form: "INVALID_INPUT" } };
  const b = body as Record<string, unknown>;
  const errors: FieldErrors = {};

  // bot honeypot — real users never fill this hidden field
  if (typeof b.website === "string" && b.website.trim() !== "") return { ok: false, errors: { form: "INVALID_INPUT" } };

  if (b.consent !== true) errors.consent = "CONSENT_REQUIRED";
  if (!isYmd(b.date)) errors.date = "วันที่ไม่ถูกต้อง";
  if (typeof b.startTime !== "string" || !isStandardSlot(b.startTime)) errors.startTime = "รอบเวลาไม่ถูกต้อง";
  if (typeof b.idempotencyKey !== "string" || !UUID_RE.test(b.idempotencyKey)) errors.idempotencyKey = "INVALID_INPUT";

  Object.assign(errors, validateCustomerFields({
    username: typeof b.username === "string" ? b.username : "",
    phone: typeof b.phone === "string" ? b.phone : "",
    serviceType: typeof b.serviceType === "string" ? b.serviceType : "",
    serviceDetail: typeof b.serviceDetail === "string" ? b.serviceDetail : "",
  }));

  const lineIdToken = typeof b.lineIdToken === "string" && b.lineIdToken.length > 0 && b.lineIdToken.length < 4096
    ? b.lineIdToken : null;

  if (Object.keys(errors).length) return { ok: false, errors };

  const detail = cleanMultiline(b.serviceDetail, 500);
  return {
    ok: true,
    value: {
      date: b.date as string,
      startTime: b.startTime as string,
      username: cleanText(b.username, 100),
      phone: normalizeThaiPhone(b.phone)!,
      serviceType: b.serviceType as ServiceType,
      serviceDetail: detail || null,
      idempotencyKey: (b.idempotencyKey as string).toLowerCase(),
      lineIdToken,
    },
  };
}

export interface AdminBookingUpdate {
  date: string;
  startTime: string;
  username: string;
  phone: string;
  serviceType: ServiceType;
  serviceDetail: string | null;
  status: BookingStatus;
  adminNote: string | null;
}

export function validateAdminUpdate(body: unknown): ValidationResult<AdminBookingUpdate> {
  if (!body || typeof body !== "object") return { ok: false, errors: { form: "INVALID_INPUT" } };
  const b = body as Record<string, unknown>;
  const errors: FieldErrors & { status?: string } = {};
  if (!isYmd(b.date)) errors.date = "วันที่ไม่ถูกต้อง";
  if (typeof b.startTime !== "string" || !isStandardSlot(b.startTime)) errors.startTime = "รอบเวลาไม่ถูกต้อง";
  if (!STATUS_VALUES.includes(b.status as BookingStatus)) errors.status = "สถานะไม่ถูกต้อง";
  Object.assign(errors, validateCustomerFields({
    username: typeof b.username === "string" ? b.username : "",
    phone: typeof b.phone === "string" ? b.phone : "",
    serviceType: typeof b.serviceType === "string" ? b.serviceType : "",
    serviceDetail: typeof b.serviceDetail === "string" ? b.serviceDetail : "",
  }));
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      date: b.date as string,
      startTime: b.startTime as string,
      username: cleanText(b.username, 100),
      phone: normalizeThaiPhone(b.phone)!,
      serviceType: b.serviceType as ServiceType,
      serviceDetail: cleanMultiline(b.serviceDetail, 500) || null,
      status: b.status as BookingStatus,
      adminNote: cleanMultiline(b.adminNote, 1000) || null,
    },
  };
}

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}
