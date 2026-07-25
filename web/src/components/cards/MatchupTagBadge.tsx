import {
  Crown,
  Flame,
  RotateCcw,
  Scale,
  ThumbsDown,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { MatchupTag } from "@/lib/types";

const TAG_META: Record<MatchupTag, { icon: LucideIcon; label: string; color: string }> = {
  UPSET: { icon: Zap, label: "Upset", color: "#f97316" },
  NAIL_BITER: { icon: Scale, label: "Nail-biter", color: "#38bdf8" },
  BLOWOUT: { icon: Flame, label: "Blowout", color: "#f43f5e" },
  STATEMENT: { icon: Crown, label: "Statement", color: "#fbbf24" },
  REVENGE: { icon: RotateCcw, label: "Revenge", color: "#a855f7" },
  BUST: { icon: ThumbsDown, label: "Bust", color: "#ef4444" },
  SHOOTOUT: { icon: TrendingUp, label: "Shootout", color: "#10b981" },
};

interface MatchupTagBadgeProps {
  tag: MatchupTag;
}

export function MatchupTagBadge({ tag }: MatchupTagBadgeProps) {
  const meta = TAG_META[tag];
  const Icon = meta.icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
