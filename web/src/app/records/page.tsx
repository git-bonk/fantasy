import { getRecords, getShameData } from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
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

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; week?: string }>;
}) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const records = await getRecords();
  const groups = groupByCategory(records);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hall of Fame"
        subtitle="The league's all-time records and most dominant performances."
      />

      {groups.length === 0 ? (
        <Reveal>
          <EmptyState message="No records recorded yet." />
        </Reveal>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group, i) => (
            <Reveal key={group.category} delay={0.05 + i * 0.04}>
              <RecordCategory category={group.category} records={group.rows} />
            </Reveal>
          ))}
        </div>
      )}

      <ShameCorner items={await getShameData(seasonId)} />
    </div>
  );
}
