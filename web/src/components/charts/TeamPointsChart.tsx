"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { cn } from "@/lib/utils";
import type { TeamTrendRow } from "@/lib/types";

interface TeamPointsChartProps {
  data: TeamTrendRow[];
  leagueAvg: { week: number; avg: number }[];
  height?: number;
}

export function TeamPointsChart({ data, leagueAvg, height = 300 }: TeamPointsChartProps) {
  const teams = [
    ...new Map(
      data.map((d) => [d.team_id, { id: d.team_id, name: d.name, abbrev: "", color: d.color }])
    ).values(),
  ];

  const abbrevs = new Map<number, string>();
  for (const d of data) {
    if (!abbrevs.has(d.team_id)) {
      abbrevs.set(d.team_id, d.name.slice(0, 3).toUpperCase());
    }
  }

  const [selected, setSelected] = useState(teams[0]?.id ?? 0);
  const team = teams.find((t) => t.id === selected);

  const rows = data
    .filter((d) => d.team_id === selected)
    .sort((a, b) => a.week_num - b.week_num)
    .map((d) => ({ week: d.week_num, pts: Number(d.points.toFixed(1)) }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={cn(
              "rounded-lg px-2.5 py-1 font-display text-xs font-bold transition-all",
              selected === t.id
                ? "text-zinc-950"
                : "bg-zinc-800/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            )}
            style={selected === t.id ? { backgroundColor: t.color } : undefined}
          >
            {abbrevs.get(t.id)}
          </button>
        ))}
      </div>

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval={1}
            />
            <YAxis
              domain={["dataMin - 15", "dataMax + 15"]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              content={<ChartTooltip valueSuffix=" pts" valueDecimals={1} />}
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            />
            <ReferenceLine
              y={leagueAvg.reduce((s, a) => s + a.avg, 0) / Math.max(leagueAvg.length, 1)}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
            <Line
              type="monotone"
              dataKey="pts"
              name={team?.name ?? "Team"}
              stroke={team?.color ?? "#10b981"}
              strokeWidth={2.5}
              dot={{ r: 2.5, strokeWidth: 0, fill: team?.color ?? "#10b981" }}
              activeDot={{ r: 4.5, strokeWidth: 0 }}
              animationDuration={700}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        Dashed line marks the season league average.
      </p>
    </div>
  );
}
