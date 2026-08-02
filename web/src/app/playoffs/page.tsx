import { Crown } from "lucide-react";
import {
  getLatestRatedWeek,
  getMaxRegularWeek,
  getPlayoffStandings,
  getPlayoffBracket,
  getRemainingSos,
  getSeasonSettings,
  getStreaks,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { StandingsTable } from "@/components/playoffs/StandingsTable";
import { RemainingSosTable } from "@/components/playoffs/RemainingSosTable";
import { Bracket } from "@/components/playoffs/Bracket";
import { PlayoffFormatCard } from "@/components/playoffs/PlayoffFormatCard";
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
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const maxRegular = getMaxRegularWeek(seasonId);
  const week = Math.min(Math.max(ctx.weekNum || maxRegular, 1), maxRegular);

  const standings = await getPlayoffStandings(seasonId, week);
  const bracket = await getPlayoffBracket(seasonId);
  const champion = findChampion(bracket);
  const streaks = new Map<number, TeamStreak>(
    (await getStreaks(seasonId)).map((s) => [s.team_id, { streak: s.streak, type: s.type }])
  );

  const settings = getSeasonSettings(seasonId);
  const format = settings.playoff ?? null;
  const playoffTeams = format?.team_count ?? settings.playoff_teams ?? 6;

  // Rest-of-season SOS runs "through" the resolved week, capped at the last
  // week with elo ratings so a pre-season season still shows its full schedule.
  const throughWeek = Math.min(week, getLatestRatedWeek(seasonId));
  const remainingSos = await getRemainingSos(seasonId, throughWeek);

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

      {format && (
        <Reveal delay={0.07}>
          <PlayoffFormatCard format={format} />
        </Reveal>
      )}

      <Reveal delay={0.1}>
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold tracking-tight">Standings</h2>
          <StandingsTable standings={standings} playoffTeams={playoffTeams} streaks={streaks} />
        </section>
      </Reveal>

      {remainingSos.length > 0 && (
        <Reveal delay={0.12}>
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Remaining schedule
            </h2>
            <RemainingSosTable rows={remainingSos} throughWeek={throughWeek} />
          </section>
        </Reveal>
      )}

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
