import { getLatestSeasonId, getMaxWeek, getWeeks, getTopPerformers, getPositionLeaders } from "@/lib/queries";
import { PerformersTable } from "@/components/players/PerformersTable";
import { PositionLeaders } from "@/components/players/PositionLeaders";
import { WeekSelector } from "@/components/WeekSelector";
import { Reveal } from "@/components/motion/Reveal";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const seasonId = getLatestSeasonId();
  const weeks = getWeeks(seasonId);
  const maxWeek = getMaxWeek(seasonId);
  const week = Math.min(Math.max(Number(weekParam) || maxWeek, 1), maxWeek);

  const performers = getTopPerformers(seasonId, week);
  const positionLeaders = getPositionLeaders(seasonId);
  const weekLabel = weeks.find((w) => w.week_num === week)?.label ?? `Week ${week}`;

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Players</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Top performers and season leaders across the league.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Top Performers
              <span className="ml-2 text-sm font-normal text-muted-foreground">{weekLabel}</span>
            </h2>
            <WeekSelector weeks={weeks} current={week} />
          </div>
          {performers.length > 0 ? (
            <PerformersTable players={performers} />
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
              No player performances recorded for this week.
            </div>
          )}
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Season Leaders by Position
          </h2>
          <PositionLeaders data={positionLeaders} />
        </section>
      </Reveal>
    </div>
  );
}
