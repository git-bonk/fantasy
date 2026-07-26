import { PageHeader } from "@/components/PageHeader";
import { WeekSelector } from "@/components/WeekSelector";
import { MatchupCard } from "@/components/cards/MatchupCard";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import {
  getMatchups,
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
  const { seasonId, weekNum, weeks, maxWeek } = ctx;

  const matchups = await getMatchups(seasonId, weekNum);
  const revealed = await getRevealState();
  const weekLabel = weeks.find((w) => w.week_num === weekNum)?.label ?? `Week ${weekNum}`;

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
        action={<WeekSelector weeks={weeks} current={weekNum} />}
      />

      {matchups.length === 0 ? (
        <Reveal>
          <p className="py-16 text-center text-sm text-zinc-500">
            No matchups recorded for this week.
          </p>
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
