import type { BookingStatus } from "@/types";
import { STATUS_LABEL } from "@/lib/booking/constants";

const CLS: Record<BookingStatus, string> = {
  confirmed: "bg-brand-50 text-brand-700 ring-brand-200",
  completed: "bg-sky-50 text-sky-700 ring-sky-200",
  cancelled: "bg-neutral-100 text-neutral-500 ring-neutral-200",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${CLS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
