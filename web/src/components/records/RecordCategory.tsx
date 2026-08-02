import { Crown, Flame, TrendingDown, Zap, Star, Repeat, Medal, type LucideIcon } from "lucide-react";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import type { RecordRow } from "@/lib/types";

function RecordLabel({ record }: { record: RecordRow }) {
  const text = record.detail ?? record.player_name;
  if (record.team_id != null) {
    return (
      <TeamLink teamId={record.team_id} className="transition-colors hover:text-emerald-400">
        {text}
      </TeamLink>
    );
  }
  return <>{text}</>;
}

interface CategoryConfig {
  title: string;
  icon: LucideIcon;
  suffix: string;
  decimals: number;
}

const categoryConfig: Record<string, CategoryConfig> = {
  SINGLE_GAME_HIGH: { title: "Single-Game High", icon: Flame, suffix: "pts", decimals: 1 },
  SINGLE_GAME_LOW: { title: "Single-Game Low", icon: TrendingDown, suffix: "pts", decimals: 1 },
  BIGGEST_WIN: { title: "Biggest Win", icon: Zap, suffix: "pt margin", decimals: 1 },
  TOP_PLAYER_GAME: { title: "Top Player Game", icon: Star, suffix: "pts", decimals: 1 },
  BEST_SEASON: { title: "Best Season", icon: Crown, suffix: "wins", decimals: 0 },
  LONGEST_STREAK: { title: "Longest Streak", icon: Repeat, suffix: "straight", decimals: 0 },
};

const fallbackConfig: CategoryConfig = {
  title: "Record",
  icon: Medal,
  suffix: "",
  decimals: 1,
};

interface RecordCategoryProps {
  category: string;
  records: RecordRow[];
}

export function RecordCategory({ category, records }: RecordCategoryProps) {
  const config = categoryConfig[category] ?? fallbackConfig;
  const Icon = config.icon;
  const [first, ...rest] = records;
  if (!first) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <Icon className="h-4 w-4 text-amber-400" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider">
          {config.title}
        </h3>
      </div>

      <div className="relative overflow-hidden border-b border-amber-400/20 bg-gradient-to-br from-amber-400/10 to-transparent p-4">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Crown className="h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                <RecordLabel record={first} />
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
                #1 All-Time
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-3xl font-bold tabular-nums text-amber-400">
              {first.value?.toFixed(config.decimals)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {config.suffix}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-zinc-800">
        {rest.map((rec) => (
          <div key={rec.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold text-muted-foreground">
              {rec.rank}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              <RecordLabel record={rec} />
            </p>
            <span
              className={cn(
                "shrink-0 font-mono text-sm font-bold tabular-nums",
                "text-foreground"
              )}
            >
              {rec.value?.toFixed(config.decimals)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {config.suffix}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
