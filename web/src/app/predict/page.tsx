import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { WeekSelector } from "@/components/WeekSelector";
import { WinProbBar } from "@/components/charts/WinProbBar";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import {
  getPredictData,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { fmtPts } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PredictMatchupRow } from "@/lib/types";

function eloToProb(homeElo: number, awayElo: number): number {
  return 1 / (1 + 10 ** ((awayElo - homeElo) / 400));
}

interface PredictPageProps {
  searchParams: Promise<{ year?: string; week?: string }>;
}

export default async function PredictPage({ searchParams }: PredictPageProps) {
  const ctx = await resolveSeason(searchParams);
  const { seasonId, weeks, maxWeek } = ctx;
  const weekNum = Math.max(ctx.weekNum, 2);

  const matchups = getPredictData(seasonId, weekNum).filter(
    (m): m is PredictMatchupRow & { h_elo: number; a_elo: number } =>
      m.h_elo !== null && m.a_elo !== null
  );

  const withProbs = matchups.map((m) => {
    const homeProb = eloToProb(m.h_elo, m.a_elo);
    const favoriteIsHome = homeProb >= 0.5;
    const favoriteId = favoriteIsHome ? m.hid : m.aid;
    const correct = m.winner_team_id === favoriteId;
    return { ...m, homeProb, correct };
  });

  const correctCount = withProbs.filter((m) => m.correct).length;
  const weekLabel = weeks.find((w) => w.week_num === weekNum)?.label ?? `Week ${weekNum}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Predictions"
        subtitle={`${weekLabel} · predicted vs. actual`}
        action={<WeekSelector weeks={weeks} current={weekNum} />}
      />

      {withProbs.length === 0 ? (
        <Reveal>
          <p className="py-16 text-center text-sm text-zinc-500">
            No prediction data available for this week.
          </p>
        </Reveal>
      ) : (
        <>
          <Reveal>
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <span className="font-display text-2xl font-bold tabular-nums text-emerald-500">
                {correctCount}/{withProbs.length}
              </span>
              <p className="text-sm text-zinc-400">
                favorites correctly predicted by the Elo model this week
              </p>
            </div>
          </Reveal>

          <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-2" stagger={0.05}>
            {withProbs.map((m) => (
              <StaggerItem key={m.id}>
                <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-colors hover:border-zinc-700">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span style={{ color: m.acolor }}>{m.aabb}</span>
                        <span className="text-zinc-600">@</span>
                        <span style={{ color: m.hcolor }}>{m.habb}</span>
                      </div>
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          m.correct
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-rose-500/10 text-rose-500"
                        )}
                      >
                        {m.correct ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        {m.correct ? "Hit" : "Miss"}
                      </span>
                    </div>

                    <WinProbBar
                      homeProb={m.homeProb}
                      homeColor={m.hcolor}
                      awayColor={m.acolor}
                      homeAbbrev={m.habb}
                      awayAbbrev={m.aabb}
                    />

                    <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
                      <span className="text-[11px] tracking-wider text-zinc-500 uppercase">
                        Final
                      </span>
                      <span className="font-mono text-sm font-bold tabular-nums">
                        <span style={{ color: m.acolor }}>{fmtPts(m.away_score)}</span>
                        <span className="mx-2 text-zinc-600">–</span>
                        <span style={{ color: m.hcolor }}>{fmtPts(m.home_score)}</span>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}
    </div>
  );
}
