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
import type { Week } from "@/lib/types";

interface WeekSelectorProps {
  weeks: Week[];
  current: number;
}

export function WeekSelector({ weeks, current }: WeekSelectorProps) {
  const { setWeek } = useSeason();

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
