import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getBrand, NEUTRAL_BRAND } from "./email-templates/brand.ts";
import { bookingConfirmationEmail } from "./email-templates/site/booking-confirmation.ts";
import { bookingCancelledEmail } from "./email-templates/site/booking-cancelled.ts";
import { refundConfirmationEmail } from "./email-templates/native/refund-confirmation.ts";
import { paymentWithoutBookingEmail } from "./email-templates/native/payment-without-booking.ts";
import { creditNoteEmail } from "./email-templates/native/credit-note.ts";
import { paymentReceivedCustomerEmail } from "./email-templates/native/payment-received-customer.ts";

const brand = getBrand({ name: "Elite <Lyon>", logo_url: "https://x.test/l.png", primary_color: "#112233", email: "a@b.fr", phone: "0400" });

Deno.test("marque : valeurs valides reprises, invalides ignorées", () => {
  assertEquals(brand.accent, "#112233");
  assertEquals(brand.logoUrl, "https://x.test/l.png");
  const bad = getBrand({ name: "X", logo_url: "javascript:alert(1)", primary_color: "red;background:url(x)" });
  assertEquals(bad.logoUrl, null);
  assertEquals(bad.accent, NEUTRAL_BRAND.accent);
  assertEquals(getBrand(null), NEUTRAL_BRAND);
});

Deno.test("les données dynamiques sont échappées", () => {
  const html = bookingConfirmationEmail({
    brand, firstName: "<script>x</script>", reference: "AB12", pickupAddress: "<img onerror=1>", total: 80,
  });
  assert(!html.includes("<script>x"));
  assert(!html.includes("<img onerror"));
  assertStringIncludes(html, "Elite &lt;Lyon&gt;");
  assertStringIncludes(html, "#112233");
});

Deno.test("chaque modèle se rend avec les données minimales", () => {
  const out = [
    bookingConfirmationEmail({ brand, reference: "R", total: 10 }),
    bookingCancelledEmail({ brand, reference: "R" }),
    refundConfirmationEmail({ brand, reference: "R", refundAmount: 5 }),
    paymentWithoutBookingEmail({ amount: 80, customerName: "N", stripeUrl: "https://dashboard.stripe.com/x", reason: "r" }),
    paymentReceivedCustomerEmail({ brand, amount: 80 }),
    creditNoteEmail({ brand, number: "AV-2026-0001", invoiceNumber: "FAC-2026-0001", amount: 30, url: "https://x.test/a.pdf" }),
  ];
  for (const html of out) assertStringIncludes(html, "</html>");
  assertStringIncludes(out[3], "dashboard.stripe.com");
});
