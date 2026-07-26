"use client";

import { SeasonSelector } from "@/components/SeasonSelector";
import { WeekSelector } from "@/components/WeekSelector";
import { useSeason } from "@/lib/season-context";
import type { Season, Week } from "@/lib/types";

interface TopbarControlsProps {
  seasons: Season[];
  /** Server-resolved fallbacks (from cookies) */
  serverYear: number;
  serverWeek: number;
  maxWeeks: Record<number, number>;
  weeksByYear: Record<number, Week[]>;
}

export function TopbarControls({
  seasons,
  serverYear,
  serverWeek,
  maxWeeks,
  weeksByYear,
}: TopbarControlsProps) {
  const { year, week } = useSeason();

  // Prefer URL params (from context) over cookie-based server values
  const currentYear = year ?? serverYear;
  const currentWeek = week ?? serverWeek;
  const weeks = weeksByYear[currentYear] ?? weeksByYear[serverYear] ?? [];

  return (
    <div className="flex items-center gap-2">
      <SeasonSelector
        seasons={seasons}
        currentYear={currentYear}
        maxWeeks={maxWeeks}
      />
      <WeekSelector weeks={weeks} current={currentWeek} />
    </div>
  );
}
