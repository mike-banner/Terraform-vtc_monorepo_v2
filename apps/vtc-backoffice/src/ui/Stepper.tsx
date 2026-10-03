export type Step = { id: string; label: string; done: boolean };

export function Stepper({ steps, current }: { steps: Step[]; current: string }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Étapes">
      {steps.map((s, i) => {
        const active = s.id === current;
        return (
          <li
            key={s.id}
            aria-current={active ? "step" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm motion-safe:transition-colors ${
              active ? "border-primary text-primary" : s.done ? "border-success text-success-foreground" : "border-border text-muted-foreground"
            }`}
          >
            <span className="font-bold">{s.done ? "✓" : i + 1}</span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
