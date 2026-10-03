import type { ReactNode } from "react";

export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode };

/** Tableau à partir de md, liste de cartes en dessous. Ligne cliquable = bouton accessible. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  mobileCard,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  mobileCard: (row: T) => ReactNode;
  /** Classe de bordure de la ligne (ex. `border-destructive`) ; `border-border` par défaut. */
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <>
      <ul className="space-y-(--gap-grid) md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} data-row={rowKey(r)}>
            {onRowClick ? (
              <button
                type="button"
                onClick={() => onRowClick(r)}
                className={`block min-h-11 w-full rounded-(--radius-card) border bg-card p-4 text-left text-card-foreground ${rowClassName?.(r) ?? "border-border"}`}
              >
                {mobileCard(r)}
              </button>
            ) : (
              <div className={`rounded-(--radius-card) border bg-card p-4 text-card-foreground ${rowClassName?.(r) ?? "border-border"}`}>{mobileCard(r)}</div>
            )}
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className="border-b border-border px-3 py-2 font-bold lg:px-4 lg:py-3">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} data-row={rowKey(r)} className={`border-b ${rowClassName?.(r) ?? "border-border"}`}>
              {columns.map((c, i) => (
                <td key={c.key} className="px-3 py-2 lg:px-4 lg:py-3">
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
