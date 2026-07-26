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

const OWNER_PALETTE = ["#10b981", "#fbbf24", "#38bdf8", "#a855f7", "#f43f5e", "#14b8a6", "#f97316"];

export function ownerColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return OWNER_PALETTE[Math.abs(hash) % OWNER_PALETTE.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
