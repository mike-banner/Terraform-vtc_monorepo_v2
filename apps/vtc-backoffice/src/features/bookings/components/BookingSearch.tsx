import { Field, Input } from "@/ui";

export function BookingSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Recherche" hint="Nom, prénom, téléphone ou référence de facture (2 caractères au moins)">
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Rechercher un client, un téléphone, une référence" />
    </Field>
  );
}
