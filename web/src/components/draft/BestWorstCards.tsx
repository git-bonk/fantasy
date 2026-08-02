import { TrendingDown, TrendingUp } from "lucide-react";
import { TeamLink } from "@/components/links/TeamLink";
import { PositionBadge } from "@/components/players/PositionBadge";
import { fmtPts } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TeamBestWorst, TeamPickValue } from "@/lib/queries";

interface BestWorstCardsProps {
  teams: TeamBestWorst[];
}

function PickLine({ label, pick, tone }: { label: string; pick: TeamPickValue; tone: "best" | "worst" }) {
  const Icon = tone === "best" ? TrendingUp : TrendingDown;
  const toneCls = tone === "best" ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="flex items-center gap-2.5">
      <Icon className={cn("h-4 w-4 shrink-0", toneCls)} />
      <PositionBadge position={pick.position} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{pick.player_name}</p>
        <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
          {label} · R{pick.round_num}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-bold tabular-nums">{fmtPts(pick.produced)}</p>
        <p className={cn("font-mono text-[10px] tabular-nums", toneCls)}>
          {pick.value_over_round >= 0 ? "+" : ""}
          {fmtPts(pick.value_over_round)}
        </p>
      </div>
    </div>
  );
}

export function BestWorstCards({ teams }: BestWorstCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <div
          key={team.team_id}
          className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700"
        >
          <TeamLink
            teamId={team.team_id}
            className="flex items-center gap-2 transition-colors hover:text-emerald-400"
          >
            {team.color && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: team.color }}
              />
            )}
            <span className="truncate text-sm font-semibold">{team.tname}</span>
          </TeamLink>
          <PickLine label="Best" pick={team.best} tone="best" />
          <div className="h-px bg-border" />
          <PickLine label="Worst" pick={team.worst} tone="worst" />
        </div>
      ))}
    </div>
  );
}
