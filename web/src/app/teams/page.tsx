import { PageHeader } from "@/components/PageHeader";
import { TeamCard } from "@/components/cards/TeamCard";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { getLatestSeasonId, getTeams } from "@/lib/queries";

export default function TeamsPage() {
  const seasonId = getLatestSeasonId();
  const teams = getTeams(seasonId);

  return (
    <div className="space-y-6">
      <PageHeader title="Teams" subtitle={`${teams.length} teams in the league`} />

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
        {teams.map((t) => (
          <StaggerItem key={t.id}>
            <TeamCard team={t} />
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
