import { splitMissionNote } from "../../statuses";

/** Instructions du client en tête de fiche, puis l'historique de la course (journal de mission_note). */
export function InstructionsBlock({ instructions, missionNote }: { instructions: string | null; missionNote: string | null }) {
  const history = splitMissionNote(missionNote ?? "");
  return (
    <section aria-labelledby="bk-instructions" className="space-y-2">
      <h3 id="bk-instructions" className="text-sm font-bold text-muted-foreground">
        Instructions
      </h3>
      <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 text-sm">{instructions || "Aucune instruction"}</p>
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
