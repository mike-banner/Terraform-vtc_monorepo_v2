import { useState } from "react";
import { Field, Textarea } from "@/ui";
import { useUpdateInstructions } from "../../mutations";
import { splitMissionNote } from "../../statuses";
import { ActionButton } from "./ActionButton";

/** Instructions du client en tête de fiche (modifiables avant la mission), puis l'historique (journal de mission_note). */
export function InstructionsBlock({
  bookingId, instructions, missionNote, editable = false,
}: { bookingId: string; instructions: string | null; missionNote: string | null; editable?: boolean }) {
  const history = splitMissionNote(missionNote ?? "");
  const [text, setText] = useState<string | null>(null);
  const save = useUpdateInstructions();
  return (
    <section aria-labelledby="bk-instructions" className="space-y-2">
      <h3 id="bk-instructions" className="text-sm font-bold text-muted-foreground">
        Instructions
      </h3>
      {text === null ? (
        <>
          <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">{instructions || "Aucune instruction"}</p>
          {editable ? (
            <ActionButton variant="secondary" onClick={() => setText(instructions ?? "")}>
              Modifier les instructions
            </ActionButton>
          ) : null}
        </>
      ) : (
        <div className="space-y-2">
          <Field label="Instructions">
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <ActionButton loading={save.isPending} onClick={() => save.mutate({ bookingId, text }, { onSuccess: () => setText(null) })}>
              Enregistrer
            </ActionButton>
            <ActionButton variant="secondary" onClick={() => setText(null)}>
              Annuler
            </ActionButton>
          </div>
        </div>
      )}
      {history.length ? (
        <>
          <h3 className="text-sm font-bold text-muted-foreground">Historique</h3>
          <ul className="space-y-1 text-sm">
            {history.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
