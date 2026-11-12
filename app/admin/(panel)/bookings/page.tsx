import { Suspense } from "react";
import { BookingsManager } from "@/components/admin/BookingsManager";
import { LoadingBlock } from "@/components/ui/Spinner";

export default function BookingsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <BookingsManager />
    </Suspense>
  );
}
