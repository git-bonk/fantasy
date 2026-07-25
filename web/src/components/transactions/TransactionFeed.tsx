import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import type { TransactionRow } from "@/lib/types";

interface TransactionFeedProps {
  transactions: TransactionRow[];
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function groupByMonth(transactions: TransactionRow[]): { month: string; items: TransactionRow[] }[] {
  const groups: { month: string; items: TransactionRow[] }[] = [];
  for (const tx of transactions) {
    const key = monthKey(tx.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.month === key) {
      last.items.push(tx);
    } else {
      groups.push({ month: key, items: [tx] });
    }
  }
  return groups;
}

export function TransactionFeed({ transactions }: TransactionFeedProps) {
  const groups = groupByMonth(transactions);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.month}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {group.month}
            </h3>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {group.items.map((tx, i) => (
              <TransactionItem key={`${tx.occurred_at}-${tx.player_name}-${i}`} tx={tx} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TransactionItem({ tx }: { tx: TransactionRow }) {
  const isAdd = tx.type === "ADD";
  const Icon = isAdd ? ArrowUpCircle : ArrowDownCircle;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 transition-colors hover:border-zinc-700">
      <Icon
        className={cn("h-5 w-5 shrink-0", isAdd ? "text-emerald-400" : "text-rose-400")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              isAdd ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
            )}
          >
            {tx.type}
          </span>
          <span className="truncate text-sm font-medium">
            {tx.player_name ?? "Unknown player"}
          </span>
        </div>
        {tx.tname && (
          <div className="mt-0.5 flex items-center gap-1.5">
            {tx.color && (
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tx.color }} />
            )}
            <span className="truncate text-xs text-muted-foreground">{tx.tname}</span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {isAdd && tx.bid_amount != null && tx.bid_amount > 0 && (
          <span className="font-mono text-sm font-bold tabular-nums text-amber-400">
            ${tx.bid_amount}
          </span>
        )}
        <span className="text-xs tabular-nums text-muted-foreground">{fmtDate(tx.occurred_at)}</span>
      </div>
    </div>
  );
}
