import { PageHeader } from "@/components/PageHeader";
import { WeekSelector } from "@/components/WeekSelector";
import { MatchupCard } from "@/components/cards/MatchupCard";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import {
  getLatestSeasonId,
  getMatchups,
  getMaxWeek,
  getWeeks,
} from "@/lib/queries";

interface ScoresPageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function ScoresPage({ searchParams }: ScoresPageProps) {
  const seasonId = getLatestSeasonId();
  const weeks = getWeeks(seasonId);
  const maxWeek = getMaxWeek(seasonId);
  const params = await searchParams;
  const weekNum = Math.min(Math.max(Number(params.week) || maxWeek, 1), maxWeek);

  const matchups = getMatchups(seasonId, weekNum);
  const weekLabel = weeks.find((w) => w.week_num === weekNum)?.label ?? `Week ${weekNum}`;

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
              <MatchupCard matchup={m} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
