import { Badge } from "@/ui";
import { statusLabel, statusTone } from "../statuses";
import type { BookingRow } from "../types";

export function BookingStatusBadge({ booking }: { booking: Pick<BookingRow, "status" | "mission_status" | "refund_amount"> }) {
  return <Badge tone={statusTone(booking)}>{statusLabel(booking)}</Badge>;
}
