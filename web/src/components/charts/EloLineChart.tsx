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
import type { EloHistoryRow } from "@/lib/types";
import { ChartTooltip } from "./ChartTooltip";

interface EloLineChartProps {
  history: EloHistoryRow[];
  height?: number;
}

export function EloLineChart({ history, height = 340 }: EloLineChartProps) {
  const weeks = [...new Set(history.map((h) => h.week_num))].sort((a, b) => a - b);
  const teamIds = [...new Set(history.map((h) => h.id))];

  const colorById = new Map<number, string>();
  const nameById = new Map<number, string>();
  for (const h of history) {
    colorById.set(h.id, h.color);
    nameById.set(h.id, h.name);
  }

  const data = weeks.map((week) => {
    const row: Record<string, number | string> = { week };
    for (const h of history) {
      if (h.week_num === week) {
        row[String(h.id)] = Number(h.rating.toFixed(1));
      }
    }
    return row;
  });

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={1}
          />
          <YAxis
            domain={["dataMin - 25", "dataMax + 25"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            content={<ChartTooltip valueDecimals={0} />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          />
          {teamIds.map((id) => (
            <Line
              key={id}
              type="monotone"
              dataKey={String(id)}
              name={nameById.get(id)}
              stroke={colorById.get(id)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0 }}
              animationDuration={900}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
