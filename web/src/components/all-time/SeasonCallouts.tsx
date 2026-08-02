import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TeamLink } from "@/components/links/TeamLink";
import { fmtPct, fmtRecord } from "@/lib/format";
import { seasonWinPct, type OwnerCareerTeamRow } from "@/lib/queries";

interface CalloutCardProps {
  label: string;
  icon: LucideIcon;
  accent: string;
  season: OwnerCareerTeamRow;
}

function CalloutCard({ label, icon: Icon, accent, season }: CalloutCardProps) {
  return (
    <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
            {label}
          </p>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <p className="mt-2 font-display text-3xl font-bold tracking-tight tabular-nums">
          {season.year}
        </p>
        <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-zinc-300">
          {fmtRecord(season.wins, season.losses, season.ties)}
          <span className="ml-2 font-normal text-zinc-500">
            {fmtPct(seasonWinPct(season))}
          </span>
        </p>
        <TeamLink
          teamId={season.team_id}
          className="mt-1.5 flex min-w-0 items-center gap-2 text-xs font-medium text-zinc-400 transition-colors hover:text-emerald-400"
        >
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded font-display text-[8px] font-bold"
            style={{ backgroundColor: `${season.color}1f`, color: season.color }}
          >
            {season.abbrev}
          </span>
          <span className="truncate">{season.name}</span>
        </TeamLink>
      </CardContent>
    </Card>
  );
}

interface SeasonCalloutsProps {
  best: OwnerCareerTeamRow | null;
  worst: OwnerCareerTeamRow | null;
}

export function SeasonCallouts({ best, worst }: SeasonCalloutsProps) {
  if (!best) return null;
  const showWorst = worst != null && worst.team_id !== best.team_id;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <CalloutCard label="Peak Season" icon={TrendingUp} accent="#10b981" season={best} />
      {showWorst && (
        <CalloutCard label="Toughest Season" icon={TrendingDown} accent="#f43f5e" season={worst} />
      )}
    </div>
  );
}
