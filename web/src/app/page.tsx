import Link from "next/link";
import {
  ArrowRight,
  Crown,
  Flame,
  Scale,
  Activity,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AliasTag } from "@/components/cards/AliasTag";
import { StatCard } from "@/components/cards/StatCard";
import { Sparkline } from "@/components/charts/Sparkline";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import { Bracket } from "@/components/playoffs/Bracket";
import { FinalStandingsTable } from "@/components/playoffs/FinalStandingsTable";
import {
  getFinalStandings,
  getLeagueTrend,
  getMatchups,
  getPlayoffBracket,
  getRankings,
  getRecapAwards,
  getSeasons,
  getTeamPointsByWeek,
  getTeams,
} from "@/lib/queries";
import { getRevealState } from "@/lib/reveal";
import { resolveSeason } from "@/lib/resolve-season";
import { cn } from "@/lib/utils";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const { seasonId, weekNum, weeks, maxWeek } = ctx;
  const seasons = getSeasons();
  const season = seasons.find((s) => s.id === seasonId);
  const selectedWeek = weeks.find((w) => w.week_num === weekNum);
  const weekLabel = selectedWeek?.label ?? `Week ${weekNum}`;
  const isPlayoffWeek = selectedWeek?.is_playoff === 1;
  const isFinalWeek = weekNum === maxWeek;

  const matchups = await getMatchups(seasonId, weekNum);
  const revealed = await getRevealState();
  const rankings = await getRankings(seasonId);
  const teams = await getTeams(seasonId);
  const leagueTrend = getLeagueTrend(seasonId);
  const awards = await getRecapAwards(seasonId, weekNum);
  const bracket = isPlayoffWeek ? await getPlayoffBracket(seasonId) : [];
  const finalStandings = isFinalWeek ? await getFinalStandings(seasonId) : [];

  const featured = [...matchups].sort(
    (a, b) => b.home_score + b.away_score - (a.home_score + a.away_score)
  )[0];

  const topTeam = rankings[0];
  const topTeamStanding = teams.find((t) => t.id === topTeam?.id);
  const topTeamSpark = topTeam
    ? getTeamPointsByWeek(seasonId, topTeam.id).map((p) => p.points)
    : [];

  const allScores = matchups.flatMap((m) => [m.home_score, m.away_score]);
  const highestScore = Math.max(...allScores, 0);
  const highestTeam = matchups.find(
    (m) => m.home_score === highestScore || m.away_score === highestScore
  );
  const highestName =
    highestTeam?.home_score === highestScore ? highestTeam.hname : highestTeam?.aname;

  const closest = [...matchups].sort(
    (a, b) =>
      Math.abs(a.home_score - a.away_score) - Math.abs(b.home_score - b.away_score)
  )[0];
  const closestMargin = closest
    ? Math.abs(closest.home_score - closest.away_score)
    : 0;

  const upset = awards.find((a) => a.type === "BIGGEST_UPSET");
  const leagueAvg =
    allScores.length > 0 ? allScores.reduce((s, v) => s + v, 0) / allScores.length : 0;
  const leagueSpark = leagueTrend.map((t) => Number(t.avg_pts));

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-emerald-500 uppercase">
              Fantasy NFL · {season?.year ?? ""}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl">
              {weekLabel} Scoreboard
            </h1>
          </div>
          <Link
            href="/scores"
            className="inline-flex items-center gap-1 text-sm font-medium text-zinc-400 transition-colors hover:text-emerald-400"
          >
            Full scoreboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Reveal className="xl:col-span-2">
          {isPlayoffWeek ? (
            <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
              <CardContent className="p-6 md:p-8">
                <p className="mb-6 text-center text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
                  Playoff Bracket
                </p>
                <Bracket games={bracket} />
              </CardContent>
            </Card>
          ) : featured ? (
            <Card className="relative overflow-hidden border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  background: `radial-gradient(ellipse 60% 80% at 25% 50%, ${featured.acolor}, transparent 65%), radial-gradient(ellipse 60% 80% at 75% 50%, ${featured.hcolor}, transparent 65%)`,
                }}
              />
              <CardContent className="relative p-6 md:p-8">
                <p className="mb-6 text-center text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
                  Featured Matchup
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
                  <div className="text-center">
                    <span
                      className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl font-display text-lg font-bold md:h-20 md:w-20 md:text-xl"
                      style={{
                        backgroundColor: `${featured.acolor}1f`,
                        color: featured.acolor,
                        boxShadow:
                          featured.winner_team_id === featured.aid
                            ? `0 0 0 2px ${featured.acolor}66, 0 0 32px ${featured.acolor}33`
                            : undefined,
                      }}
                    >
                      {featured.aabb}
                    </span>
                    {revealed ? (
                      <p className="mt-3 truncate font-display text-sm font-semibold md:text-base">
                        {featured.aname}
                      </p>
                    ) : (
                      <div className="mt-3 flex justify-center">
                        <AliasTag label={featured.aname} />
                      </div>
                    )}
                    <CountUp
                      value={featured.away_score}
                      decimals={2}
                      className={cn(
                        "mt-1 block font-display text-4xl font-bold tabular-nums md:text-5xl",
                        featured.winner_team_id === featured.aid
                          ? "text-foreground"
                          : "text-zinc-500"
                      )}
                    />
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <span className="font-display text-xl font-bold text-zinc-600 md:text-2xl">
                      @
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
                      Final
                    </span>
                  </div>

                  <div className="text-center">
                    <span
                      className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl font-display text-lg font-bold md:h-20 md:w-20 md:text-xl"
                      style={{
                        backgroundColor: `${featured.hcolor}1f`,
                        color: featured.hcolor,
                        boxShadow:
                          featured.winner_team_id === featured.hid
                            ? `0 0 0 2px ${featured.hcolor}66, 0 0 32px ${featured.hcolor}33`
                            : undefined,
                      }}
                    >
                      {featured.habb}
                    </span>
                    {revealed ? (
                      <p className="mt-3 truncate font-display text-sm font-semibold md:text-base">
                        {featured.hname}
                      </p>
                    ) : (
                      <div className="mt-3 flex justify-center">
                        <AliasTag label={featured.hname} />
                      </div>
                    )}
                    <CountUp
                      value={featured.home_score}
                      decimals={2}
                      className={cn(
                        "mt-1 block font-display text-4xl font-bold tabular-nums md:text-5xl",
                        featured.winner_team_id === featured.hid
                          ? "text-foreground"
                          : "text-zinc-500"
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
              <CardContent className="p-8 text-center text-sm text-zinc-500">
                No matchups recorded yet.
              </CardContent>
            </Card>
          )}
        </Reveal>

        <Reveal delay={0.08}>
          {topTeam && (
            <Card className="flex h-full flex-col border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-amber-400 uppercase">
                  <Crown className="h-3.5 w-3.5" />
                  Top Ranked
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl font-display text-sm font-bold"
                    style={{ backgroundColor: `${topTeam.color}1f`, color: topTeam.color }}
                  >
                    {topTeam.abbrev}
                  </span>
                  <div className="min-w-0">
                    {revealed ? (
                      <p className="truncate font-display text-base font-bold">
                        {topTeam.name}
                      </p>
                    ) : (
                      <AliasTag label={topTeam.name} />
                    )}
                    {revealed ? (
                      <p className="text-xs text-zinc-500">
                        {topTeamStanding?.owner_name}
                      </p>
                    ) : (
                      <AliasTag
                        label={topTeamStanding?.owner_name ?? ""}
                        className="mt-0.5"
                      />
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <CountUp
                    value={topTeam.rating}
                    className="font-display text-4xl font-bold tabular-nums"
                  />
                  <span className="text-xs text-zinc-500">Elo</span>
                </div>
                <div className="mt-auto pt-4">
                  <p className="mb-1 text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                    Season scoring
                  </p>
                  <Sparkline
                    data={topTeamSpark}
                    color={topTeam.color}
                    id="top-team"
                    height={48}
                  />
                </div>
                <Link
                  href={`/teams/${topTeam.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-emerald-400"
                >
                  View team <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          )}
        </Reveal>
      </div>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.06}>
        <StaggerItem>
          <StatCard
            label="Highest Score"
            value={highestScore}
            decimals={2}
            icon={Flame}
            accent="#fbbf24"
            sub={highestName}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Closest Finish"
            value={closestMargin}
            decimals={2}
            icon={Scale}
            accent="#38bdf8"
            sub={
              closest
                ? `${closest.aabb} @ ${closest.habb}`
                : undefined
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Biggest Upset"
            value={upset?.value ?? 0}
            decimals={2}
            icon={Zap}
            accent="#f97316"
            sub={upset?.tname ?? upset?.detail ?? undefined}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="League Avg"
            value={leagueAvg}
            decimals={1}
            icon={Activity}
            accent="#10b981"
            sub="per team, this week"
            spark={leagueSpark}
            sparkId="league-avg"
          />
        </StaggerItem>
      </Stagger>

      <Reveal delay={0.05}>
        {isFinalWeek ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">Final Standings</h2>
              <Link
                href="/rankings"
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-emerald-400"
              >
                Full rankings <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <FinalStandingsTable rows={finalStandings} revealed={revealed} />
          </div>
        ) : (
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
              <h2 className="font-display text-sm font-semibold">Standings Snapshot</h2>
              <Link
                href="/rankings"
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition-colors hover:text-emerald-400"
              >
                Full rankings <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-zinc-800/70">
              {rankings.slice(0, 5).map((t, i) => (
                <Link
                  key={t.id}
                  href={`/teams/${t.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-foreground/[0.03]"
                >
                  <span className="w-6 font-mono text-sm font-bold tabular-nums text-zinc-500">
                    {i + 1}
                  </span>
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-[10px] font-bold"
                    style={{ backgroundColor: `${t.color}1f`, color: t.color }}
                  >
                    {t.abbrev}
                  </span>
                  {revealed ? (
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {t.name}
                    </span>
                  ) : (
                    <AliasTag label={t.name} className="min-w-0 flex-1" />
                  )}
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {Math.round(t.rating)}
                  </span>
                  <span className="hidden w-24 text-right text-[10px] tracking-wider text-zinc-500 uppercase sm:block">
                    Elo
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        )}
      </Reveal>
    </div>
  );
}
