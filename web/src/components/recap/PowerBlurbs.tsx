import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";

export interface PowerBlurbRow {
  teamId: number;
  name: string;
  color: string;
  rank: number;
  blurb: string;
}

interface PowerBlurbsProps {
  rows: PowerBlurbRow[];
}

export function PowerBlurbs({ rows }: PowerBlurbsProps) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div
          key={row.teamId}
          className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700"
        >
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold tabular-nums",
              row.rank === 1 ? "bg-amber-400/15 text-amber-400" : "bg-zinc-800 text-zinc-400"
            )}
          >
            {row.rank}
          </span>
          <div className="min-w-0 space-y-1">
            <TeamLink
              teamId={row.teamId}
              className="inline-flex items-center gap-2 font-display text-sm font-semibold transition-colors hover:text-emerald-400"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              {row.name}
            </TeamLink>
            <p className="text-sm leading-relaxed text-zinc-400">{row.blurb}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
