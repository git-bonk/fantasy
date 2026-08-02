import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import type { TransactionFeedRow } from "@/lib/queries";

interface TransactionFeedProps {
  transactions: TransactionFeedRow[];
}

const TYPE_LABELS: Record<string, string> = {
  ADD: "ADD",
  DROP: "DROP",
  TRADE_IN: "TRADE IN",
  TRADE_OUT: "TRADE OUT",
};

function isIncoming(type: string): boolean {
  return type === "ADD" || type === "TRADE_IN";
}

function groupByWeek(
  transactions: TransactionFeedRow[]
): { weekNum: number; label: string; items: TransactionFeedRow[] }[] {
  const groups: { weekNum: number; label: string; items: TransactionFeedRow[] }[] = [];
  for (const tx of transactions) {
    const last = groups[groups.length - 1];
    if (last && last.weekNum === tx.week_num) {
      last.items.push(tx);
    } else {
      groups.push({ weekNum: tx.week_num, label: tx.week_label, items: [tx] });
    }
  }
  return groups;
}

export function TransactionFeed({ transactions }: TransactionFeedProps) {
  const groups = groupByWeek(transactions);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.weekNum}>
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h3>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {group.items.map((tx, i) => (
              <TransactionItem key={`${tx.week_num}-${tx.player_name}-${i}`} tx={tx} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TransactionItem({ tx }: { tx: TransactionFeedRow }) {
  const incoming = isIncoming(tx.type);
  const Icon = incoming ? ArrowUpCircle : ArrowDownCircle;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 transition-colors hover:border-zinc-700">
      <Icon
        className={cn("h-5 w-5 shrink-0", incoming ? "text-emerald-400" : "text-rose-400")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              incoming ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
            )}
          >
            {TYPE_LABELS[tx.type] ?? tx.type}
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
            {tx.team_id != null ? (
              <TeamLink
                teamId={tx.team_id}
                className="truncate text-xs text-muted-foreground transition-colors hover:text-emerald-400"
              >
                {tx.tname}
              </TeamLink>
            ) : (
              <span className="truncate text-xs text-muted-foreground">{tx.tname}</span>
            )}
          </div>
        )}
      </div>
      {tx.bid_amount != null && tx.bid_amount > 0 && (
        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-amber-400">
          ${tx.bid_amount}
        </span>
      )}
    </div>
  );
}
