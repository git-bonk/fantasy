import { Crown, Medal, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AWARD_META } from "@/components/cards/AwardBadge";
import { TeamLink } from "@/components/links/TeamLink";
import type { OwnerTrophies, TrophySeasonRow } from "@/lib/queries";

interface ChampionshipBannerProps {
  season: TrophySeasonRow;
}

function ChampionshipBanner({ season }: ChampionshipBannerProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-amber-400/25 bg-zinc-950 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/40">
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-amber-400 uppercase">
            League Champion
          </p>
          <p className="mt-1 font-display text-4xl font-bold tracking-tight tabular-nums">
            {season.year}
          </p>
          <TeamLink
            teamId={season.team_id}
            className="mt-2 inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-emerald-400"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-display text-[9px] font-bold"
              style={{ backgroundColor: `${season.color}1f`, color: season.color }}
            >
              {season.abbrev}
            </span>
            <span className="truncate">{season.name}</span>
          </TeamLink>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
          <Trophy className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

interface RunnerUpBannerProps {
  season: TrophySeasonRow;
}

function RunnerUpBanner({ season }: RunnerUpBannerProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-950 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-600">
      <div className="pointer-events-none absolute -top-14 -right-14 h-40 w-40 rounded-full bg-zinc-400/10 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-400/10 text-zinc-300">
          <Medal className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
            Runner-Up · {season.year}
          </p>
          <TeamLink
            teamId={season.team_id}
            className="mt-0.5 flex min-w-0 items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-emerald-400"
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded font-display text-[8px] font-bold"
              style={{ backgroundColor: `${season.color}1f`, color: season.color }}
            >
              {season.abbrev}
            </span>
            <span className="truncate">{season.name}</span>
          </TeamLink>
        </div>
      </div>
    </div>
  );
}

interface TrophyCaseProps {
  trophies: OwnerTrophies;
}

export function TrophyCase({ trophies }: TrophyCaseProps) {
  const { championships, runnerUps, awards } = trophies;
  const empty = championships.length === 0 && runnerUps.length === 0 && awards.length === 0;

  return (
    <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
      <CardHeader className="border-b border-zinc-800 pb-3">
        <CardTitle className="flex items-center gap-2 font-display">
          <Trophy className="h-4 w-4 text-amber-400" />
          Trophy Case
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {empty ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Crown className="h-8 w-8 text-zinc-700" />
            <div>
              <p className="text-sm font-semibold text-zinc-400">No trophies yet</p>
              <p className="mt-1 max-w-xs text-xs text-zinc-600">
                Championships, runner-up runs, and weekly awards land here as soon as
                they are earned.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {championships.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {championships.map((c) => (
                  <ChampionshipBanner key={c.team_id} season={c} />
                ))}
              </div>
            )}

            {runnerUps.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {runnerUps.map((r) => (
                  <RunnerUpBanner key={r.team_id} season={r} />
                ))}
              </div>
            )}

            {awards.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                  Weekly Awards
                </p>
                <div className="flex flex-wrap gap-2">
                  {awards.map((a) => {
                    const meta = AWARD_META[a.type] ?? {
                      icon: Crown,
                      label: a.type,
                      color: "#a1a1aa",
                    };
                    const Icon = meta.icon;
                    return (
                      <span
                        key={a.type}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 transition-colors hover:border-zinc-700"
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                        <span
                          className="text-[10px] font-semibold tracking-wider uppercase"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="font-mono text-[10px] font-bold tabular-nums text-zinc-300">
                          ×{a.count}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
