export type BookingEvent = { id: string; status: string; mission_status: string; driver_id: string | null; updated_at: string };
export function toMicros(value: unknown): number | null;
export function shouldApply(cachedUpdatedAt: string | null | undefined, eventUpdatedAt: string): boolean;
export function isBookingEvent(payload: unknown): payload is BookingEvent;
