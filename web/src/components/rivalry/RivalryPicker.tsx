"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TeamStandingRow } from "@/lib/types";

interface RivalryPickerProps {
  teams: TeamStandingRow[];
  a: number;
  b: number;
}

export function RivalryPicker({ teams, a, b }: RivalryPickerProps) {
  const router = useRouter();

  const push = (nextA: number, nextB: number) => {
    router.push(`/rivalry?a=${nextA}&b=${nextB}`);
  };

  const handleA = (value: number | null) => {
    if (value === null) return;
    push(value, b);
  };

  const handleB = (value: number | null) => {
    if (value === null) return;
    push(a, value);
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
          Team A
        </span>
        <Select value={a} onValueChange={handleA}>
          <SelectTrigger className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id} disabled={t.id === b}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="pb-2 font-display text-sm font-bold text-zinc-600">VS</span>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
          Team B
        </span>
        <Select value={b} onValueChange={handleB}>
          <SelectTrigger className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id} disabled={t.id === a}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
