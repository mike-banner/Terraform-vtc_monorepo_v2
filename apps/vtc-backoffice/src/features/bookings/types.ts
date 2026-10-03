import type { Database } from "@vtc/database";

type Booking = Database["public"]["Tables"]["bookings"]["Row"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];

/** Colonnes lues : toujours `id` et `updated_at` (règle d'ordre `shouldApply` de la phase 15). */
export const BOOKING_COLUMNS =
  "id, updated_at, created_at, status, mission_status, booking_type, booking_source, pickup_time, pickup_address, dropoff_address, " +
  "passenger_count, luggage_count, duration_hours, distance_km, vehicle_id, total_amount, refund_amount, address_alert, instructions, mission_note, " +
  "invoice_number, rating, rating_comment, driver_id, customer_id, customers(first_name, last_name, email, phone)";

export type BookingRow = Pick<
  Booking,
  | "id" | "updated_at" | "created_at" | "status" | "mission_status" | "booking_type" | "booking_source" | "pickup_time"
  | "pickup_address" | "dropoff_address" | "passenger_count" | "luggage_count" | "duration_hours" | "distance_km" | "vehicle_id" | "total_amount"
  | "refund_amount" | "address_alert" | "instructions" | "mission_note" | "invoice_number" | "rating" | "rating_comment"
  | "driver_id" | "customer_id"
> & { customers: Pick<Customer, "first_name" | "last_name" | "email" | "phone"> | null };

export type BookingFilters = {
  status: "all" | "to_validate" | "not_started" | "in_progress" | "completed" | "cancelled";
  type: "all" | "transfer" | "hourly";
  page: number;
};

export type Conflict = {
  booking_id: string;
  other_id: string;
  other_pickup_time: string;
  other_pickup_address: string;
  other_status: string;
};

export const PAGE_SIZE = 10;
