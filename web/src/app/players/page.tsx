import Link from "next/link";
import {
  getPositionLeaders,
  getSeasonPlayerTable,
  getTopPerformers,
  ptsPerGame,
  type SeasonPlayerTableRow,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { getRevealState } from "@/lib/reveal";
import { PerformersTable } from "@/components/players/PerformersTable";
import { PositionLeaders } from "@/components/players/PositionLeaders";
import { SeasonPlayerTable } from "@/components/players/SeasonPlayerTable";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

const POSITION_FILTERS = ["QB", "RB", "WR", "TE", "K", "DEF"];

const CHIP_BASE =
  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
const CHIP_ACTIVE = "border-emerald-500/50 bg-emerald-500/15 text-emerald-400";
const CHIP_IDLE =
  "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200";

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string; position?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const { seasonId, weekNum: week, weeks, year } = ctx;
  const params = await searchParams;
  const rawPosition = params.position?.toUpperCase();
  const position = POSITION_FILTERS.includes(rawPosition ?? "") ? rawPosition : undefined;

  const performers = await getTopPerformers(seasonId, week);
  const positionLeaders = getPositionLeaders(seasonId);
  const seasonRows = await getSeasonPlayerTable(seasonId, position);
  const tableRows: SeasonPlayerTableRow[] = seasonRows.map((r) => ({
    ...r,
    ppg: ptsPerGame(r.total_points, r.games),
  }));
  const revealed = await getRevealState();
  const weekLabel = weeks.find((w) => w.week_num === week)?.label ?? `Week ${week}`;

  const chipHref = (pos?: string) => {
    const query = new URLSearchParams({ year: String(year), week: String(week) });
    if (pos) query.set("position", pos);
    return `/players?${query.toString()}`;
  };

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Players</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Every player&apos;s season at a glance, plus weekly standouts and position leaders.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Full Season Table
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={chipHref()}
                className={cn(CHIP_BASE, position === undefined ? CHIP_ACTIVE : CHIP_IDLE)}
              >
                All
              </Link>
              {POSITION_FILTERS.map((pos) => (
                <Link
                  key={pos}
                  href={chipHref(pos)}
                  className={cn(CHIP_BASE, position === pos ? CHIP_ACTIVE : CHIP_IDLE)}
                >
                  {pos}
                </Link>
              ))}
            </div>
          </div>
          <SeasonPlayerTable rows={tableRows} revealed={revealed} />
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Top Performers
            <span className="ml-2 text-sm font-normal text-muted-foreground">{weekLabel}</span>
          </h2>
          {performers.length > 0 ? (
            <PerformersTable players={performers} />
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
              No player performances recorded for this week.
            </div>
          )}
        </section>
      </Reveal>

      <Reveal delay={0.15}>
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
