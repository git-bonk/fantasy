import { Skull } from "lucide-react";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import type { ShameItem } from "@/lib/types";

interface ShameCornerProps {
  items: ShameItem[];
}

export function ShameCorner({ items }: ShameCornerProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <Reveal>
        <div className="flex items-center gap-2">
          <Skull className="h-6 w-6 text-rose-400" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-rose-300">
            The Shame Corner
          </h2>
        </div>
        <p className="mt-1 text-sm text-zinc-400">Every league has one. This is yours.</p>
      </Reveal>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.05}>
        {items.map((item) => (
          <StaggerItem key={item.kind}>
            <div className="flex h-full flex-col rounded-xl border border-rose-500/20 bg-rose-950/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold tracking-widest text-rose-400/80 uppercase">
                  {item.label}
                </p>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                  style={{ backgroundColor: `${item.color}1f`, color: item.color }}
                >
                  {item.abbrev}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <CountUp
                  value={item.value}
                  decimals={item.kind === "LONGEST_LOSING_STREAK" ? 0 : 1}
                  className="font-display text-4xl font-bold tabular-nums text-rose-300"
                />
                <span className="text-xs font-medium tracking-wider text-rose-400/70 uppercase">
                  {item.suffix}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-200">{item.headline}</p>
              <p className="pt-2 text-xs text-zinc-500">{item.detail}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
