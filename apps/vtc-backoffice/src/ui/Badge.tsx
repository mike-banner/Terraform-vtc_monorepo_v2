import type { HTMLAttributes } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success-foreground",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-destructive/15 text-destructive",
  info: "bg-info-soft text-info-foreground",
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${tones[tone]} ${className}`}
      {...rest}
    />
  );
}
