// Tests du FEC (apps/vtc-backoffice/src/lib/fec.ts), joués en CI avec les règles _shared.
import { assertEquals } from "jsr:@std/assert@1";
import {
  buildFec,
  entryLines,
  FEC_COLUMNS,
  fecFilename,
  type FecMovement,
  toLatin9,
} from "../../../apps/vtc-backoffice/src/lib/fec.ts";

const base: FecMovement = {
  created_at: "2026-03-15T10:00:00Z",
  movement_type: "payment",
  direction: "credit",
  gross_amount: "110.00",
  vat_amount: "10.00",
  payment_mode: "card",
  piece_ref: "FAC-2026-0001",
  label: "Course Lyon",
};

const balance = (m: FecMovement) =>
  entryLines(m).reduce((acc, l) => acc + l.debit - l.credit, 0);

Deno.test("encaissement carte : banque TTC / ventes HT / TVA, équilibré", () => {
  const lines = entryLines(base);
  assertEquals(lines.map((l) => [l.account[0], l.debit, l.credit]), [
    ["512000", 11000, 0],
    ["706000", 0, 10000],
    ["445710", 0, 1000],
  ]);
  assertEquals(balance(base), 0);
});

Deno.test("espèces en franchise de TVA : caisse, pas de ligne TVA", () => {
  const m = { ...base, payment_mode: "cash", vat_amount: "0", gross_amount: 40 };
  assertEquals(entryLines(m).map((l) => l.account[0]), ["530000", "706000"]);
  assertEquals(balance(m), 0);
});

Deno.test("remboursement : écriture inverse de l'encaissement", () => {
  const m: FecMovement = { ...base, movement_type: "refund", direction: "debit" };
  assertEquals(entryLines(m).map((l) => [l.account[0], l.debit, l.credit]), [
    ["512000", 0, 11000],
    ["706000", 10000, 0],
    ["445710", 1000, 0],
  ]);
  assertEquals(balance(m), 0);
});

Deno.test("commission et annulation de commission équilibrées", () => {
  const c: FecMovement = { ...base, movement_type: "commission", direction: "debit", vat_amount: null };
  assertEquals(entryLines(c).map((l) => l.account[0]), ["622600", "512000"]);
  assertEquals(balance(c), 0);
  const r: FecMovement = { ...c, movement_type: "commission_reversal", direction: "credit" };
  assertEquals(entryLines(r)[0].credit, 11000);
  assertEquals(balance(r), 0);
});

Deno.test("mouvement nul ignoré, numérotation continue et chronologique", () => {
  const fec = buildFec([
    { ...base, created_at: "2026-03-20T00:00:00Z", piece_ref: "B" },
    { ...base, gross_amount: 0, piece_ref: "ZERO" },
    { ...base, created_at: "2026-03-01T00:00:00Z", piece_ref: "A" },
  ]);
  // Pas de trimEnd : il retirerait les tabulations des colonnes vides de la dernière ligne.
  const rows = fec.slice(0, -2).split("\r\n").map((r) => r.split("\t"));
  assertEquals(rows[0], [...FEC_COLUMNS]);
  assertEquals(rows.every((r) => r.length === 18), true);
  assertEquals(rows.slice(1).map((r) => [r[2], r[8]]), [
    ["VT000001", "A"], ["VT000001", "A"], ["VT000001", "A"],
    ["VT000002", "B"], ["VT000002", "B"], ["VT000002", "B"],
  ]);
  assertEquals(rows[1][3], "20260301");
  assertEquals(rows[1][11], "110,00");
  assertEquals(rows[1][12], "0,00");
});

Deno.test("les tabulations et retours ligne des libellés ne cassent pas les colonnes", () => {
  const fec = buildFec([{ ...base, label: "Gare\tPart-Dieu\nquai 2" }]);
  const row = fec.split("\r\n")[1].split("\t");
  assertEquals(row.length, 18);
  assertEquals(row[10], "Gare Part-Dieu quai 2");
});

Deno.test("encodage ISO-8859-15 et nom de fichier légal", () => {
  assertEquals([...toLatin9("é€Œ")], [0xe9, 0xa4, 0xbc]);
  assertEquals([...toLatin9("✓")], [0x3f]);
  assertEquals(fecFilename("123 456 789 00012", new Date(2026, 11, 31)), "123456789FEC20261231.txt");
});
