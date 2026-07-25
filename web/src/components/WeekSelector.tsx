"use client";

import { usePathname, useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Week } from "@/lib/types";

interface WeekSelectorProps {
  weeks: Week[];
  current: number;
}

export function WeekSelector({ weeks, current }: WeekSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (value: number | null) => {
    if (value === null) return;
    const params = new URLSearchParams(window.location.search);
    params.set("week", String(value));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="min-w-36">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {weeks.map((w) => (
          <SelectItem key={w.week_num} value={w.week_num}>
            {w.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
