import Link from "next/link";
import {
  getPositionLeaders,
  getSeasonPlayerTable,
  getSeasons,
  getTopPerformers,
  ptsPerGame,
  type SeasonPlayerTableRow,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { getRevealState } from "@/lib/reveal";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { PerformersTable } from "@/components/players/PerformersTable";
import { PositionLeaders } from "@/components/players/PositionLeaders";
import { SeasonPlayerTable } from "@/components/players/SeasonPlayerTable";
import { Reveal } from "@/components/motion/Reveal";
import { cn } from "@/lib/utils";

const POSITION_FILTERS = ["QB", "RB", "WR", "TE", "K", "DEF"];

const CHIP_BASE = "rounded-full border px-3 py-1 text-xs font-semibold transition-colors";
const CHIP_ACTIVE = "border-emerald-500/50 bg-emerald-500/15 text-emerald-400";
const CHIP_IDLE =
  "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200";
const EMPTY_ACTION =
  "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-emerald-400";

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

  const isEmptySeason =
    !position &&
    tableRows.length === 0 &&
    performers.length === 0 &&
    positionLeaders.length === 0;
  const prevSeason = getSeasons().find((s) => s.year < ctx.year);

  const chipHref = (pos?: string) => {
    const query = new URLSearchParams({ year: String(year), week: String(week) });
    if (pos) query.set("position", pos);
    return `/players?${query.toString()}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Players"
        subtitle="Every player's season at a glance, plus weekly standouts and position leaders."
      />

      {isEmptySeason ? (
        <Reveal delay={0.05}>
          <EmptyState
            message="No player data for this season yet."
            action={
              prevSeason && (
                <Link href={`/players?year=${prevSeason.year}`} className={EMPTY_ACTION}>
                  View {prevSeason.year} season
                </Link>
              )
            }
          />
        </Reveal>
      ) : (
        <>
          <Reveal delay={0.05}>
            <section className="space-y-4">
              <SectionHeader
                title="Full Season Table"
                controls={
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
                }
              />
              <SeasonPlayerTable rows={tableRows} revealed={revealed} />
            </section>
          </Reveal>

          <Reveal delay={0.1}>
            <section className="space-y-4">
              <SectionHeader title="Top Performers" description={weekLabel} />
              {performers.length > 0 ? (
                <PerformersTable players={performers} />
              ) : (
                <EmptyState message="No player performances recorded for this week." />
              )}
            </section>
          </Reveal>

          <Reveal delay={0.15}>
            <section className="space-y-4">
              <SectionHeader title="Season Leaders by Position" />
              <PositionLeaders data={positionLeaders} />
            </section>
          </Reveal>
        </>
      )}
    </div>
  );
}
