"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DayAvailability, DaySummary, PublicBookingResult, PublicSettings, ServiceType, SlotAvailability } from "@/types";
import { MonthCalendar, CalendarLegend } from "@/components/calendar/MonthCalendar";
import { SlotPicker } from "./SlotPicker";
import { BookingForm, type FormValues } from "./BookingForm";
import { BookingSummary } from "./BookingSummary";
import { Button } from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useLiff } from "@/lib/line/useLiff";
import { addMonths, bangkokToday, formatThaiDate, monthOf } from "@/lib/booking/dates";
import { errorMessage } from "@/lib/booking/constants";
import { normalizeThaiPhone, validateCustomerFields, type FieldErrors } from "@/lib/validation/booking";

type Step = "pick" | "form" | "confirm" | "success";
type DayWithSummary = DayAvailability & { summary: DaySummary };

const PENDING_KEY = "se-booking-pending";
const SUCCESS_KEY = "se-booking-success";
const SLOT_GONE = ["SLOT_TAKEN", "SLOT_CLOSED", "HOLIDAY", "PAST_SLOT", "OUT_OF_RANGE"];

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const ss = {
  get<T>(k: string): T | null {
    try {
      const v = sessionStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      sessionStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
  del(k: string) {
    try {
      sessionStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

interface Pending {
  key: string;
  slot: SlotAvailability;
  values: FormValues;
}

const emptyForm: FormValues = { username: "", phone: "", serviceType: "", serviceDetail: "", website: "" };

export function BookingApp() {
  const toast = useToast();
  const { state: liff, getIdToken, relogin } = useLiff();

  const [today, setToday] = useState(() => bangkokToday());
  const [month, setMonth] = useState(() => monthOf(bangkokToday()));
  const [days, setDays] = useState<Record<string, DayWithSummary>>({});
  const [settings, setSettings] = useState<PublicSettings>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("pick");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotAvailability | null>(null);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [consent, setConsent] = useState(false);
  const [idemKey, setIdemKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ code: string; uncertain: boolean } | null>(null);
  const [useLine, setUseLine] = useState(true);
  const [result, setResult] = useState<PublicBookingResult | null>(null);
  const [restoredPending, setRestoredPending] = useState(false);

  const slotsRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const reqSeq = useRef(0);

  // ---------- data loading ----------
  const load = useCallback(async (ym: string) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/availability?month=${ym}`, { cache: "no-store" });
      const data = await res.json();
      if (seq !== reqSeq.current) return;
      if (!res.ok || !data.ok) throw new Error(data.code || "SERVER_ERROR");
      const map: Record<string, DayWithSummary> = {};
      for (const d of data.days as DayWithSummary[]) map[d.date] = d;
      setDays(map);
      setSettings(data.settings ?? {});
      setToday(data.today);
    } catch (e) {
      if (seq !== reqSeq.current) return;
      const code = e instanceof Error && e.message !== "Failed to fetch" ? e.message : "NETWORK_ERROR";
      setLoadError(code);
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [month, load]);

  // keep in sync when the customer comes back to the tab (others may have booked)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && step === "pick") load(month);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load, month, step]);

  // restore after refresh: a finished booking, or a request whose answer we never got
  useEffect(() => {
    const done = ss.get<PublicBookingResult>(SUCCESS_KEY);
    if (done) {
      setResult(done);
      setStep("success");
      return;
    }
    const p = ss.get<Pending>(PENDING_KEY);
    if (p?.key && p.slot && p.values) {
      setSlot(p.slot);
      setSelectedDate(p.slot.date);
      setMonth(monthOf(p.slot.date));
      setValues(p.values);
      setIdemKey(p.key);
      setConsent(true);
      setRestoredPending(true);
      setStep("confirm");
    }
  }, []);

  // prefill username from LINE (only if the customer hasn't typed one)
  useEffect(() => {
    if (liff.status === "ready") setValues((v) => (v.username ? v : { ...v, username: liff.displayName }));
  }, [liff]);

  const summaries = useMemo(() => {
    const out: Record<string, DaySummary> = {};
    for (const [k, d] of Object.entries(days)) out[k] = d.summary;
    return out;
  }, [days]);

  const maxMonth = useMemo(() => {
    const max = Number(settings.max_advance_days ?? 60);
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + max);
    return d.toISOString().slice(0, 7);
  }, [settings.max_advance_days, today]);

  const selectedDay = selectedDate ? days[selectedDate] : undefined;

  // ---------- step handlers ----------
  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function pickDate(date: string) {
    setSelectedDate(date);
    setSlot(null);
    requestAnimationFrame(() => slotsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function pickSlot(s: SlotAvailability) {
    setSlot(s);
    setStep("form");
    setSubmitError(null);
    scrollTop();
  }

  function patchValues(p: Partial<FormValues>) {
    setValues((v) => ({ ...v, ...p }));
    setErrors((e) => {
      const n = { ...e };
      for (const k of Object.keys(p)) delete n[k as keyof FieldErrors];
      return n;
    });
  }

  function toConfirm() {
    const errs = validateCustomerFields({ ...values, serviceType: values.serviceType || "" });
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("กรุณาตรวจสอบข้อมูลให้ครบถ้วน");
      return;
    }
    setValues((v) => ({ ...v, phone: normalizeThaiPhone(v.phone) ?? v.phone }));
    setIdemKey(uuid()); // one key per confirmed set of data
    setSubmitError(null);
    setStep("confirm");
    scrollTop();
  }

  function resetAll(keepDate = false) {
    ss.del(PENDING_KEY);
    ss.del(SUCCESS_KEY);
    setStep("pick");
    setSlot(null);
    if (!keepDate) setSelectedDate(null);
    setValues((v) => ({ ...emptyForm, username: liff.status === "ready" ? liff.displayName : "", phone: keepDate ? v.phone : "" }));
    setErrors({});
    setConsent(false);
    setIdemKey(null);
    setSubmitError(null);
    setResult(null);
    setRestoredPending(false);
    load(month);
    scrollTop();
  }

  async function submit() {
    if (!slot || !idemKey || submitting) return;
    if (!consent) {
      toast.error(errorMessage("CONSENT_REQUIRED"));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    ss.set(PENDING_KEY, { key: idemKey, slot, values } satisfies Pending);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          date: slot.date,
          startTime: slot.start,
          username: values.username,
          phone: values.phone,
          serviceType: values.serviceType,
          serviceDetail: values.serviceDetail,
          consent: true,
          idempotencyKey: idemKey,
          lineIdToken: useLine && liff.status === "ready" ? getIdToken() : null,
          website: values.website,
        }),
      });
      let data: { ok?: boolean; code?: string; booking?: PublicBookingResult } = {};
      try {
        data = await res.json();
      } catch {
        /* non-JSON (e.g. platform error page) */
      }

      if (res.ok && data.ok && data.booking) {
        ss.del(PENDING_KEY);
        ss.set(SUCCESS_KEY, data.booking);
        setResult(data.booking);
        setStep("success");
        scrollTop();
        return;
      }

      const code = data.code || (res.status >= 500 ? "SERVER_ERROR" : "INVALID_INPUT");
      if (SLOT_GONE.includes(code)) {
        // definitive "no": free the form, send the customer back to choose again
        ss.del(PENDING_KEY);
        toast.error(errorMessage(code));
        setIdemKey(null);
        setRestoredPending(false);
        setStep("pick");
        setSlot(null);
        const ym = monthOf(slot.date);
        if (ym === month) await load(ym);
        else setMonth(ym);
        requestAnimationFrame(() => slotsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }
      if (res.status >= 500 || code === "RATE_LIMITED") {
        setSubmitError({ code, uncertain: res.status >= 500 }); // safe to retry with same key
        return;
      }
      // other definitive errors: allow editing
      ss.del(PENDING_KEY);
      setSubmitError({ code, uncertain: false });
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setSubmitError({ code: aborted ? "TIMEOUT" : "NETWORK_ERROR", uncertain: true });
    } finally {
      clearTimeout(timer);
      setSubmitting(false);
    }
  }

  // ---------- render ----------
  const canPrev = month > monthOf(today);
  const canNext = month < maxMonth;

  return (
    <div ref={topRef} className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:pt-10">
      <header className="mb-6 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
        <div>
          <p className="text-sm font-semibold tracking-wide text-brand-700">Social Eyewear</p>
          <h1 className="text-2xl font-bold text-neutral-900">จองคิวตรวจสายตา</h1>
        </div>
      </header>

      {step !== "success" && <Stepper step={step} />}

      {step === "pick" && (
        <>
          <p className="mb-4 text-sm leading-relaxed text-neutral-600">
            เลือกวันที่ต้องการ แล้วเลือกรอบเวลาที่ว่าง (รอบละ 1 ชั่วโมง รับลูกค้า 1 ท่านต่อรอบ) จากนั้นกรอกชื่อและเบอร์โทรศัพท์เพื่อยืนยันการจอง
            ไม่ต้องสมัครสมาชิก
          </p>
          {settings.announcement ? <div className="mb-4"><Alert kind="warning">{settings.announcement}</Alert></div> : null}

          <div className="card p-4 sm:p-6">
            {loadError && !Object.keys(days).length ? (
              <EmptyState
                title="โหลดปฏิทินไม่สำเร็จ"
                description={errorMessage(loadError)}
                action={<Button onClick={() => load(month)}>ลองอีกครั้ง</Button>}
              />
            ) : (
              <>
                <MonthCalendar
                  month={month}
                  summaries={summaries}
                  selected={selectedDate}
                  today={today}
                  onSelect={pickDate}
                  onPrev={() => canPrev && setMonth(addMonths(month, -1))}
                  onNext={() => canNext && setMonth(addMonths(month, 1))}
                  canPrev={canPrev}
                  canNext={canNext}
                  loading={loading}
                />
                <div className="mt-4 border-t border-neutral-100 pt-3">
                  <CalendarLegend />
                </div>
              </>
            )}
            {loading && !Object.keys(days).length && <LoadingBlock label="กำลังโหลดคิวว่าง..." />}
          </div>

          <div ref={slotsRef} className="scroll-mt-4">
            {selectedDay ? (
              <div className="card mt-4 p-4 sm:p-6">
                <SlotPicker day={selectedDay} summary={selectedDay.summary} selectedStart={slot?.start ?? null} onPick={pickSlot} />
              </div>
            ) : (
              !loading && !loadError && (
                <p className="mt-4 text-center text-sm text-neutral-500">แตะวันที่ในปฏิทินเพื่อดูรอบตรวจ</p>
              )
            )}
          </div>
        </>
      )}

      {step === "form" && slot && (
        <div className="card p-4 sm:p-6">
          <SelectedSlotBar slot={slot} onChange={() => setStep("pick")} />
          <BookingForm values={values} errors={errors} liff={liff} onChange={patchValues} />
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="secondary" size="lg" onClick={() => setStep("pick")}>ย้อนกลับ</Button>
            <Button size="lg" onClick={toConfirm}>ถัดไป: ตรวจสอบข้อมูล</Button>
          </div>
        </div>
      )}

      {step === "confirm" && slot && values.serviceType && (
        <div className="card p-4 sm:p-6">
          <h2 className="mb-1 text-lg font-semibold">ตรวจสอบข้อมูลการจอง</h2>
          <p className="mb-4 text-sm text-neutral-500">โปรดตรวจสอบความถูกต้องก่อนกดยืนยัน</p>

          {restoredPending && !submitError && (
            <div className="mb-4">
              <Alert kind="warning">
                พบคำขอจองที่ยังไม่ได้รับการยืนยันจากระบบ กด <strong>ยืนยันการจอง</strong> อีกครั้งเพื่อตรวจสอบผล — ระบบจะไม่สร้างรายการซ้ำ
              </Alert>
            </div>
          )}

          <BookingSummary
            username={values.username}
            phone={values.phone}
            serviceType={values.serviceType as ServiceType}
            serviceDetail={values.serviceDetail.trim() || null}
            date={slot.date}
            start={slot.start}
            end={slot.end}
          />

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-brand-700"
            />
            <span>
              ข้าพเจ้ารับทราบและยินยอมให้ร้าน Social Eyewear เก็บและใช้ชื่อ เบอร์โทรศัพท์ และข้อมูลบัญชี LINE (ถ้ามี)
              เพื่อการนัดหมายและติดต่อเกี่ยวกับบริการ ตาม{" "}
              <Link href="/privacy" target="_blank" className="font-semibold text-brand-700 underline">
                นโยบายความเป็นส่วนตัว
              </Link>
            </span>
          </label>

          {submitError && (
            <div className="mt-4 space-y-2">
              <Alert kind="error">
                {errorMessage(submitError.code)}
                {submitError.uncertain && (
                  <span className="mt-1 block text-xs">หากไม่แน่ใจว่าจองสำเร็จหรือไม่ กด &quot;ลองอีกครั้ง&quot; ได้อย่างปลอดภัย ระบบจะไม่จองซ้ำ</span>
                )}
              </Alert>
              {submitError.code === "LINE_TOKEN_INVALID" && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={relogin}>เข้าสู่ระบบ LINE อีกครั้ง</Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setUseLine(false);
                      setSubmitError(null);
                    }}
                  >
                    จองต่อโดยไม่เชื่อมบัญชี LINE
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="secondary"
              size="lg"
              disabled={submitting}
              onClick={() => {
                if (submitError?.uncertain || restoredPending) {
                  if (!window.confirm("คำขอก่อนหน้ายังไม่ทราบผล หากย้อนกลับไปแก้ไข ระบบอาจมีรายการเดิมอยู่แล้ว ต้องการเริ่มใหม่หรือไม่?")) return;
                  ss.del(PENDING_KEY);
                  setRestoredPending(false);
                }
                setSubmitError(null);
                setStep("form");
              }}
            >
              ย้อนกลับ
            </Button>
            <Button size="lg" loading={submitting} disabled={!consent} onClick={submit}>
              {submitting ? "กำลังจอง..." : submitError?.uncertain ? "ลองอีกครั้ง" : "ยืนยันการจอง"}
            </Button>
          </div>
        </div>
      )}

      {step === "success" && result && (
        <div className="card p-5 sm:p-8">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl text-brand-700" aria-hidden>
              ✓
            </div>
            <h2 className="text-2xl font-bold text-brand-800">จองคิวสำเร็จ!</h2>
            <p className="mt-1 text-sm text-neutral-500">กรุณาบันทึกภาพหน้าจอนี้ไว้ และมาถึงร้านก่อนเวลานัดเล็กน้อย</p>
          </div>
          <BookingSummary
            bookingCode={result.bookingCode}
            username={result.username}
            phone={result.phone}
            serviceType={result.serviceType}
            serviceDetail={result.serviceDetail}
            date={result.date}
            start={result.start}
            end={result.end}
          />
          {settings.shop_phone ? (
            <p className="mt-4 text-center text-sm text-neutral-600">
              ต้องการเปลี่ยนหรือยกเลิกนัด กรุณาติดต่อร้าน{" "}
              <a href={`tel:${settings.shop_phone}`} className="font-semibold text-brand-700">{settings.shop_phone}</a>
            </p>
          ) : (
            <p className="mt-4 text-center text-sm text-neutral-600">ต้องการเปลี่ยนหรือยกเลิกนัด กรุณาติดต่อร้านผ่าน LINE OA</p>
          )}
          <Button size="lg" className="mt-6 w-full" onClick={() => resetAll()}>กลับหน้าหลัก</Button>
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-neutral-400">
        <Link href="/privacy" className="underline">นโยบายความเป็นส่วนตัว</Link> · © Social Eyewear
      </footer>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "pick", label: "เลือกวันและเวลา" },
    { id: "form", label: "กรอกข้อมูล" },
    { id: "confirm", label: "ยืนยัน" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="mb-5 flex items-center gap-2 text-xs font-medium" aria-label="ขั้นตอนการจอง">
      {steps.map((s, i) => (
        <li key={s.id} className="flex flex-1 items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
              i <= idx ? "bg-brand-700 text-white" : "bg-neutral-200 text-neutral-500"
            }`}
            aria-current={i === idx ? "step" : undefined}
          >
            {i + 1}
          </span>
          <span className={`truncate ${i <= idx ? "text-neutral-900" : "text-neutral-400"}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

function SelectedSlotBar({ slot, onChange }: { slot: SlotAvailability; onChange: () => void }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3">
      <div className="text-sm">
        <p className="font-semibold text-brand-800">{formatThaiDate(slot.date)}</p>
        <p className="tabular-nums text-brand-700">เวลา {slot.start}–{slot.end} น.</p>
      </div>
      <button type="button" onClick={onChange} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100">
        เปลี่ยน
      </button>
    </div>
  );
}
