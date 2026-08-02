import Link from "next/link";
import { UserRound } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { PickCard } from "@/components/predictions/PickCard";
import { PredictionLeaderboard } from "@/components/predictions/PredictionLeaderboard";
import { getCurrentOwner } from "@/lib/auth";
import { isWeekLocked } from "@/lib/lock";
import {
  getMyPicks,
  getPredictionLeaderboard,
  getScheduledWeeks,
  getSeasons,
  getWeekPickables,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { cn } from "@/lib/utils";

interface PredictionsPageProps {
  searchParams: Promise<{ year?: string; week?: string }>;
}

export default async function PredictionsPage({ searchParams }: PredictionsPageProps) {
  const ctx = await resolveSeason(searchParams);
  const owner = await getCurrentOwner();

  const prevSeason = getSeasons().find((s) => s.year < ctx.year);
  const prevSeasonAction = prevSeason ? (
    <Link
      href={`/predictions?year=${prevSeason.year}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-emerald-400"
    >
      View {prevSeason.year} instead
    </Link>
  ) : undefined;

  const scheduledWeeks = getScheduledWeeks(ctx.seasonId);
  const [initialPickables, leaderboard] = await Promise.all([
    getWeekPickables(ctx.seasonId, ctx.weekNum),
    getPredictionLeaderboard(ctx.seasonId),
  ]);

  let weekNum = ctx.weekNum;
  let pickables = initialPickables;
  if (pickables.length === 0 && scheduledWeeks.length > 0) {
    const fallback =
      scheduledWeeks.find((w) => !isWeekLocked(ctx.seasonId, w)) ?? scheduledWeeks[0];
    if (fallback !== weekNum) {
      weekNum = fallback;
      pickables = await getWeekPickables(ctx.seasonId, weekNum);
    }
  }

  const myPicks = owner
    ? getMyPicks(owner.ownerId, ctx.seasonId, weekNum)
    : new Map<string, number | null>();
  const locked = isWeekLocked(ctx.seasonId, weekNum);
  const weekLabel =
    ctx.weeks.find((w) => w.week_num === weekNum)?.label ?? `Week ${weekNum}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Predictions"
        subtitle={`${weekLabel} · pick the winners`}
      />

      {scheduledWeeks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {scheduledWeeks.map((w) => (
            <Link
              key={w}
              href={`/predictions?year=${ctx.year}&week=${w}`}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 font-mono text-xs tabular-nums transition-colors",
                w === weekNum
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              {w}
            </Link>
          ))}
        </div>
      )}

      {!owner && (
        <Reveal>
          <div className="flex items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
            <UserRound className="h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-sm text-amber-200/90">
              Sign in with your owner token to make picks.
            </p>
          </div>
        </Reveal>
      )}

      {pickables.length === 0 ? (
        <Reveal>
          <EmptyState
            message="No games to pick for this week."
            action={prevSeasonAction}
          />
        </Reveal>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
          {pickables.map((row) => (
            <StaggerItem key={row.matchup_key}>
              <PickCard
                row={row}
                pickedTeamId={myPicks.get(row.matchup_key) ?? null}
                locked={locked}
                signedIn={owner !== null}
                seasonId={ctx.seasonId}
                weekNum={weekNum}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <Reveal delay={0.1}>
        <PredictionLeaderboard rows={leaderboard} currentOwnerId={owner?.ownerId ?? null} />
      </Reveal>
    </div>
  );
}
