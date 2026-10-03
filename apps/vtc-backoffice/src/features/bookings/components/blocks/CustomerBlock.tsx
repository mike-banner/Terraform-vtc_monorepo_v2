import { Phone } from "lucide-react";
import { customerName } from "../../format";
import type { BookingRow } from "../../types";

export function CustomerBlock({ customer }: { customer: BookingRow["customers"] }) {
  const phone = customer?.phone?.trim();
  return (
    <section aria-labelledby="bk-customer" className="space-y-1">
      <h3 id="bk-customer" className="text-sm font-bold text-muted-foreground">
        Client
      </h3>
      <p className="font-bold">{customerName(customer)}</p>
      {phone ? (
        <a href={`tel:${phone.replace(/\s+/g, "")}`} className="inline-flex min-h-11 items-center gap-2 font-bold text-primary underline-offset-2 hover:underline">
          <Phone aria-hidden="true" className="size-4" />
          {phone}
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">Téléphone non renseigné</p>
      )}
    </section>
  );
}
