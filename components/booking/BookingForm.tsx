"use client";
import type { ServiceType } from "@/types";
import { SERVICE_TYPES } from "@/lib/booking/constants";
import type { FieldErrors } from "@/lib/validation/booking";
import type { LiffState } from "@/lib/line/useLiff";

export interface FormValues {
  username: string;
  phone: string;
  serviceType: ServiceType | "";
  serviceDetail: string;
  website: string; // honeypot
}

export function BookingForm({
  values,
  errors,
  liff,
  onChange,
}: {
  values: FormValues;
  errors: FieldErrors;
  liff: LiffState;
  onChange: (patch: Partial<FormValues>) => void;
}) {
  const fromLine = liff.status === "ready";
  return (
    <div className="space-y-5">
      {/* Username */}
      <div>
        <label htmlFor="username" className="label">ชื่อผู้จอง (Username)</label>
        {fromLine && (
          <p className="mb-2 flex items-center gap-2 text-xs text-brand-700">
            <span className="inline-flex h-5 items-center rounded-full bg-[#06C755] px-2 text-[11px] font-semibold text-white">LINE</span>
            ใช้ชื่อจากบัญชี LINE ของคุณ (แก้ไขได้)
          </p>
        )}
        {liff.status === "loading" && <p className="mb-2 text-xs text-neutral-500">กำลังดึงชื่อจาก LINE...</p>}
        <input
          id="username"
          name="username"
          className={`input ${errors.username ? "input-error" : ""}`}
          value={values.username}
          onChange={(e) => onChange({ username: e.target.value })}
          autoComplete="name"
          maxLength={100}
          placeholder="ชื่อ-นามสกุล หรือชื่อเล่น"
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? "username-err" : undefined}
        />
        {errors.username && <p id="username-err" className="field-error">{errors.username}</p>}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="label">เบอร์โทรศัพท์</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={`input tabular-nums ${errors.phone ? "input-error" : ""}`}
          value={values.phone}
          onChange={(e) => onChange({ phone: e.target.value.replace(/[^\d+\-\s()]/g, "") })}
          maxLength={20}
          placeholder="08X-XXX-XXXX"
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? "phone-err" : undefined}
        />
        {errors.phone && <p id="phone-err" className="field-error">{errors.phone}</p>}
      </div>

      {/* Service type */}
      <fieldset>
        <legend className="label">ประเภทบริการ</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SERVICE_TYPES.map((s) => {
            const checked = values.serviceType === s.value;
            return (
              <label
                key={s.value}
                className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition
                  ${checked ? "border-brand-700 bg-brand-50 font-semibold text-brand-800" : "border-neutral-300 hover:bg-neutral-50"}`}
              >
                <input
                  type="radio"
                  name="serviceType"
                  value={s.value}
                  checked={checked}
                  onChange={() => onChange({ serviceType: s.value })}
                  className="h-4 w-4 accent-brand-700"
                />
                {s.label}
              </label>
            );
          })}
        </div>
        {errors.serviceType && <p className="field-error">{errors.serviceType}</p>}
      </fieldset>

      {/* Detail */}
      <div>
        <label htmlFor="detail" className="label">
          รายละเอียดเพิ่มเติม {values.serviceType === "other" ? <span className="text-red-600">*</span> : <span className="font-normal text-neutral-400">(ไม่บังคับ)</span>}
        </label>
        <textarea
          id="detail"
          name="serviceDetail"
          rows={3}
          maxLength={500}
          className={`input resize-none ${errors.serviceDetail ? "input-error" : ""}`}
          value={values.serviceDetail}
          onChange={(e) => onChange({ serviceDetail: e.target.value })}
          placeholder={values.serviceType === "other" ? "โปรดระบุบริการที่ต้องการ" : "เช่น เคยตัดแว่นที่ร้าน / ต้องการเลนส์กรองแสง"}
          aria-invalid={!!errors.serviceDetail}
        />
        <div className="mt-1 flex justify-between">
          {errors.serviceDetail ? <p className="field-error mt-0">{errors.serviceDetail}</p> : <span />}
          <span className="text-xs text-neutral-400">{values.serviceDetail.length}/500</span>
        </div>
      </div>

      {/* Honeypot (hidden from humans and screen readers) */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => onChange({ website: e.target.value })} />
        </label>
      </div>
    </div>
  );
}
