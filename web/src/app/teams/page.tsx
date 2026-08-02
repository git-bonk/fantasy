import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TeamCard } from "@/components/cards/TeamCard";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { getSeasons, getStreaks, getTeams } from "@/lib/queries";
import { getRevealState } from "@/lib/reveal";
import { resolveSeason } from "@/lib/resolve-season";
import type { TeamStreak } from "@/lib/types";

const EMPTY_ACTION =
  "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-emerald-400";

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const { seasonId, weekNum, weeks } = ctx;
  const teams = await getTeams(seasonId, weekNum);
  const revealed = await getRevealState();
  const streaks = new Map<number, TeamStreak>(
    (await getStreaks(seasonId, weekNum)).map((s) => [s.team_id, { streak: s.streak, type: s.type }])
  );
  const weekLabel = weeks.find((w) => w.week_num === weekNum)?.label ?? `Week ${weekNum}`;
  const prevSeason = getSeasons().find((s) => s.year < ctx.year);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        subtitle={`Standings through ${weekLabel} · ${teams.length} teams`}
      />

      {teams.length === 0 ? (
        <Reveal delay={0.05}>
          <EmptyState
            message="No teams found for this season."
            action={
              prevSeason && (
                <Link href={`/teams?year=${prevSeason.year}`} className={EMPTY_ACTION}>
                  View {prevSeason.year} season
                </Link>
              )
            }
          />
        </Reveal>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
          {teams.map((t) => (
            <StaggerItem key={t.id}>
              <TeamCard team={t} streak={streaks.get(t.id)} revealed={revealed} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
