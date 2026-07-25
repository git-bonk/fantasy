"use client";

import { motion, useReducedMotion } from "framer-motion";

interface WinProbBarProps {
  homeProb: number;
  homeColor: string;
  awayColor: string;
  homeAbbrev: string;
  awayAbbrev: string;
}

export function WinProbBar({
  homeProb,
  homeColor,
  awayColor,
  homeAbbrev,
  awayAbbrev,
}: WinProbBarProps) {
  const reduce = useReducedMotion();
  const homePct = Math.round(homeProb * 100);
  const awayPct = 100 - homePct;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
        <span className="flex items-center gap-1.5 text-foreground/80">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: awayColor }} />
          {awayAbbrev}
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {awayPct}%
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-foreground/80">
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {homePct}%
          </span>
          {homeAbbrev}
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: homeColor }} />
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-l-full"
          style={{ backgroundColor: awayColor }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${awayPct}%` }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        />
        <motion.div
          className="h-full rounded-r-full"
          style={{ backgroundColor: homeColor }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${homePct}%` }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
        />
      </div>
    </div>
  );
}
