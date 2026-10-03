import { AppError } from "@/lib/app-error";

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Point unique de téléchargement des exports comptables (D-05). */
export async function downloadExport(kind: "fec" | "csv", params: Record<string, string>): Promise<void> {
  // ponytail: cookie de session même origine ; jeton Bearer quand l'export deviendra une fonction serveur (phase 17, D-05)
  const res = await fetch(`/api/tenant/export-${kind}?${new URLSearchParams(params)}`, { credentials: "same-origin" });
  if (!res.ok) throw new AppError("L'export a échoué. Réessayez dans un instant.");
  const name = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `export.${kind === "fec" ? "txt" : "csv"}`;
  saveBlob(await res.blob(), name);
}
