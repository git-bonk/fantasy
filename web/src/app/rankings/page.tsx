import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EloLineChart } from "@/components/charts/EloLineChart";
import { CoachRatingsTable } from "@/components/rankings/CoachRatingsTable";
import { RankingsTable } from "@/components/rankings/RankingsTable";
import { ReportCards } from "@/components/rankings/ReportCards";
import { getCoachLeaderboard, getEloHistory, getSeasonPowerRankings } from "@/lib/queries";
import { getSeasonReportCards } from "@/lib/queries";
import { getRevealState } from "@/lib/reveal";
import { resolveSeason } from "@/lib/resolve-season";

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const rankings = await getSeasonPowerRankings(seasonId);
  const history = await getEloHistory(seasonId);
  const coach = await getCoachLeaderboard(seasonId);
  const reportCards = await getSeasonReportCards(seasonId);
  const revealed = await getRevealState();

  const weeks = [...new Set(history.map((h) => h.week_num))].sort((a, b) => a - b);
  const maxRegWeek = weeks.filter((w) => w <= 14).at(-1) ?? weeks.at(-1) ?? 1;
  const prevWeek = maxRegWeek - 1;

  const deltas: Record<number, number> = {};
  const prevRating = new Map<number, number>();
  for (const h of history) {
    if (h.week_num === prevWeek) prevRating.set(h.id, h.rating);
  }
  for (const team of rankings) {
    const prev = prevRating.get(team.id);
    deltas[team.id] = prev !== undefined ? team.rating - prev : 0;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Season Power Rankings"
        subtitle="Per-team Elo ratings for the selected season"
      />

      <Reveal>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Elo Movement</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <EloLineChart history={history} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardContent className="p-0">
            <RankingsTable rankings={rankings} deltas={deltas} revealed={revealed} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Coach Ratings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <CoachRatingsTable rows={coach} revealed={revealed} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Season Report Cards</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ReportCards cards={reportCards} />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
