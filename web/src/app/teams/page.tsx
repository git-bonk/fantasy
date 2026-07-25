import { PageHeader } from "@/components/PageHeader";
import { TeamCard } from "@/components/cards/TeamCard";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { getLatestSeasonId, getStreaks, getTeams } from "@/lib/queries";
import type { TeamStreak } from "@/lib/types";

export default function TeamsPage() {
  const seasonId = getLatestSeasonId();
  const teams = getTeams(seasonId);
  const streaks = new Map<number, TeamStreak>(
    getStreaks(seasonId).map((s) => [s.team_id, { streak: s.streak, type: s.type }])
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Teams" subtitle={`${teams.length} teams in the league`} />

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
