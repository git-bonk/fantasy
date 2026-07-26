"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OwnerEloHistoryRow } from "@/lib/types";

interface OwnerTooltipProps {
  active?: boolean;
  payload?: { payload: { label: string; rating: number } }[];
}

function OwnerTooltip({ active, payload }: OwnerTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl ring-1 ring-foreground/10">
      <p className="font-display text-xs font-semibold tracking-wide text-muted-foreground">
        {point.label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
        {Math.round(point.rating)}
      </p>
    </div>
  );
}

interface OwnerEloChartProps {
  history: OwnerEloHistoryRow[];
  color?: string;
  height?: number;
}

export function OwnerEloChart({ history, color = "#10b981", height = 300 }: OwnerEloChartProps) {
  const data = history.map((h, i) => ({
    idx: i,
    rating: Number(h.rating.toFixed(1)),
    label: `${h.year} \u00b7 W${h.week_num}`,
  }));

  const seasonStarts = history.reduce<number[]>((acc, h, i) => {
    if (i === 0 || history[i - 1].year !== h.year) acc.push(i);
    return acc;
  }, []);
  const yearByIdx = new Map(history.map((h, i) => [i, h.year]));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="idx"
            ticks={seasonStarts}
            tickFormatter={(idx: number) => String(yearByIdx.get(idx) ?? "")}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            domain={["dataMin - 25", "dataMax + 25"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            content={<OwnerTooltip />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          />
          <Line
            type="monotone"
            dataKey="rating"
            name="Elo"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            animationDuration={900}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
