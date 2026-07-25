export function fmtPts(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toFixed(2);
}

export function fmtRecord(w: number, l: number, t: number): string {
  if (t > 0) return `${w}-${l}-${t}`;
  return `${w}-${l}`;
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n * 100)}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
