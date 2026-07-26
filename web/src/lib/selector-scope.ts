export interface SelectorScope {
  year: boolean;
  week: boolean;
}

export function scopeFor(pathname: string): SelectorScope {
  const seg = pathname.split("/").filter(Boolean);
  const root = seg[0] ?? "";

  if (root === "history") {
    return { year: false, week: false };
  }

  const weekIndependent =
    root === "rankings" ||
    root === "rivalry" ||
    root === "transactions" ||
    root === "trends" ||
    root === "records" ||
    (root === "teams" && seg.length > 1);

  return { year: true, week: !weekIndependent };
}
