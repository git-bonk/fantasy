"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface OddsBarProps {
  odds: number | null;
  inPlayoffs: boolean;
}

export function OddsBar({ odds, inPlayoffs }: OddsBarProps) {
  const pct = odds == null ? 0 : Math.round(odds * 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:w-20">
        <motion.div
          className={cn("h-full rounded-full", inPlayoffs ? "bg-emerald-500" : "bg-zinc-600")}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span
        className={cn(
          "w-9 text-right font-mono text-xs font-semibold tabular-nums",
          inPlayoffs ? "text-emerald-400" : "text-muted-foreground"
        )}
      >
        {pct}%
      </span>
    </div>
  );
}
