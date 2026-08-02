import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AliasTag } from "@/components/cards/AliasTag";
import { StreakBadge } from "@/components/cards/StreakBadge";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import { fmtPct, fmtPts, fmtRecord } from "@/lib/format";
import type { TeamStandingRow, TeamStreak } from "@/lib/types";

interface TeamCardProps {
  team: TeamStandingRow;
  streak?: TeamStreak;
  revealed: boolean;
  className?: string;
}

export function TeamCard({ team, streak, revealed, className }: TeamCardProps) {
  const inPlayoffs = team.playoff_seed !== null;

  return (
    <TeamLink teamId={team.id} className="block">
      <Card
        className={cn(
          "border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700",
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold"
              style={{ backgroundColor: `${team.color}1f`, color: team.color }}
            >
              {team.abbrev}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {revealed ? (
                  <p className="truncate font-display text-sm font-semibold">{team.name}</p>
                ) : (
                  <AliasTag label={team.name} />
                )}
                {streak && <StreakBadge streak={streak.streak} type={streak.type} />}
              </div>
              {revealed ? (
                <p className="truncate text-xs text-zinc-500">{team.owner_name}</p>
              ) : (
                <AliasTag label={team.owner_name} className="mt-0.5" />
              )}
            </div>
            {inPlayoffs ? (
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              >
                #{team.playoff_seed}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-zinc-700 text-zinc-500">
                OUT
              </Badge>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3">
            <div>
              <p className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                Record
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums">
                {fmtRecord(team.wins ?? 0, team.losses ?? 0, 0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                Pts For
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums">
                {fmtPts(team.points_for ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                Odds
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums">
                {fmtPct(team.playoff_odds)}
              </p>
            </div>
          </div>

          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((team.playoff_odds ?? 0) * 100)}%`,
                backgroundColor: team.color,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </TeamLink>
  );
}
