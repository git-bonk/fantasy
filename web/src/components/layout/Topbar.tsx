import { getSeasons, getMaxWeek, getWeeks } from "@/lib/queries";

export function Topbar() {
  const seasons = getSeasons();
  const season = seasons[0];
  const seasonId = season?.id;
  const maxWeek = seasonId ? getMaxWeek(seasonId) : 1;
  const weeks = seasonId ? getWeeks(seasonId) : [];
  const weekLabel = weeks.find((w) => w.week_num === maxWeek)?.label ?? `Week ${maxWeek}`;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-lg font-semibold tracking-tight">
          Fantasy NFL
        </h1>
        {season && (
          <span className="hidden rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-block">
            {season.year} Season
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground">
          {weekLabel}
        </span>
      </div>
    </header>
  );
}
