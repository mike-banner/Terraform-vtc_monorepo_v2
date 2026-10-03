export const LOGO_MAX_SIDE = 512;

/** Dimensions de sortie : plus grand côté ramené à `max`, proportions conservées. Un raster n'est jamais agrandi, un vectoriel (SVG) l'est. */
export function fitSize(width: number, height: number, max = LOGO_MAX_SIDE, upscale = false) {
  const scale = max / Math.max(width, height);
  const k = upscale ? scale : Math.min(1, scale);
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

function load(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => (URL.revokeObjectURL(url), resolve(img));
    img.onerror = () => (URL.revokeObjectURL(url), reject(new Error("Image illisible.")));
    img.src = url;
  });
}

/** Tout logo entrant devient un PNG transparent de 512 px maximum. Le SVG est rastérisé : aucun script ne survit. */
export async function normalizeLogo(file: File): Promise<File> {
  const img = await load(file);
  const svg = file.type === "image/svg+xml";
  // Un SVG sans dimensions intrinsèques donne 0 : on le traite comme un carré.
  const { width, height } = fitSize(img.naturalWidth || LOGO_MAX_SIDE, img.naturalHeight || LOGO_MAX_SIDE, LOGO_MAX_SIDE, svg);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Image illisible.");
  return new File([blob], "logo.png", { type: "image/png" });
}
