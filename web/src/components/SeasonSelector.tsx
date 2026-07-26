"use client";

import { Calendar, History } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSeason } from "@/lib/season-context";
import type { Season } from "@/lib/types";

interface SeasonSelectorProps {
  seasons: Season[];
  currentYear: number;
  /** maxWeek per year, so we can reset week on year change */
  maxWeeks: Record<number, number>;
  applies?: boolean;
  mutedLabel?: string;
}

export function SeasonSelector({
  seasons,
  currentYear,
  maxWeeks,
  applies = true,
  mutedLabel = "All-time",
}: SeasonSelectorProps) {
  const { setYear } = useSeason();

  const handleChange = (value: string | null) => {
    if (value === null) return;
    const year = Number(value);
    const maxWeek = maxWeeks[year] ?? 1;
    setYear(year, maxWeek);
  };

  if (!applies) {
    return (
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={`Season selector inactive — ${mutedLabel}`}
          className="flex h-8 w-fit min-w-28 cursor-default items-center gap-1.5 rounded-lg border border-input/60 bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap text-muted-foreground opacity-80 select-none dark:bg-input/20"
        >
          <History className="h-4 w-4" />
          <span className="flex flex-1 text-left">{mutedLabel}</span>
        </TooltipTrigger>
        <TooltipContent>
          The season selector has no effect on this page — it spans every season.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Select value={String(currentYear)} onValueChange={handleChange}>
      <SelectTrigger className="min-w-28">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {seasons.map((s) => (
          <SelectItem key={s.id} value={String(s.year)}>
            {s.year} Season
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
