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
import type { TrendRow } from "@/lib/types";
import { ChartTooltip } from "./ChartTooltip";

interface PointsTrendProps {
  data: TrendRow[];
  height?: number;
  color?: string;
}

export function PointsTrend({ data, height = 280, color = "#10b981" }: PointsTrendProps) {
  const rows = data.map((d) => ({ week: d.week_num, avg: Number(d.avg_pts.toFixed(1)) }));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="pts-trend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={1}
          />
          <YAxis
            domain={["dataMin - 8", "dataMax + 8"]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            content={<ChartTooltip valueSuffix=" pts" valueDecimals={1} />}
            cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="avg"
            name="League avg"
            stroke={color}
            strokeWidth={2}
            fill="url(#pts-trend)"
            activeDot={{ r: 4, strokeWidth: 0 }}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
