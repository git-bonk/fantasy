import Link from "next/link";
import {
  getSeasons,
  getTopMoves,
  getTradeGrades,
  getTransactions,
  getWaiverLeaderboard,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { PageHeader } from "@/components/PageHeader";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionFeed } from "@/components/transactions/TransactionFeed";
import { TradeGrades } from "@/components/transactions/TradeGrades";
import { WaiverImpact } from "@/components/transactions/WaiverImpact";
import { Reveal } from "@/components/motion/Reveal";

const EMPTY_ACTION =
  "inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-emerald-400";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const [transactions, trades, topMoves, leaderboard] = await Promise.all([
    getTransactions(seasonId),
    getTradeGrades(seasonId),
    getTopMoves(seasonId),
    getWaiverLeaderboard(seasonId),
  ]);

  const noWaiver =
    topMoves.gems.length === 0 && topMoves.regrets.length === 0 && leaderboard.length === 0;
  const isEmpty = transactions.length === 0 && trades.length === 0 && noWaiver;
  const prevSeason = getSeasons().find((s) => s.year < ctx.year);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Transactions"
        subtitle="Waiver wire moves and roster changes across the season."
      />

      {isEmpty ? (
        <Reveal delay={0.05}>
          <EmptyState
            message="No transactions recorded this season."
            action={
              prevSeason && (
                <Link href={`/transactions?year=${prevSeason.year}`} className={EMPTY_ACTION}>
                  View {prevSeason.year} season
                </Link>
              )
            }
          />
        </Reveal>
      ) : (
        <Reveal delay={0.05}>
          <Tabs defaultValue="trade-grades">
            <TabsList>
              <TabsTrigger value="trade-grades">Trade grades</TabsTrigger>
              <TabsTrigger value="waiver-impact">Waiver impact</TabsTrigger>
              <TabsTrigger value="feed">Feed</TabsTrigger>
            </TabsList>
            <TabsContent value="trade-grades" className="mt-4 space-y-4">
              <SectionHeader
                title="Trade grades"
                description="Who won each deal, by points the received players produced over the next four weeks."
              />
              <TradeGrades trades={trades} />
            </TabsContent>
            <TabsContent value="waiver-impact" className="mt-4 space-y-4">
              <SectionHeader
                title="Waiver wire impact"
                description="Stolen gems, regret drops, and each owner's net points from the wire."
              />
              <WaiverImpact moves={topMoves} leaderboard={leaderboard} />
            </TabsContent>
            <TabsContent value="feed" className="mt-4 space-y-4">
              <SectionHeader
                title="Transaction feed"
                description="Every add, drop, and trade — one week at a time."
              />
              {transactions.length > 0 ? (
                <TransactionFeed transactions={transactions} year={ctx.year} />
              ) : (
                <EmptyState message="No transactions recorded this season." />
              )}
            </TabsContent>
          </Tabs>
        </Reveal>
      )}
    </div>
  );
}
