import type { HTMLAttributes } from "react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-(--radius-card) border border-border bg-card p-4 text-card-foreground ${className}`}
      {...rest}
    />
  );
}
