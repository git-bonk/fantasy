import { getLatestSeasonId, getRecords, getShameData } from "@/lib/queries";
import { RecordCategory } from "@/components/records/RecordCategory";
import { ShameCorner } from "@/components/records/ShameCorner";
import { Reveal } from "@/components/motion/Reveal";
import type { RecordRow } from "@/lib/types";

const CATEGORY_ORDER = [
  "SINGLE_GAME_HIGH",
  "BIGGEST_WIN",
  "TOP_PLAYER_GAME",
  "BEST_SEASON",
  "LONGEST_STREAK",
  "SINGLE_GAME_LOW",
];

function groupByCategory(records: RecordRow[]): { category: string; rows: RecordRow[] }[] {
  const map = new Map<string, RecordRow[]>();
  for (const rec of records) {
    const list = map.get(rec.category) ?? [];
    list.push(rec);
    map.set(rec.category, list);
  }
  const ordered = CATEGORY_ORDER.filter((c) => map.has(c));
  const extra = [...map.keys()].filter((c) => !CATEGORY_ORDER.includes(c));
  return [...ordered, ...extra].map((category) => ({
    category,
    rows: (map.get(category) ?? []).sort((a, b) => a.rank - b.rank),
  }));
}

export default function RecordsPage() {
  const seasonId = getLatestSeasonId();
  const records = getRecords();
  const groups = groupByCategory(records);

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight">Hall of Fame</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            The league&apos;s all-time records and most dominant performances.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group, i) => (
          <Reveal key={group.category} delay={0.05 + i * 0.04}>
            <RecordCategory category={group.category} records={group.rows} />
          </Reveal>
        ))}
      </div>

      <ShameCorner items={getShameData(seasonId)} />
    </div>
  );
}
