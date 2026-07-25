import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtPts } from "@/lib/format";
import type { MatchupRow } from "@/lib/types";

interface TeamSideProps {
  name: string;
  abbrev: string;
  color: string;
  score: number;
  isWinner: boolean;
  isTie: boolean;
}

function TeamSide({ name, abbrev, color, score, isWinner, isTie }: TeamSideProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        isWinner ? "bg-foreground/[0.04]" : "opacity-70"
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-bold"
        style={{
          backgroundColor: `${color}1f`,
          color,
          boxShadow: isWinner ? `0 0 0 1px ${color}55` : undefined,
        }}
      >
        {abbrev}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            isWinner ? "text-foreground" : "text-zinc-400"
          )}
        >
          {name}
        </p>
        <p className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
          {isWinner ? "Winner" : isTie ? "Tie" : "\u00a0"}
        </p>
      </div>
      <span
        className={cn(
          "font-display text-2xl font-bold tabular-nums",
          isWinner ? "text-foreground" : "text-zinc-500"
        )}
      >
        {fmtPts(score)}
      </span>
    </div>
  );
}

interface MatchupCardProps {
  matchup: MatchupRow;
  className?: string;
}

export function MatchupCard({ matchup, className }: MatchupCardProps) {
  const m = matchup;
  const isTie = m.winner_team_id === null;
  const awayWins = !isTie && m.winner_team_id === m.aid;
  const homeWins = !isTie && m.winner_team_id === m.hid;

  return (
    <Card
      className={cn(
        "border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700",
        className
      )}
    >
      <CardContent className="space-y-1 p-2.5">
        <TeamSide
          name={m.aname}
          abbrev={m.aabb}
          color={m.acolor}
          score={m.away_score}
          isWinner={awayWins}
          isTie={isTie}
        />
        <TeamSide
          name={m.hname}
          abbrev={m.habb}
          color={m.hcolor}
          score={m.home_score}
          isWinner={homeWins}
          isTie={isTie}
        />
      </CardContent>
    </Card>
  );
}
