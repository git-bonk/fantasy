import { Flame } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PointsTrend } from "@/components/charts/PointsTrend";
import { TeamPointsChart } from "@/components/charts/TeamPointsChart";
import { TeamLink } from "@/components/links/TeamLink";
import { Reveal } from "@/components/motion/Reveal";
import {
  getHeadToHead,
  getLeagueTrend,
  getSeasons,
  getStreaks,
  getTeamTrends,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { cn } from "@/lib/utils";

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const prevSeason = getSeasons().find((s) => s.year < ctx.year);
  const prevSeasonAction = prevSeason ? (
    <Link
      href={`/trends?year=${prevSeason.year}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-emerald-400"
    >
      View {prevSeason.year} instead
    </Link>
  ) : undefined;
  const leagueTrend = getLeagueTrend(seasonId);
  const teamTrends = await getTeamTrends(seasonId);
  const streaks = await getStreaks(seasonId);
  const { teams, matrix } = await getHeadToHead(seasonId);

  const leagueAvg = leagueTrend.map((t) => ({
    week: t.week_num,
    avg: Number(t.avg_pts.toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Trends" subtitle="Scoring, streaks, and head-to-head" />

      <Reveal>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">League Scoring</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <PointsTrend data={leagueTrend} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Team Scoring</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <TeamPointsChart data={teamTrends} leagueAvg={leagueAvg} />
          </CardContent>
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Reveal delay={0.05}>
          <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
            <CardHeader className="border-b border-zinc-800 pb-3">
              <CardTitle className="flex items-center gap-2 font-display">
                <Flame className="h-4 w-4 text-amber-400" />
                Active Streaks
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              {streaks.length === 0 ? (
                <EmptyState
                  message="No active streaks of 2+ games."
                  action={prevSeasonAction}
                />
              ) : (
                <div className="divide-y divide-zinc-800/70">
                  {streaks.slice(0, 8).map((s) => (
                    <div key={s.team_id} className="flex items-center gap-3 py-2.5">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-[10px] font-bold"
                        style={{ backgroundColor: `${s.color}1f`, color: s.color }}
                      >
                        {s.name.slice(0, 3).toUpperCase()}
                      </span>
                      <TeamLink
                        teamId={s.team_id}
                        className="min-w-0 flex-1 truncate text-sm font-semibold transition-colors hover:text-emerald-400"
                      >
                        {s.name}
                      </TeamLink>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 font-mono text-sm font-bold tabular-nums",
                          s.type === "W"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        )}
                      >
                        {s.type}
                        {s.streak}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
            <CardHeader className="border-b border-zinc-800 pb-3">
              <CardTitle className="font-display">Head-to-Head</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto pt-4">
              <table className="w-full border-separate border-spacing-0.5 text-center">
                <thead>
                  <tr>
                    <th className="p-1" />
                    {teams.map((t) => (
                      <th
                        key={t.id}
                        className="p-1 font-display text-[10px] font-bold"
                        style={{ color: t.color }}
                      >
                        <TeamLink teamId={t.id} className="transition-opacity hover:opacity-70">
                          {t.abbrev}
                        </TeamLink>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((rowTeam) => (
                    <tr key={rowTeam.id}>
                      <td
                        className="p-1 text-right font-display text-[10px] font-bold"
                        style={{ color: rowTeam.color }}
                      >
                        <TeamLink
                          teamId={rowTeam.id}
                          className="transition-opacity hover:opacity-70"
                        >
                          {rowTeam.abbrev}
                        </TeamLink>
                      </td>
                      {teams.map((colTeam) => {
                        if (rowTeam.id === colTeam.id) {
                          return (
                            <td key={colTeam.id} className="rounded bg-zinc-800/40 p-1" />
                          );
                        }
                        const rec = matrix.get(`${rowTeam.id}-${colTeam.id}`);
                        const wins = rec?.wins ?? 0;
                        const losses = rec?.losses ?? 0;
                        const played = wins + losses;
                        return (
                          <td key={colTeam.id} className="p-0">
                            {played === 0 ? (
                              <div className="rounded bg-zinc-800/40 p-1 text-center font-mono text-[10px] font-semibold tabular-nums text-zinc-600">
                                ·
                              </div>
                            ) : (
                              <Link
                                href={`/rivalry?a=${rowTeam.id}&b=${colTeam.id}`}
                                title={`${rowTeam.abbrev} vs ${colTeam.abbrev}`}
                                className={cn(
                                  "block rounded p-1 text-center font-mono text-[10px] font-semibold tabular-nums transition-all hover:ring-1 hover:ring-zinc-500",
                                  wins > losses
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : wins < losses
                                      ? "bg-rose-500/10 text-rose-400"
                                      : "bg-zinc-700/30 text-zinc-300"
                                )}
                              >
                                {`${wins}-${losses}`}
                              </Link>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-zinc-500">
                Row team&apos;s record vs. column team (regular season).
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
