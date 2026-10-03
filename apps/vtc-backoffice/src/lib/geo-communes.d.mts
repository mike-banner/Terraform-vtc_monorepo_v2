export type AnalyseCommunes = { codes: string[]; commune: string | null; homonymes: string[]; proches: string[] };
export function analyserCommunes(
  nomZone: string,
  communes: { nom: string; codesPostaux?: string[]; departement?: { nom: string; code: string } }[],
): AnalyseCommunes;
export function choisirCodesCommune(
  nomZone: string,
  communes: { nom: string; codesPostaux?: string[] }[],
): string[];
export function analyserCodes(saisie: string): string[];
