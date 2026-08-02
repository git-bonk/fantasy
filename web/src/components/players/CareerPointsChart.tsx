"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import type { SeasonPointsPoint } from "@/lib/queries/player-career";

interface CareerPointsChartProps {
  data: SeasonPointsPoint[];
  color: string;
  id: string;
  height?: number;
}

export function CareerPointsChart({ data, color, id, height = 240 }: CareerPointsChartProps) {
  const rows = data.map((d) => ({ year: d.year, pts: Number(d.points.toFixed(1)) }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id={`career-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
          />
          <YAxis
            domain={["dataMin - 15", "dataMax + 15"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            content={<ChartTooltip labelPrefix="Season " valueSuffix=" pts" valueDecimals={1} />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="pts"
            name="Points"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#career-${id})`}
            activeDot={{ r: 4.5, strokeWidth: 0 }}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
