import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/** Titre de page, bouton Retour (44 px) et emplacement d'action principale (D-10). */
export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  const navigate = useNavigate();
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/app/dashboard"));
  return (
    <div className="mb-4 flex items-center gap-2 lg:mb-6">
      <button
        type="button"
        onClick={back}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted lg:hidden"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        <span className="sr-only">Retour</span>
      </button>
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
      {action}
    </div>
  );
}
