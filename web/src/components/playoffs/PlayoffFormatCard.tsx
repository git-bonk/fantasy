import type { LucideIcon } from "lucide-react";
import { ListOrdered, Repeat, Shield, Trophy, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PlayoffFormat } from "@/lib/types";

const SEEDING_LABELS: Record<string, string> = {
  TOTAL_POINTS_SCORED: "Total points scored",
  H2H_RECORD: "Head-to-head record",
  DIVISION_RECORD: "Division record",
  POINTS_FOR: "Total points scored",
};

function seedingLabel(rule: string | null): string {
  if (!rule) return "League standings";
  return SEEDING_LABELS[rule] ?? rule.replace(/_/g, " ").toLowerCase();
}

interface FactProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

function Fact({ icon: Icon, label, value }: FactProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function PlayoffFormatCard({ format }: { format: PlayoffFormat }) {
  const facts: FactProps[] = [
    { icon: Users, label: "Field", value: `${format.team_count} teams qualify` },
    { icon: ListOrdered, label: "Seeding", value: seedingLabel(format.seeding_rule) },
    {
      icon: Repeat,
      label: "Bracket",
      value: format.reseeding ? "Reseeded each round" : "Fixed (no reseeding)",
    },
    {
      icon: Trophy,
      label: "Rounds",
      value: format.start_week
        ? `${format.rounds} rounds · starts week ${format.start_week}`
        : `${format.rounds} rounds`,
    },
  ];
  if (format.consolation_ladder) {
    facts.push({ icon: Shield, label: "Consolation", value: "Ladder enabled" });
  }

  return (
    <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
      <CardContent className="p-4">
        <p className="mb-4 text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
          Playoff Format
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f) => (
            <Fact key={f.label} {...f} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
