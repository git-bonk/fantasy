import { cn } from "@/lib/utils";

const positionStyles: Record<string, string> = {
  QB: "bg-rose-500/15 text-rose-400",
  RB: "bg-emerald-500/15 text-emerald-400",
  WR: "bg-sky-500/15 text-sky-400",
  TE: "bg-orange-500/15 text-orange-400",
  K: "bg-violet-500/15 text-violet-400",
  DEF: "bg-zinc-500/20 text-zinc-300",
};

interface PositionBadgeProps {
  position: string;
  className?: string;
}

export function PositionBadge({ position, className }: PositionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-9 items-center justify-center rounded-md text-[11px] font-bold",
        positionStyles[position] ?? "bg-zinc-500/20 text-zinc-300",
        className
      )}
    >
      {position}
    </span>
  );
}
