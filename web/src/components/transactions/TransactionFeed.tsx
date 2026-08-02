"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { PlayerLink } from "@/components/links/PlayerLink";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import type { TransactionFeedRow } from "@/lib/queries";

interface TransactionFeedProps {
  transactions: TransactionFeedRow[];
  year: number;
}

interface WeekGroup {
  weekNum: number;
  label: string;
  items: TransactionFeedRow[];
}

const TYPE_LABELS: Record<string, string> = {
  ADD: "ADD",
  DROP: "DROP",
  TRADE_IN: "TRADE IN",
  TRADE_OUT: "TRADE OUT",
};

const NAV_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-emerald-400 disabled:pointer-events-none disabled:opacity-30";

function isIncoming(type: string): boolean {
  return type === "ADD" || type === "TRADE_IN";
}

function shortLabel(label: string): string {
  return label.replace(/^Week\s+/i, "W");
}

function groupByWeek(transactions: TransactionFeedRow[]): WeekGroup[] {
  const groups: WeekGroup[] = [];
  for (const tx of transactions) {
    const last = groups[groups.length - 1];
    if (last && last.weekNum === tx.week_num) {
      last.items.push(tx);
    } else {
      groups.push({ weekNum: tx.week_num, label: tx.week_label, items: [tx] });
    }
  }
  return groups.reverse();
}

export function TransactionFeed({ transactions, year }: TransactionFeedProps) {
  const reduce = useReducedMotion();
  const groups = groupByWeek(transactions);
  const [selected, setSelected] = useState(Math.max(0, groups.length - 1));
  const group = groups[selected];

  if (!group) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous week"
            className={NAV_BUTTON}
            disabled={selected === 0}
            onClick={() => setSelected((s) => Math.max(0, s - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-28 text-center">
            <Link
              href={`/scores?year=${year}&week=${group.weekNum}`}
              className="font-display text-sm font-semibold tracking-tight transition-colors hover:text-emerald-400"
            >
              {group.label}
            </Link>
            <div className="text-[11px] text-muted-foreground">
              {group.items.length} move{group.items.length === 1 ? "" : "s"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Next week"
            className={NAV_BUTTON}
            disabled={selected === groups.length - 1}
            onClick={() => setSelected((s) => Math.min(groups.length - 1, s + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex max-w-full flex-wrap gap-1">
          {groups.map((g, i) => (
            <button
              key={g.weekNum}
              type="button"
              onClick={() => setSelected(i)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums transition-colors",
                i === selected
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
              )}
            >
              {shortLabel(g.label)}
            </button>
          ))}
        </div>
      </div>

      {reduce ? (
        <div className="space-y-2">
          {group.items.map((tx, i) => (
            <TransactionItem key={`${tx.week_num}-${tx.player_name}-${i}`} tx={tx} />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={group.weekNum}
            className="space-y-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {group.items.map((tx, i) => (
              <TransactionItem key={`${tx.week_num}-${tx.player_name}-${i}`} tx={tx} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
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
          <PlayerLink
            playerId={tx.player_id}
            className="truncate text-sm font-medium transition-colors hover:text-emerald-400"
          >
            {tx.player_name ?? "Unknown player"}
          </PlayerLink>
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
