"use client";

import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSeason } from "@/lib/season-context";
import type { Season } from "@/lib/types";

interface SeasonSelectorProps {
  seasons: Season[];
  currentYear: number;
  /** maxWeek per year, so we can reset week on year change */
  maxWeeks: Record<number, number>;
}

export function SeasonSelector({ seasons, currentYear, maxWeeks }: SeasonSelectorProps) {
  const { setYear } = useSeason();

  const handleChange = (value: string | null) => {
    if (value === null) return;
    const year = Number(value);
    const maxWeek = maxWeeks[year] ?? 1;
    setYear(year, maxWeek);
  };

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
