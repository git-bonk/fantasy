import { cookies } from "next/headers";
import { getSeasons, getMaxWeek, getWeeks, getSeasonIdByYear } from "@/lib/queries";
import { getRevealStatus } from "@/lib/reveal";
import { TopbarControls } from "./TopbarControls";
import { RevealToggle } from "./RevealToggle";
import type { Week } from "@/lib/types";

export async function Topbar() {
  const cookieStore = await cookies();
  const seasons = getSeasons();
  const reveal = await getRevealStatus();

  const yearCookie = cookieStore.get("fantasy_year")?.value;
  const weekCookie = cookieStore.get("fantasy_week")?.value;

  const serverYear = yearCookie ? Number(yearCookie) : seasons[0]?.year ?? 2025;
  const seasonId = getSeasonIdByYear(serverYear);
  const maxWeek = getMaxWeek(seasonId);
  const serverWeek = weekCookie
    ? Math.min(Math.max(Number(weekCookie), 1), maxWeek)
    : maxWeek;

  // Build lookup maps for all seasons so the client can switch
  const maxWeeks: Record<number, number> = {};
  const weeksByYear: Record<number, Week[]> = {};
  for (const s of seasons) {
    maxWeeks[s.year] = getMaxWeek(s.id);
    weeksByYear[s.year] = getWeeks(s.id);
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-lg font-semibold tracking-tight">
          Fantasy NFL
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <RevealToggle unlocked={reveal.unlocked} revealed={reveal.revealed} />
        <TopbarControls
          seasons={seasons}
          serverYear={serverYear}
          serverWeek={serverWeek}
          maxWeeks={maxWeeks}
          weeksByYear={weeksByYear}
        />
      </div>
    </header>
  );
}
