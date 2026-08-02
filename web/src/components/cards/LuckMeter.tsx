"use client";

import { motion, useReducedMotion } from "framer-motion";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import type { LuckRow } from "@/lib/types";

interface LuckMeterProps {
  luck: LuckRow;
  maxAbs: number;
  className?: string;
}

export function LuckMeter({ luck, maxAbs, className }: LuckMeterProps) {
  const reduce = useReducedMotion();
  const normalized = maxAbs > 0 ? luck.luck_score / maxAbs : 0;
  const isLucky = luck.luck_score >= 0;
  const halfPct = Math.min(Math.abs(normalized) * 50, 50);
  const color = isLucky ? "#10b981" : "#f43f5e";

  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 transition-colors hover:border-zinc-700",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-display text-[10px] font-bold"
          style={{ backgroundColor: `${luck.color}1f`, color: luck.color }}
        >
          {luck.name.slice(0, 3).toUpperCase()}
        </span>
        <TeamLink
          teamId={luck.id}
          className="min-w-0 flex-1 truncate text-sm font-semibold transition-colors hover:text-emerald-400"
        >
          {luck.name}
        </TeamLink>
        <span
          className="font-mono text-sm font-bold tabular-nums"
          style={{ color }}
        >
          {isLucky ? "+" : ""}
          {luck.luck_score.toFixed(2)}
        </span>
      </div>

      <div className="relative mt-2.5 h-1.5 w-full rounded-full bg-zinc-800">
        <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-zinc-600" />
        <motion.div
          className="absolute top-0 h-full rounded-full"
          style={{
            backgroundColor: color,
            left: isLucky ? "50%" : `${50 - halfPct}%`,
          }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${halfPct}%` }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
        <span>
          Actual{" "}
          <span className="font-mono font-semibold tabular-nums text-zinc-400">
            {luck.actual_wins.toFixed(1)}
          </span>
        </span>
        <span>
          Expected{" "}
          <span className="font-mono font-semibold tabular-nums text-zinc-400">
            {luck.expected_wins.toFixed(1)}
          </span>
        </span>
      </div>
    </div>
  );
}
