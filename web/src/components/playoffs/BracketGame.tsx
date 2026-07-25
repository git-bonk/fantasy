import { cn } from "@/lib/utils";
import type { MatchupRow } from "@/lib/types";

interface BracketGameProps {
  game: MatchupRow;
  label?: string;
}

export function BracketGame({ game, label }: BracketGameProps) {
  const homeWon = game.winner_team_id === game.hid;
  const awayWon = game.winner_team_id === game.aid;

  return (
    <div className="w-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60">
      {label && (
        <div className="border-b border-zinc-800 bg-zinc-800/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </div>
      )}
      <TeamRow
        abbrev={game.habb}
        name={game.hname}
        color={game.hcolor}
        score={game.home_score}
        isWinner={homeWon}
        isTie={!homeWon && !awayWon}
      />
      <div className="h-px bg-zinc-800" />
      <TeamRow
        abbrev={game.aabb}
        name={game.aname}
        color={game.acolor}
        score={game.away_score}
        isWinner={awayWon}
        isTie={!homeWon && !awayWon}
      />
    </div>
  );
}

function TeamRow({
  abbrev,
  name,
  color,
  score,
  isWinner,
  isTie,
}: {
  abbrev: string;
  name: string;
  color: string;
  score: number;
  isWinner: boolean;
  isTie: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2",
        isWinner && "bg-emerald-500/5",
        !isWinner && !isTie && "opacity-50"
      )}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {abbrev}
      </span>
      <span
        className={cn(
          "flex-1 truncate text-xs",
          isWinner ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
        )}
      >
        {name}
      </span>
      <span
        className={cn(
          "font-mono text-sm font-bold tabular-nums",
          isWinner ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}
