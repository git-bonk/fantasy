import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { WeekSelector } from "@/components/WeekSelector";
import { AwardBadge } from "@/components/cards/AwardBadge";
import { LuckMeter } from "@/components/cards/LuckMeter";
import { MatchupCard } from "@/components/cards/MatchupCard";
import { RecapCard } from "@/components/cards/RecapCard";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import {
  getRecapAwards,
  getRecapLuck,
  getSeasons,
  getTopPerformers,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { getRecapMatchups } from "@/lib/recap";
import type { RecapMatchupRow } from "@/lib/types";

interface RecapPageProps {
  searchParams: Promise<{ year?: string; week?: string }>;
}

export default async function RecapPage({ searchParams }: RecapPageProps) {
  const ctx = await resolveSeason(searchParams);
  const { seasonId, weekNum, weeks, maxWeek } = ctx;

  const results = getRecapMatchups(seasonId, weekNum);
  const awards = getRecapAwards(seasonId, weekNum);
  const luck = getRecapLuck(seasonId, weekNum);
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
  const topScorer = getTopPerformers(seasonId, weekNum)[0] ?? null;
  const biggestBust = awards.find((a) => a.type === "BIGGEST_BUST") ?? null;
  const seasonYear =
    getSeasons().find((s) => s.id === seasonId)?.year ?? new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Weekly Recap"
        subtitle={weekLabel}
        action={<WeekSelector weeks={weeks} current={weekNum} />}
      />

      <section>
        <Reveal>
          <h2 className="mb-3 font-display text-sm font-semibold tracking-widest text-zinc-500 uppercase">
            Share This Week
          </h2>
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
        <Reveal>
          <h2 className="mb-3 font-display text-sm font-semibold tracking-widest text-zinc-500 uppercase">
            Results
          </h2>
        </Reveal>
        {results.length === 0 ? (
          <Reveal>
            <p className="py-8 text-center text-sm text-zinc-500">
              No matchups recorded for this week.
            </p>
          </Reveal>
        ) : (
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
            {results.map((m) => (
              <StaggerItem key={m.id}>
                <MatchupCard matchup={m} tag={m.tag} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      <section>
        <Reveal>
          <h2 className="mb-3 font-display text-sm font-semibold tracking-widest text-zinc-500 uppercase">
            Awards
          </h2>
        </Reveal>
        {awards.length === 0 ? (
          <Reveal>
            <p className="py-8 text-center text-sm text-zinc-500">
              No awards recorded for this week.
            </p>
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
