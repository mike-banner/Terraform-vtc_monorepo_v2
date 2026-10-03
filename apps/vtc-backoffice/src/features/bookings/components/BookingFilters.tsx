import { Field, Select } from "@/ui";
import type { BookingFilters as Filters } from "../types";

const STATUSES: { id: Filters["status"]; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "to_validate", label: "À valider" },
  { id: "not_started", label: "Non démarrées" },
  { id: "in_progress", label: "En cours" },
  { id: "completed", label: "Terminées" },
  { id: "cancelled", label: "Annulées" },
];
const TYPES: { id: Filters["type"]; label: string }[] = [
  { id: "all", label: "Tous les types" },
  { id: "transfer", label: "Transferts" },
  { id: "hourly", label: "Mises à dispo" },
];

export function BookingFilters({ filters, onChange }: { filters: Filters; onChange: (patch: Partial<Filters>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Statut">
        <Select value={filters.status} onChange={(e) => onChange({ status: e.target.value as Filters["status"] })}>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Type">
        <Select value={filters.type} onChange={(e) => onChange({ type: e.target.value as Filters["type"] })}>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
