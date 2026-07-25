import {
  Crown,
  Flame,
  Scale,
  ThumbsDown,
  Dices,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtPts } from "@/lib/format";
import type { RecapAwardRow } from "@/lib/types";

export const AWARD_META: Record<
  string,
  { icon: LucideIcon; label: string; color: string }
> = {
  TOP_SCORE: { icon: Flame, label: "Top Score", color: "#fbbf24" },
  BIGGEST_BUST: { icon: ThumbsDown, label: "Biggest Bust", color: "#f43f5e" },
  CLOSEST_FINISH: { icon: Scale, label: "Closest Finish", color: "#38bdf8" },
  BIGGEST_UPSET: { icon: Zap, label: "Biggest Upset", color: "#f97316" },
  LUCKIEST: { icon: Dices, label: "Luckiest", color: "#10b981" },
  TOP_PLAYER: { icon: Crown, label: "Top Player", color: "#eab308" },
};

interface AwardBadgeProps {
  award: RecapAwardRow;
  className?: string;
}

export function AwardBadge({ award, className }: AwardBadgeProps) {
  const meta = AWARD_META[award.type] ?? {
    icon: Crown,
    label: award.type,
    color: "#a1a1aa",
  };
  const Icon = meta.icon;

  return (
    <Card
      className={cn(
        "border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700",
        className
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: meta.color }}
          >
            {meta.label}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            {award.tname ?? award.player_name ?? "—"}
          </p>
          {award.detail && (
            <p className="truncate text-xs text-zinc-500">{award.detail}</p>
          )}
        </div>
        {award.value !== null && (
          <span className="shrink-0 font-display text-xl font-bold tabular-nums text-foreground">
            {fmtPts(award.value)}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
