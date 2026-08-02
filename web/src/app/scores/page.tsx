import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { MatchupCard } from "@/components/cards/MatchupCard";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import {
  getMatchups,
  getSeasons,
  getWeekRosters,
} from "@/lib/queries";
import { getRevealState } from "@/lib/reveal";
import { resolveSeason } from "@/lib/resolve-season";
import type { WeekRosterRow } from "@/lib/types";

interface ScoresPageProps {
  searchParams: Promise<{ year?: string; week?: string }>;
}

export default async function ScoresPage({ searchParams }: ScoresPageProps) {
  const ctx = await resolveSeason(searchParams);
  const { seasonId, weekNum, weeks, year } = ctx;

  const matchups = await getMatchups(seasonId, weekNum);
  const revealed = await getRevealState();
  const weekLabel = weeks.find((w) => w.week_num === weekNum)?.label ?? `Week ${weekNum}`;

  const prevSeason = getSeasons().find((s) => s.year < year);
  const prevSeasonAction = prevSeason ? (
    <Link
      href={`/scores?year=${prevSeason.year}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-emerald-400"
    >
      View {prevSeason.year} instead
    </Link>
  ) : undefined;

  const rostersByTeam = new Map<number, WeekRosterRow[]>();
  for (const row of getWeekRosters(seasonId, weekNum)) {
    const list = rostersByTeam.get(row.team_id) ?? [];
    list.push(row);
    rostersByTeam.set(row.team_id, list);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scores"
        subtitle={weekLabel}
      />

      {matchups.length === 0 ? (
        <Reveal>
          <EmptyState
            message="No matchups recorded for this week."
            action={prevSeasonAction}
          />
        </Reveal>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
          {matchups.map((m) => (
            <StaggerItem key={m.id}>
              <MatchupCard
                matchup={m}
                autoOpenOnDesktop
                revealed={revealed}
                rosters={{
                  home: rostersByTeam.get(m.hid) ?? [],
                  away: rostersByTeam.get(m.aid) ?? [],
                }}
              />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
