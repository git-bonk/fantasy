"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import type { RoundValue } from "@/lib/queries";

interface RoundValueChartProps {
  data: RoundValue[];
  color?: string;
  height?: number;
}

export function RoundValueChart({ data, color = "#10b981", height = 260 }: RoundValueChartProps) {
  const rows = data.map((d) => ({
    round: d.round_num,
    avg: Number(d.avg_produced.toFixed(1)),
  }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="round"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            content={<ChartTooltip labelPrefix="Round " valueSuffix=" pts" valueDecimals={1} />}
            cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.1 }}
          />
          <Bar
            dataKey="avg"
            name="Avg produced"
            fill={color}
            radius={[4, 4, 0, 0]}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
