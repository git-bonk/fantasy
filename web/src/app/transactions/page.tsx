import { getTransactions } from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { TransactionFeed } from "@/components/transactions/TransactionFeed";
import { Reveal } from "@/components/motion/Reveal";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const transactions = await getTransactions(seasonId);

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
    </div>
  );
}
