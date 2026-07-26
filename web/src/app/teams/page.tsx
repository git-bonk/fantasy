import { PageHeader } from "@/components/PageHeader";
import { TeamCard } from "@/components/cards/TeamCard";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { getStreaks, getTeams } from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import type { TeamStreak } from "@/lib/types";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const { seasonId, weekNum, weeks } = ctx;
  const teams = getTeams(seasonId, weekNum);
  const streaks = new Map<number, TeamStreak>(
    getStreaks(seasonId, weekNum).map((s) => [s.team_id, { streak: s.streak, type: s.type }])
  );
  const weekLabel = weeks.find((w) => w.week_num === weekNum)?.label ?? `Week ${weekNum}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        subtitle={`Standings through ${weekLabel} · ${teams.length} teams`}
      />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
        {teams.map((t) => (
          <StaggerItem key={t.id}>
            <TeamCard team={t} streak={streaks.get(t.id)} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
