import type { ReactNode } from "react";

export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode };

/** Tableau à partir de md, liste de cartes en dessous. Ligne cliquable = bouton accessible. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  mobileCard,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  mobileCard: (row: T) => ReactNode;
}) {
  return (
    <>
      <ul className="space-y-(--gap-grid) md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)}>
            {onRowClick ? (
              <button
                type="button"
                onClick={() => onRowClick(r)}
                className="block min-h-11 w-full rounded-(--radius-card) border border-border bg-card p-4 text-left text-card-foreground"
              >
                {mobileCard(r)}
              </button>
            ) : (
              <div className="rounded-(--radius-card) border border-border bg-card p-4 text-card-foreground">{mobileCard(r)}</div>
            )}
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className="border-b border-border px-3 py-2 font-bold">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b border-border">
              {columns.map((c, i) => (
                <td key={c.key} className="px-3 py-2">
                  {onRowClick && i === 0 ? (
                    <button type="button" onClick={() => onRowClick(r)} className="min-h-11 text-left font-bold text-foreground underline-offset-2 hover:underline">
                      {c.cell(r)}
                    </button>
                  ) : (
                    c.cell(r)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
