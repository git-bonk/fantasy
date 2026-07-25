import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CountUp } from "@/components/motion/CountUp";
import { Sparkline } from "@/components/charts/Sparkline";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  icon: LucideIcon;
  accent?: string;
  sub?: string;
  spark?: number[];
  sparkId?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  icon: Icon,
  accent = "#10b981",
  sub,
  spark,
  sparkId,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
            {label}
          </p>
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
        <CountUp
          value={value}
          decimals={decimals}
          prefix={prefix}
          suffix={suffix}
          className="mt-2 block font-display text-3xl font-bold tracking-tight tabular-nums"
        />
        {sub && <p className="mt-1 truncate text-xs text-zinc-400">{sub}</p>}
        {spark && sparkId && (
          <div className="mt-2 -mb-1">
            <Sparkline data={spark} color={accent} id={sparkId} height={36} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
