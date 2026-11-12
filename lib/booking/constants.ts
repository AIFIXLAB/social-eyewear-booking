import type { BookingStatus, ServiceType } from "../../types";

/** The 9 standard slots. Mirrors public.standard_slot_starts() in SQL. */
export const SLOT_STARTS = [
  "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00",
] as const;

export const SLOTS_PER_DAY = SLOT_STARTS.length;

export function slotEnd(start: string): string {
  const h = Number(start.slice(0, 2)) + 1;
  return `${String(h).padStart(2, "0")}:00`;
}

export function isStandardSlot(start: string): boolean {
  return (SLOT_STARTS as readonly string[]).includes(start);
}

export const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "eye_exam", label: "วัดสายตา ตัดแว่น" },
  { value: "repair", label: "งานซ่อมแซม ปรับดัด" },
  { value: "pickup", label: "นัดรับแว่น" },
  { value: "other", label: "อื่น ๆ" },
];

export const SERVICE_LABEL: Record<ServiceType, string> = Object.fromEntries(
  SERVICE_TYPES.map((s) => [s.value, s.label]),
) as Record<ServiceType, string>;

export const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "ยืนยันแล้ว",
  completed: "เข้ารับบริการแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

/** Error codes returned by the database functions / API → Thai messages */
export const ERROR_MESSAGES: Record<string, string> = {
  SLOT_TAKEN: "ขออภัย รอบนี้เพิ่งถูกจองไปแล้ว กรุณาเลือกรอบอื่น",
  SLOT_CLOSED: "รอบนี้ปิดรับจองแล้ว กรุณาเลือกรอบอื่น",
  HOLIDAY: "วันนี้เป็นวันหยุดร้าน กรุณาเลือกวันอื่น",
  PAST_SLOT: "รอบนี้เลยเวลาที่เปิดให้จองแล้ว กรุณาเลือกรอบอื่น",
  OUT_OF_RANGE: "วันที่เลือกเกินช่วงเวลาที่เปิดให้จองล่วงหน้า",
  INVALID_SLOT: "รอบเวลาไม่ถูกต้อง",
  INVALID_INPUT: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
  TOO_MANY_BOOKINGS: "เบอร์โทรศัพท์นี้มีนัดที่ยังไม่ถึงกำหนดครบจำนวนแล้ว หากต้องการเปลี่ยนนัดกรุณาติดต่อร้าน",
  IDEMPOTENCY_MISMATCH: "คำขอซ้ำไม่ตรงกับรายการเดิม กรุณาเริ่มจองใหม่",
  CONSENT_REQUIRED: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนยืนยันการจอง",
  LINE_TOKEN_INVALID: "ไม่สามารถยืนยันบัญชี LINE ได้ (เซสชันอาจหมดอายุ)",
  RATE_LIMITED: "มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่",
  SERVER_NOT_CONFIGURED: "ระบบยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล กรุณาติดต่อร้าน",
  SERVER_ERROR: "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
  NETWORK_ERROR: "เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
  TIMEOUT: "ระบบตอบกลับช้ากว่าปกติ กดลองอีกครั้งได้เลย ระบบจะไม่จองซ้ำ",
  NOT_FOUND: "ไม่พบรายการ",
  HAS_BOOKING: "รอบนี้มีลูกค้าจองอยู่แล้ว",
  PAST_DATE: "ไม่สามารถตั้งวันหยุดย้อนหลังได้",
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบ",
  FORBIDDEN: "บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ",
};

export function errorMessage(code: string | undefined | null): string {
  return (code && ERROR_MESSAGES[code]) || ERROR_MESSAGES.SERVER_ERROR;
}
