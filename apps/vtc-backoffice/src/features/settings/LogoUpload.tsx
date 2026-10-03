import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon } from "lucide-react";
import { useOnline } from "@/app/useOnline";
import { Button, useToast } from "@/ui";
import { useUploadLogo } from "./api";
import { normalizeLogo } from "./logo";

const MAX_BYTES = 2 * 1024 * 1024;

/** Le logo n'est affiché que par `<img src>` : jamais de SVG injecté dans le DOM (T-16-39). */
export function LogoUpload({ tenantId, logoUrl, name }: { tenantId: string; logoUrl: string | null; name: string }) {
  const { canWrite } = useOnline();
  const toast = useToast();
  const upload = useUploadLogo(tenantId);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.show({ message: "Le fichier est trop volumineux (2 Mo maximum).", tone: "error" });
      e.target.value = "";
      return;
    }
    try {
      setFile(await normalizeLogo(f));
    } catch {
      toast.show({ message: "Image illisible : choisissez un PNG, un JPG ou un SVG.", tone: "error" });
      e.target.value = "";
    }
  };

  const save = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync(file);
      toast.show({ message: "Logo mis à jour." });
      setFile(null);
      if (input.current) input.current.value = "";
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "Erreur lors du téléversement du logo.", tone: "error" });
    }
  };

  const shown = preview ?? logoUrl;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
        {shown ? <img data-testid="logo-img" src={shown} alt={`Logo ${name}`} className="size-full object-contain p-2" /> : <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" />}
      </div>
      <div className="min-w-0 space-y-2">
        <p className="truncate text-xl font-bold">{name}</p>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" aria-label="Choisir un logo" className="sr-only" onChange={pick} />
          <Button variant="secondary" disabled={!canWrite} onClick={() => input.current?.click()}>
            Changer le logo
          </Button>
          {file ? (
            <Button loading={upload.isPending} disabled={!canWrite} onClick={save}>
              Enregistrer le logo
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">PNG transparent ou SVG recommandé. 2 Mo maximum.</p>
        {file?.type === "image/jpeg" ? <p className="text-xs text-muted-foreground">Ce format (JPEG) a toujours un fond plein ; un PNG ou SVG transparent s'affiche mieux.</p> : null}
      </div>
    </div>
  );
}
