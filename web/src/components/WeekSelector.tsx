"use client";

import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSeason } from "@/lib/season-context";
import type { Week } from "@/lib/types";

interface WeekSelectorProps {
  weeks: Week[];
  current: number;
  applies?: boolean;
  mutedLabel?: string;
}

export function WeekSelector({
  weeks,
  current,
  applies = true,
  mutedLabel = "Full season",
}: WeekSelectorProps) {
  const { setWeek } = useSeason();

  if (!applies) {
    return (
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={`Week selector inactive — ${mutedLabel}`}
          className="flex h-8 w-fit min-w-36 cursor-default items-center gap-1.5 rounded-lg border border-input/60 bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap text-muted-foreground opacity-80 select-none dark:bg-input/20"
        >
          <Calendar className="h-4 w-4" />
          <span className="flex flex-1 text-left">{mutedLabel}</span>
        </TooltipTrigger>
        <TooltipContent>
          The week selector has no effect on this page.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Select
      value={String(current)}
      onValueChange={(v: string | null) => {
        if (v !== null) setWeek(Number(v));
      }}
    >
      <SelectTrigger className="min-w-36">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {weeks.map((w) => (
          <SelectItem key={w.week_num} value={String(w.week_num)}>
            {w.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
