export type ServiceType = "eye_exam" | "repair" | "pickup" | "other";
export type BookingStatus = "confirmed" | "completed" | "cancelled";

/** Status of one slot as returned by get_availability (no personal data) */
export type SlotStatus = "available" | "booked" | "closed" | "holiday" | "past" | "out_of_range";

/** Day-level status shown on the calendar */
export type DayStatus = "available" | "partial" | "full" | "holiday" | "closed" | "unavailable";

export interface SlotAvailability {
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  status: SlotStatus;
}

export interface DayAvailability {
  date: string;
  slots: SlotAvailability[];
  holidayNote: string | null;
}

export interface DaySummary {
  date: string;
  status: DayStatus;
  available: number;
  booked: number;
  closed: number;
  holidayNote: string | null;
}

export interface Booking {
  id: string;
  booking_code: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  username: string;
  phone_number: string;
  service_type: ServiceType;
  service_detail: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  booking_status: BookingStatus;
  admin_note: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What the customer gets back after booking — no LINE user id, no internal fields */
export interface PublicBookingResult {
  bookingCode: string;
  date: string;
  start: string;
  end: string;
  username: string;
  phone: string;
  serviceType: ServiceType;
  serviceDetail: string | null;
}

export interface Holiday {
  id: string;
  holiday_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SlotOverride {
  id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: "closed";
  note: string | null;
}

export interface PublicSettings {
  max_advance_days?: number;
  min_lead_minutes?: number;
  announcement?: string;
  shop_phone?: string;
}
