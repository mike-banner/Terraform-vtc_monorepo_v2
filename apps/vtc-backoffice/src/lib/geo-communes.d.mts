export function choisirCodesCommune(
  nomZone: string,
  communes: { nom: string; codesPostaux?: string[] }[],
): string[];
export function analyserCodes(saisie: string): string[];
