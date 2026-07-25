import { Crown } from "lucide-react";
import { getLatestSeasonId, getMaxRegularWeek, getWeeks, getPlayoffStandings, getPlayoffBracket, getSeasons, getStreaks } from "@/lib/queries";
import { StandingsTable } from "@/components/playoffs/StandingsTable";
import { Bracket } from "@/components/playoffs/Bracket";
import { WeekSelector } from "@/components/WeekSelector";
import { Reveal } from "@/components/motion/Reveal";
import type { BracketGameRow, TeamStreak } from "@/lib/types";

function findChampion(games: BracketGameRow[]) {
  if (games.length === 0) return null;
  const weekNums = [...new Set(games.map((g) => g.week_num))].sort((a, b) => a - b);
  const finalWeek = weekNums[weekNums.length - 1];
  const semiWeek = weekNums[weekNums.length - 2];
  const finalGames = games.filter((g) => g.week_num === finalWeek);
  const semiWinners = new Set(
    games
      .filter((g) => g.week_num === semiWeek)
      .map((g) => g.winner_team_id)
      .filter((id): id is number => id != null)
  );
  const championship =
    finalGames.find((g) => semiWinners.has(g.hid) && semiWinners.has(g.aid)) ?? finalGames[0];
  if (!championship || championship.winner_team_id == null) return null;
  const home = championship.winner_team_id === championship.hid;
  return {
    name: home ? championship.hname : championship.aname,
    abbrev: home ? championship.habb : championship.aabb,
    color: home ? championship.hcolor : championship.acolor,
    score: home ? championship.home_score : championship.away_score,
    oppScore: home ? championship.away_score : championship.home_score,
  };
}

export default async function PlayoffsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;
  const seasonId = getLatestSeasonId();
  const weeks = getWeeks(seasonId);
  const maxRegular = getMaxRegularWeek(seasonId);
  const week = Math.min(Math.max(Number(weekParam) || maxRegular, 1), maxRegular);

  const standings = getPlayoffStandings(seasonId, week);
  const bracket = getPlayoffBracket(seasonId);
  const champion = findChampion(bracket);
  const streaks = new Map<number, TeamStreak>(
    getStreaks(seasonId).map((s) => [s.team_id, { streak: s.streak, type: s.type }])
  );

  const season = getSeasons().find((s) => s.id === seasonId);
  let playoffTeams = 6;
  if (season) {
    try {
      const settings = JSON.parse(season.settings_json) as { playoff_teams?: number };
      playoffTeams = settings.playoff_teams ?? 6;
    } catch {
      playoffTeams = 6;
    }
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Playoffs</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Standings, odds, and the road to the championship.
          </p>
        </div>
      </Reveal>

      {champion && (
        <Reveal delay={0.05}>
          <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-card to-card p-6">
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white shadow-lg"
                style={{ backgroundColor: champion.color }}
              >
                {champion.abbrev}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-amber-400">
                  <Crown className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    League Champions
                  </span>
                </div>
                <p className="truncate font-display text-2xl font-bold">{champion.name}</p>
                <p className="font-mono text-sm tabular-nums text-muted-foreground">
                  Won the Championship {champion.score.toFixed(1)}–{champion.oppScore.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.1}>
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">Standings</h2>
            <WeekSelector weeks={weeks} current={week} />
          </div>
          <StandingsTable standings={standings} playoffTeams={playoffTeams} streaks={streaks} />
        </section>
      </Reveal>

      <Reveal delay={0.15}>
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">Bracket</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-6">
            <Bracket games={bracket} />
          </div>
        </section>
      </Reveal>
    </div>
  );
}
