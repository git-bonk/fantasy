import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { AwardBadge } from "@/components/cards/AwardBadge";
import { LuckMeter } from "@/components/cards/LuckMeter";
import { MatchupCard } from "@/components/cards/MatchupCard";
import { RecapCard } from "@/components/cards/RecapCard";
import { PowerBlurbs, type PowerBlurbRow } from "@/components/recap/PowerBlurbs";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import {
  getEloHistory,
  getRecapAwards,
  getRecapLuck,
  getSeasonPowerRankings,
  getSeasons,
  getStreaks,
  getTopPerformers,
} from "@/lib/queries";
import { getRevealState } from "@/lib/reveal";
import { resolveSeason } from "@/lib/resolve-season";
import { getRecapMatchups } from "@/lib/recap";
import { powerBlurb, type PowerBlurbInput } from "@/lib/power-blurbs";
import type { RecapMatchupRow } from "@/lib/types";

interface RecapPageProps {
  searchParams: Promise<{ year?: string; week?: string }>;
}

export default async function RecapPage({ searchParams }: RecapPageProps) {
  const ctx = await resolveSeason(searchParams);
  const { seasonId, weekNum, weeks, year } = ctx;

  const seasons = getSeasons();
  const prevSeason = seasons.find((s) => s.year < year);
  const prevSeasonAction = prevSeason ? (
    <Link
      href={`/recap?year=${prevSeason.year}`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-emerald-400"
    >
      View {prevSeason.year} instead
    </Link>
  ) : undefined;

  const results = await getRecapMatchups(seasonId, weekNum);
  const revealed = await getRevealState();
  const awards = await getRecapAwards(seasonId, weekNum);
  const luck = await getRecapLuck(seasonId, weekNum);
  const maxAbs = Math.max(...luck.map((l) => Math.abs(l.luck_score)), 0.01);
  const weekLabel = weeks.find((w) => w.week_num === weekNum)?.label ?? `Week ${weekNum}`;

  const featured = results.reduce<RecapMatchupRow | null>((best, m) => {
    const combined = m.home_score + m.away_score;
    const bestCombined = best ? best.home_score + best.away_score : -1;
    return combined > bestCombined ? m : best;
  }, null);
  const allScores = results.flatMap((m) => [m.home_score, m.away_score]);
  const leagueAvg = allScores.length
    ? allScores.reduce((sum, s) => sum + s, 0) / allScores.length
    : 0;
  const topScorer = (await getTopPerformers(seasonId, weekNum))[0] ?? null;
  const biggestBust = awards.find((a) => a.type === "BIGGEST_BUST") ?? null;
  const seasonYear =
    seasons.find((s) => s.id === seasonId)?.year ?? new Date().getFullYear();

  const rankings = await getSeasonPowerRankings(seasonId);
  const history = await getEloHistory(seasonId);
  const streaks = await getStreaks(seasonId, weekNum);

  const ratingAtWeek = (wk: number) =>
    new Map(history.filter((h) => h.week_num === wk).map((h) => [h.id, h.rating]));
  const curRatings = ratingAtWeek(weekNum);
  const prevRatings = ratingAtWeek(weekNum - 1);

  const prevOrder = [...rankings]
    .filter((t) => prevRatings.has(t.id))
    .sort((a, b) => (prevRatings.get(b.id) ?? 0) - (prevRatings.get(a.id) ?? 0));
  const prevRankByTeam = new Map(prevOrder.map((t, i) => [t.id, i + 1]));

  const streakByTeam = new Map(
    streaks.map((s) => [s.team_id, { kind: s.type, count: s.streak }])
  );
  const luckByTeam = new Map(luck.map((l) => [l.id, l.luck_score]));
  const weeklyPoints = new Map<number, number>();
  for (const m of results) {
    weeklyPoints.set(m.hid, m.home_score);
    weeklyPoints.set(m.aid, m.away_score);
  }

  const powerOrder = [...rankings].sort((a, b) => {
    const ra = curRatings.get(a.id);
    const rb = curRatings.get(b.id);
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return rb - ra;
  });

  const powerRows: PowerBlurbRow[] = powerOrder.map((team, i) => {
    const rank = i + 1;
    const blurbInput: PowerBlurbInput = {
      rank,
      prevRank: prevRankByTeam.get(team.id) ?? null,
      points: weeklyPoints.get(team.id) ?? team.points_for,
      streak: streakByTeam.get(team.id) ?? { kind: "W", count: 0 },
      luckScore: luckByTeam.get(team.id) ?? null,
    };
    return {
      teamId: team.id,
      name: team.name,
      color: team.color,
      rank,
      blurb: powerBlurb(blurbInput),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Recap"
        subtitle={weekLabel}
      />

      <section>
        <Reveal className="mb-3">
          <SectionHeader title="Share This Week" />
        </Reveal>
        <Reveal delay={0.05}>
          <div className="flex justify-center rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-6 sm:p-8">
            <RecapCard
              weekLabel={weekLabel}
              seasonYear={seasonYear}
              leagueName="Fantasy NFL"
              featured={featured}
              awards={awards}
              topScorer={topScorer}
              biggestBust={biggestBust}
              leagueAvg={leagueAvg}
            />
          </div>
        </Reveal>
      </section>

      <section>
        <Reveal className="mb-3">
          <SectionHeader title="Results" />
        </Reveal>
        {results.length === 0 ? (
          <Reveal>
            <EmptyState
              message="No matchups recorded for this week."
              action={prevSeasonAction}
            />
          </Reveal>
        ) : (
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
            {results.map((m) => (
              <StaggerItem key={m.id}>
                <MatchupCard matchup={m} tag={m.tag} revealed={revealed} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      <section>
        <Reveal className="mb-3">
          <SectionHeader title="Awards" />
        </Reveal>
        {awards.length === 0 ? (
          <Reveal>
            <EmptyState
              message="No awards recorded for this week."
              action={prevSeasonAction}
            />
          </Reveal>
        ) : (
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
            {awards.map((a, i) => (
              <StaggerItem key={`${a.type}-${i}`}>
                <AwardBadge award={a} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      {powerRows.length > 0 && (
        <section>
          <Reveal className="mb-3">
            <SectionHeader title="Power Rankings" />
          </Reveal>
          <Reveal delay={0.05}>
            <PowerBlurbs rows={powerRows} />
          </Reveal>
        </section>
      )}

      <section>
        <Reveal>
          <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
            <CardHeader className="border-b border-zinc-800 pb-3">
              <CardTitle className="font-display">Luck Meter</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="mb-4 text-xs text-zinc-500">
                Luck = actual wins minus expected wins. Positive means a team outperformed
                its projected win total.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {luck.map((l) => (
                  <LuckMeter key={l.id} luck={l} maxAbs={maxAbs} />
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </section>
    </div>
  );
}
