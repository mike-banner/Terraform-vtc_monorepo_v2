import { useToast } from "@/ui";
import { useGenerateInvoice } from "../../mutations";
import type { BookingRow } from "../../types";
import { ActionButton } from "./ActionButton";

/** Facture à la demande, course terminée seulement ; le numéro FAC- est attribué par le serveur. */
export function InvoiceBlock({ booking }: { booking: BookingRow }) {
  const toast = useToast();
  const invoice = useGenerateInvoice();
  const run = () =>
    invoice.mutate(
      { bookingId: booking.id },
      {
        onSuccess: (r) => {
          if (r.invoice_url) window.open(r.invoice_url, "_blank", "noopener");
          else toast.show({ message: r.already_generated ? "Facture déjà générée" : "Facture générée." });
        },
      },
    );
  return (
    <section aria-label="Facture">
      <ActionButton variant="secondary" loading={invoice.isPending} onClick={run}>
        {booking.invoice_number ? "Facture PDF" : "Générer la facture"}
      </ActionButton>
    </section>
  );
}
