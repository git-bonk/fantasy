import { Gem, TrendingDown } from "lucide-react";
import { OwnerLink } from "@/components/links/OwnerLink";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import type { TopMoveRow, TopMoves, WaiverLeaderRow } from "@/lib/queries";

interface WaiverImpactProps {
  moves: TopMoves;
  leaderboard: WaiverLeaderRow[];
}

export function WaiverImpact({ moves, leaderboard }: WaiverImpactProps) {
  if (moves.gems.length === 0 && moves.regrets.length === 0 && leaderboard.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
        No waiver moves graded yet this season.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MoveList
          title="Stolen gems"
          tone="gem"
          moves={moves.gems}
          empty="No standout pickups yet."
        />
        <MoveList
          title="Regret drops"
          tone="regret"
          moves={moves.regrets}
          empty="No painful drops yet."
        />
      </div>
      <WaiverLeaderboard rows={leaderboard} />
    </div>
  );
}

interface MoveListProps {
  title: string;
  tone: "gem" | "regret";
  moves: TopMoveRow[];
  empty: string;
}

function MoveList({ title, tone, moves, empty }: MoveListProps) {
  const isGem = tone === "gem";
  const Icon = isGem ? Gem : TrendingDown;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", isGem ? "text-emerald-400" : "text-rose-400")} />
        <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      </div>
      {moves.length === 0 ? (
        <p className="text-xs text-zinc-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {moves.map((m, i) => (
            <li
              key={`${m.team_id}-${m.player_name}-${m.week_num}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{m.player_name}</div>
                <TeamLink
                  teamId={m.team_id}
                  className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-emerald-400"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: m.color }}
                  />
                  <span className="truncate">{m.tname}</span>
                  <span className="shrink-0 text-zinc-500">· Week {m.week_num}</span>
                </TeamLink>
              </div>
              <span
                className={cn(
                  "shrink-0 font-mono text-sm font-bold tabular-nums",
                  isGem ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {m.points_after.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WaiverLeaderboard({ rows }: { rows: WaiverLeaderRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Owner impact
      </h4>
      <div className="mt-3 space-y-1.5">
        {rows.map((row, i) => (
          <div
            key={row.team_id}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-foreground/[0.03]"
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums",
                i === 0 ? "bg-amber-400/15 text-amber-400" : "bg-zinc-800 text-zinc-400"
              )}
            >
              {i + 1}
            </span>
            <OwnerLink
              aliasNum={row.owner_alias_num}
              className="flex min-w-0 flex-1 items-center gap-1.5"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate text-sm font-semibold transition-colors hover:text-emerald-400">
                {row.tname}
              </span>
            </OwnerLink>
            <span className="hidden shrink-0 font-mono text-xs tabular-nums text-emerald-400 sm:inline">
              {row.gems} GEM
            </span>
            <span className="hidden shrink-0 font-mono text-xs tabular-nums text-rose-400 sm:inline">
              {row.regrets} REGRET
            </span>
            <span
              className={cn(
                "w-16 shrink-0 text-right font-mono text-sm font-bold tabular-nums",
                row.net > 0 ? "text-emerald-400" : row.net < 0 ? "text-rose-400" : "text-zinc-400"
              )}
            >
              {row.net > 0 ? "+" : ""}
              {row.net.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
