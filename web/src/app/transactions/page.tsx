import {
  getTopMoves,
  getTradeGrades,
  getTransactions,
  getWaiverLeaderboard,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { TransactionFeed } from "@/components/transactions/TransactionFeed";
import { TradeGrades } from "@/components/transactions/TradeGrades";
import { WaiverImpact } from "@/components/transactions/WaiverImpact";
import { Reveal } from "@/components/motion/Reveal";

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

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Waiver wire moves and roster changes across the season.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        {transactions.length > 0 ? (
          <TransactionFeed transactions={transactions} />
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
            No transactions recorded this season.
          </div>
        )}
      </Reveal>

      <Reveal delay={0.1}>
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Trade grades</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Who won each deal, by points the received players produced over the next four weeks.
            </p>
          </div>
          <TradeGrades trades={trades} />
        </section>
      </Reveal>

      <Reveal delay={0.15}>
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Waiver wire impact</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Stolen gems, regret drops, and each owner&apos;s net points from the wire.
            </p>
          </div>
          <WaiverImpact moves={topMoves} leaderboard={leaderboard} />
        </section>
      </Reveal>
    </div>
  );
}
