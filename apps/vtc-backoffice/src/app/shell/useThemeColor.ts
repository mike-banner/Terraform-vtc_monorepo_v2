import { useEffect } from "react";

/** theme-color lu dans les tokens au chargement (D-12) : aucune valeur en dur. */
export function useThemeColor(): void {
  useEffect(() => {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
    if (!value) return;
    let meta = document.getElementsByName("theme-color")[0] as HTMLMetaElement | undefined;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = value;
  }, []);
}
