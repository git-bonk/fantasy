import Link from "next/link";
import {
  getDraft,
  getDraftValue,
  getSeasons,
  roundValues,
  teamBestWorst,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DraftBoard } from "@/components/draft/DraftBoard";
import { BestWorstCards } from "@/components/draft/BestWorstCards";
import { RoundValueChart } from "@/components/draft/RoundValueChart";
import { Reveal } from "@/components/motion/Reveal";

const EMPTY_ACTION =
  "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-emerald-400";

export default async function DraftPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const [picks, value] = await Promise.all([getDraft(seasonId), getDraftValue(seasonId)]);
  const bestWorst = teamBestWorst(value);
  const rounds = roundValues(value);
  const prevSeason = getSeasons().find((s) => s.year < ctx.year);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Draft"
        subtitle="Draft day retrospective: the full board, every team's steals and busts, and where the value was found."
      />

      {picks.length === 0 ? (
        <Reveal delay={0.05}>
          <EmptyState
            message="No draft data for this season yet."
            action={
              prevSeason && (
                <Link href={`/draft?year=${prevSeason.year}`} className={EMPTY_ACTION}>
                  View {prevSeason.year} draft
                </Link>
              )
            }
          />
        </Reveal>
      ) : (
        <Reveal delay={0.05}>
          <Tabs defaultValue="board">
            <TabsList>
              <TabsTrigger value="board">Board</TabsTrigger>
              {bestWorst.length > 0 && (
                <TabsTrigger value="best-worst">Steals & busts</TabsTrigger>
              )}
              {rounds.length > 0 && (
                <TabsTrigger value="round-value">Value by round</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="board" className="mt-4 space-y-4">
              <SectionHeader title="Draft board" />
              <DraftBoard picks={picks} />
            </TabsContent>
            {bestWorst.length > 0 && (
              <TabsContent value="best-worst" className="mt-4 space-y-4">
                <SectionHeader
                  title="Steals & busts"
                  description="Each team's best and worst pick, by points produced versus the round's average."
                />
                <BestWorstCards teams={bestWorst} />
              </TabsContent>
            )}
            {rounds.length > 0 && (
              <TabsContent value="round-value" className="mt-4 space-y-4">
                <SectionHeader
                  title="Value by round"
                  description="Average season points produced by picks in each round."
                />
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <RoundValueChart data={rounds} />
                </div>
              </TabsContent>
            )}
          </Tabs>
        </Reveal>
      )}
    </div>
  );
}
