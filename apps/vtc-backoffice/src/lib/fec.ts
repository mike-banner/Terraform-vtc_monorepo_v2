// src/lib/fec.ts
// Fichier des Écritures Comptables (art. A47 A-1 du LPF) du périmètre de l'application :
// le journal des ventes (VT) tiré de `financial_movements`, importable par le logiciel de
// l'expert-comptable. Ce n'est pas le FEC complet de l'entreprise (achats, banque hors
// Stripe, etc. vivent ailleurs).
//
// Écritures produites, une par mouvement, toujours équilibrées :
//   payment/credit      : D 512000 ou 530000 (TTC) / C 706000 (HT) / C 445710 (TVA)
//   refund/debit        : l'inverse
//   commission          : D 622600 / C 512000
//   commission_reversal : l'inverse
// Vente au comptant : pas de compte client 411, l'encaissement est simultané.
// HT = TTC - TVA, calculé en centimes : l'écriture est équilibrée par construction.
//
// Module pur (aucun import) : testé par supabase/functions/_shared/fec.test.ts en CI.

export interface FecMovement {
  created_at: string; // ISO
  movement_type: 'payment' | 'refund' | 'commission' | 'commission_reversal';
  direction: 'credit' | 'debit';
  gross_amount: number | string;
  vat_amount: number | string | null;
  payment_mode: string | null; // card | stripe | cash
  piece_ref: string; // n° de facture, à défaut référence de course
  label: string;
}

export const FEC_COLUMNS = [
  'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib',
  'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
  'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
] as const;

const ACCOUNTS = {
  bank: ['512000', 'Banque'],
  cash: ['530000', 'Caisse'],
  sales: ['706000', 'Prestations de services'],
  vat: ['445710', 'TVA collectée'],
  fees: ['622600', 'Commissions plateforme'],
} as const;

type Line = { account: readonly [string, string]; debit: number; credit: number };

const cents = (v: number | string | null): number => Math.round(Number(v ?? 0) * 100);

const fecDate = (iso: string): string => iso.slice(0, 10).replace(/-/g, '');

const fecAmount = (c: number): string => {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
};

// Tabulation = séparateur de champ : elle ne peut pas figurer dans une valeur.
const clean = (s: string): string => s.replace(/[\t\r\n|]+/g, ' ').trim();

/** Lignes d'écriture (en centimes) d'un mouvement. Vide si le mouvement est nul. */
export function entryLines(m: FecMovement): Line[] {
  const gross = cents(m.gross_amount);
  const vat = cents(m.vat_amount);
  if (gross === 0) return [];
  const treasury = m.payment_mode === 'cash' ? ACCOUNTS.cash : ACCOUNTS.bank;

  const sale: Line[] = [
    { account: treasury, debit: gross, credit: 0 },
    { account: ACCOUNTS.sales, debit: 0, credit: gross - vat },
    ...(vat !== 0 ? [{ account: ACCOUNTS.vat, debit: 0, credit: vat }] : []),
  ];
  const fee: Line[] = [
    { account: ACCOUNTS.fees, debit: gross, credit: 0 },
    { account: ACCOUNTS.bank, debit: 0, credit: gross },
  ];
  const reverse = (lines: Line[]): Line[] => lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));

  if (m.movement_type === 'payment') return m.direction === 'credit' ? sale : reverse(sale);
  if (m.movement_type === 'refund') return m.direction === 'debit' ? reverse(sale) : sale;
  if (m.movement_type === 'commission') return fee;
  return reverse(fee); // commission_reversal
}

/** Contenu texte du FEC (séparateur tabulation, fin de ligne CRLF), mouvements triés par date. */
export function buildFec(movements: FecMovement[]): string {
  const rows: string[] = [FEC_COLUMNS.join('\t')];
  const sorted = [...movements].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let num = 0;
  for (const m of sorted) {
    const lines = entryLines(m);
    if (lines.length === 0) continue;
    num += 1;
    const date = fecDate(m.created_at);
    for (const l of lines) {
      rows.push([
        'VT', 'Journal des ventes', `VT${String(num).padStart(6, '0')}`, date,
        l.account[0], l.account[1], '', '',
        clean(m.piece_ref), date, clean(m.label),
        fecAmount(l.debit), fecAmount(l.credit),
        '', '', date, '', '',
      ].join('\t'));
    }
  }
  return rows.join('\r\n') + '\r\n';
}

// ISO-8859-15 : identique à Latin-1 sauf 8 positions (€, Š, š, Ž, ž, Œ, œ, Ÿ).
const LATIN9: Record<string, number> = {
  '€': 0xa4, 'Š': 0xa6, 'š': 0xa8, 'Ž': 0xb4, 'ž': 0xb8, 'Œ': 0xbc, 'œ': 0xbd, 'Ÿ': 0xbe,
};
const LATIN9_FREED = new Set([0xa4, 0xa6, 0xa8, 0xb4, 0xb8, 0xbc, 0xbd, 0xbe]);

/** Encode en ISO-8859-15 (encodage admis par l'administration) ; caractère hors table -> '?'. */
export function toLatin9(text: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(text.length);
  let i = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    out[i++] = LATIN9[ch] ?? (code < 0x100 && !LATIN9_FREED.has(code) ? code : 0x3f);
  }
  return out.slice(0, i);
}

/** Nom légal : SIREN + "FEC" + date de clôture de l'exercice (AAAAMMJJ). */
export function fecFilename(siret: string, closingDate: Date): string {
  const siren = siret.replace(/\D/g, '').slice(0, 9);
  const y = closingDate.getFullYear();
  const m = String(closingDate.getMonth() + 1).padStart(2, '0');
  const d = String(closingDate.getDate()).padStart(2, '0');
  return `${siren}FEC${y}${m}${d}.txt`;
}
