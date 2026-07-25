import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { WeekSelector } from "@/components/WeekSelector";
import { AwardBadge } from "@/components/cards/AwardBadge";
import { LuckMeter } from "@/components/cards/LuckMeter";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import {
  getLatestSeasonId,
  getRecapAwards,
  getRecapLuck,
  getMaxWeek,
  getWeeks,
} from "@/lib/queries";

interface RecapPageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function RecapPage({ searchParams }: RecapPageProps) {
  const seasonId = getLatestSeasonId();
  const weeks = getWeeks(seasonId);
  const maxWeek = getMaxWeek(seasonId);
  const params = await searchParams;
  const weekNum = Math.min(Math.max(Number(params.week) || maxWeek, 1), maxWeek);

  const awards = getRecapAwards(seasonId, weekNum);
  const luck = getRecapLuck(seasonId, weekNum);
  const maxAbs = Math.max(...luck.map((l) => Math.abs(l.luck_score)), 0.01);
  const weekLabel = weeks.find((w) => w.week_num === weekNum)?.label ?? `Week ${weekNum}`;

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
