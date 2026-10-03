import { useEffect, useRef } from "react";
import type { PrerequisiteStatus } from "./prerequisites";

/** Liste des éléments à renseigner ; le premier restant reçoit le focus et une mise en avant animée (motion-safe uniquement). */
export function SetupChecklist({ items, onSelect }: { items: PrerequisiteStatus[]; onSelect: (id: PrerequisiteStatus["id"]) => void }) {
  const firstTodo = items.find((i) => !i.done)?.id;
  const focused = useRef(false);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (firstTodo && !focused.current) {
      focused.current = true;
      ref.current?.focus();
    }
  }, [firstTodo]);
  return (
    <ul aria-label="Éléments à renseigner" className="space-y-2">
      {items.map((i) => {
        const highlight = i.id === firstTodo;
        return (
          <li key={i.id}>
            <button
              type="button"
              ref={highlight ? ref : undefined}
              data-prerequisite={i.id}
              data-done={i.done}
              onClick={() => onSelect(i.id)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm ${
                highlight ? "border-primary ring-2 ring-primary motion-safe:animate-pulse" : "border-border"
              } ${i.done ? "text-success-foreground" : "text-foreground"}`}
            >
              <span aria-hidden="true" className="font-bold">{i.done ? "✓" : "•"}</span>
              <span className="flex-1">{i.label}</span>
              <span className="text-xs text-muted-foreground">{i.done ? "Fait" : i.blocking ? "À faire" : "Recommandé"}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
