// Mentions légales d'une facture ou d'un avoir : module pur, sans réseau, testé par invoice-mentions.test.ts.
// Les libellés sont soumis à la relecture de l'expert-comptable du client (D-24).

export interface TenantLegal {
  name: string;
  legal_form?: string | null;
  siret?: string | null;
  siren?: string | null;
  rcs_number?: string | null;
  capital_social?: number | null;
  vat_number?: string | null;
  vat_rate?: number | null;
  is_vat_exempt?: boolean | null;
  address_line?: string | null;
  postal_code?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface CustomerLegal {
  first_name?: string | null;
  last_name?: string | null;
  type?: string | null; // 'individual' | 'company'
  company_name?: string | null;
  vat_number?: string | null;
  billing_address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface DocInfo {
  kind: "invoice" | "credit_note";
  number: string;
  issuedAt: string;
  serviceDate: string;
  originalInvoiceNumber?: string;
  paidAt?: string | null;
  paymentMethod?: "card" | "cash" | null;
}

// Les espaces insécables de Intl ne sont pas encodables par les polices PDF standard.
const plain = (s: string) => s.replace(/[  ]/g, " ");

export function formatParisDate(d: Date | string, withTime = false): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(d));
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const date = `${p("day")}/${p("month")}/${p("year")}`;
  return withTime ? `${date} à ${p("hour")}:${p("minute")}` : date;
}

const isEI = (f?: string | null) => ["auto_entrepreneur", "ei"].includes((f ?? "").toLowerCase());

export function legalLines(tenant: TenantLegal, customer: CustomerLegal, doc: DocInfo) {
  if (doc.kind === "credit_note" && !doc.originalInvoiceNumber) {
    throw new Error("Un avoir doit référer la facture d'origine");
  }

  const form = (tenant.legal_form ?? "").toLowerCase();
  const seller: string[] = [`${tenant.name}${isEI(form) ? " EI" : ""}`];
  if (tenant.address_line) seller.push(tenant.address_line);
  const cityLine = [tenant.postal_code, tenant.city].filter(Boolean).join(" ");
  if (cityLine) seller.push(cityLine);
  if (tenant.siret) seller.push(`SIRET : ${tenant.siret}`);
  else if (tenant.siren) seller.push(`SIREN : ${tenant.siren}`);
  if (!isEI(form) && form && form !== "other") {
    const capital = tenant.capital_social
      ? ` au capital de ${plain(Number(tenant.capital_social).toLocaleString("fr-FR"))} €`
      : "";
    seller.push(`${form.toUpperCase()}${capital}`);
  }
  if (tenant.rcs_number) seller.push(`RCS : ${tenant.rcs_number}`);
  if (tenant.vat_number) seller.push(`N° TVA : ${tenant.vat_number}`);
  for (const c of [tenant.email, tenant.phone]) if (c) seller.push(c);

  const company = customer.type === "company";
  const personal = [customer.first_name, customer.last_name].filter(Boolean).join(" ");
  const buyer: string[] = [];
  if (company && customer.company_name) buyer.push(customer.company_name);
  if (personal || buyer.length === 0) buyer.push(personal || "Client");
  if (customer.billing_address) {
    buyer.push(customer.billing_address);
    const cl = [customer.postal_code, customer.city].filter(Boolean).join(" ");
    if (cl) buyer.push(cl);
    if (customer.country) buyer.push(customer.country);
  }
  if (company && customer.vat_number) buyer.push(`N° TVA client : ${customer.vat_number}`);

  const credit = doc.kind === "credit_note";
  const header = [
    credit ? "AVOIR" : "FACTURE",
    `N° ${doc.number}`,
    ...(credit ? [`Avoir sur la facture ${doc.originalInvoiceNumber}`] : []),
    `Date d'émission : ${formatParisDate(doc.issuedAt)}`,
    `Date de la prestation : ${formatParisDate(doc.serviceDate)}`,
    "Prestation de services",
  ];

  const footer: string[] = [
    tenant.is_vat_exempt === true
      ? "TVA non applicable, art. 293 B du CGI"
      : `TVA au taux de ${Number(tenant.vat_rate ?? 0)} %`,
  ];
  if (!credit && doc.paidAt) {
    footer.push(`Payée le ${formatParisDate(doc.paidAt)} par ${doc.paymentMethod === "cash" ? "espèces" : "carte"}`);
  }
  if (!credit && company) {
    footer.push(
      "Pénalités de retard : taux de refinancement de la BCE majoré de 10 points",
      "Indemnité forfaitaire pour frais de recouvrement : 40 €",
      "Escompte pour paiement anticipé : néant",
    );
  }
  return { seller, buyer, header, footer };
}
