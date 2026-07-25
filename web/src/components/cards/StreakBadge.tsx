import { Flame, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  streak: number;
  type: "W" | "L";
  className?: string;
}

export function StreakBadge({ streak, type, className }: StreakBadgeProps) {
  if (streak < 2) return null;

  const isWin = type === "W";
  const Icon = isWin ? Flame : Snowflake;
  const hot = streak >= 4;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums",
        isWin ? "bg-amber-500/10 text-amber-500" : "bg-sky-500/10 text-sky-400",
        hot && (isWin ? "ring-1 ring-amber-500/40" : "ring-1 ring-sky-500/40"),
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {type}
      {streak}
    </span>
  );
}
