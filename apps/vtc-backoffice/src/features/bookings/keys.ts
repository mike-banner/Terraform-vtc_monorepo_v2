import { BOOKINGS_KEYS } from "@/app/realtime";

export const bookingKeys = {
  all: BOOKINGS_KEYS.all,
  list: (f: { status: string; type: string; page: number }) => [...BOOKINGS_KEYS.lists, f] as const,
  search: (q: string) => [...BOOKINGS_KEYS.all, "search", q] as const,
  detail: BOOKINGS_KEYS.detail,
};
