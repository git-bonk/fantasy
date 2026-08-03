import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Star, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/cards/StatCard";
import { CareerPointsChart } from "@/components/players/CareerPointsChart";
import { NflStatsTable, type NflStatsRow } from "@/components/players/NflStatsTable";
import { TenureTimeline } from "@/components/players/TenureTimeline";
import {
  careerSpan,
  getPlayerCareer,
  getPlayerNflSeasons,
  getPlayerNflStats,
  getPlayerOwnership,
  getPlayerTenure,
  isFranchiseLegend,
  missedOutSeasons,
  nflStatColumns,
  pointsBySeason,
  summarizeCareer,
} from "@/lib/queries/player-career";

interface PlayerCareerPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlayerCareerPage({ params }: PlayerCareerPageProps) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId) || playerId <= 0) notFound();

  const career = await getPlayerCareer(playerId);
  if (!career) notFound();

  const [tenure, ownership, nflSeasons, nflWeekStats] = await Promise.all([
    getPlayerTenure(playerId),
    getPlayerOwnership(playerId),
    getPlayerNflSeasons(playerId),
    getPlayerNflStats(playerId),
  ]);
  const summary = summarizeCareer(tenure);
  const legend = isFranchiseLegend(ownership.maxSeasonsSameOwner);
  const seasonPoints = pointsBySeason(tenure);
  const statColumns = nflStatColumns(career.position);
  const pointsByYear = new Map(seasonPoints.map((p) => [p.year, p.points]));
  const complete = nflSeasons.length > 0;
  const missed = complete
    ? missedOutSeasons(
        nflSeasons,
        tenure.map((t) => t.year),
        career.position
      )
    : [];
  const nflRows: NflStatsRow[] = complete
    ? nflSeasons.map((s) => ({
        year: s.year,
        nflTeam: s.nflTeam,
        games: s.games,
        fantasyPoints: pointsByYear.get(s.year) ?? null,
        stats: s.stats,
      }))
    : nflWeekStats.map((s) => ({
        year: s.year,
        games: s.games,
        fantasyPoints: pointsByYear.get(s.year) ?? 0,
        stats: s.stats,
      }));

  return (
    <div className="space-y-6">
      <Reveal>
        <Link
          href="/players"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          All players
        </Link>
      </Reveal>

      <PageHeader
        title={career.fullName}
        subtitle={`${career.position} · ${career.nflTeam} · ${careerSpan(
          career.firstYear,
          career.lastYear
        )}`}
        action={
          legend ? (
            <Badge className="border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Trophy className="h-3 w-3" />
              Franchise Legend
            </Badge>
          ) : undefined
        }
      />

      <Reveal delay={0.05}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Seasons" value={summary.seasonsPlayed} icon={Calendar} accent="#38bdf8" />
          <StatCard
            label="Career Points"
            value={summary.totalPoints}
            decimals={1}
            icon={Star}
            accent="#fbbf24"
          />
          <StatCard
            label="Distinct Owners"
            value={ownership.distinctOwners}
            icon={Users}
            accent="#a855f7"
          />
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Points by Season</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {seasonPoints.length > 0 ? (
              <CareerPointsChart
                data={seasonPoints}
                color="#10b981"
                    id={`player-${playerId}`}
              />
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">
                No roster data recorded for this player yet.
              </p>
            )}
          </CardContent>
        </Card>
      </Reveal>

      {nflRows.length > 0 && statColumns.length > 0 && (
        <Reveal delay={0.09}>
          <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
            <CardHeader className="border-b border-zinc-800 pb-3">
              <CardTitle className="font-display">NFL Production</CardTitle>
              <p className="text-xs text-zinc-500">
                {complete
                  ? "Complete NFL seasons, next to the fantasy points this player delivered in the league."
                  : "Real-world stats for the weeks this player was on a league roster, next to the fantasy points they delivered."}
              </p>
            </CardHeader>
            {missed.length > 0 && (
              <div className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                <span className="font-semibold">Missed out:</span>{" "}
                {missed
                  .slice(-3)
                  .map((m) =>
                    m.headline ? `${m.headline} in ${m.year}` : `NFL production in ${m.year}`
                  )
                  .join("; ")}
                {missed.length > 3 && ` and ${missed.length - 3} earlier seasons`} — never
                rostered in this league {missed.length === 1 ? "that season" : "those seasons"}.
              </div>
            )}
            <CardContent className="p-0">
              <NflStatsTable
                rows={nflRows}
                columns={statColumns}
                showTeam={complete}
                gamesLabel={complete ? "GP" : "Wks"}
              />
            </CardContent>
          </Card>
        </Reveal>
      )}

      <Reveal delay={0.1}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Tenure Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tenure.length > 0 ? (
              <TenureTimeline tenure={tenure} />
            ) : (
              <p className="py-8 text-center text-sm text-zinc-400">
                No roster history recorded for this player yet.
              </p>
            )}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
