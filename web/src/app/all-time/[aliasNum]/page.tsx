import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OwnerEloChart } from "@/components/charts/OwnerEloChart";
import { Reveal } from "@/components/motion/Reveal";
import {
  getLeagueHistory,
  getOwnerEloHistoryByAlias,
  getOwnerStandings,
} from "@/lib/queries";
import { fmtPct, initials, ownerColor } from "@/lib/format";

interface OwnerDetailPageProps {
  params: Promise<{ aliasNum: string }>;
}

interface StatChipProps {
  label: string;
  value: string;
}

function StatChip({ label, value }: StatChipProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
      <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className="mt-1.5 font-display text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default async function OwnerDetailPage({ params }: OwnerDetailPageProps) {
  const { aliasNum: aliasParam } = await params;
  const aliasNum = Number.parseInt(aliasParam, 10);
  if (!Number.isFinite(aliasNum)) notFound();
  const owner = (await getOwnerStandings()).find((o) => o.owner_alias_num === aliasNum);
  if (!owner) notFound();

  const color = ownerColor(owner.owner_id);
  const history = getOwnerEloHistoryByAlias(aliasNum);
  const games = owner.wins + owner.losses + owner.ties;
  const winPct = games > 0 ? fmtPct(owner.wins / games) : "—";
  const record =
    owner.ties > 0
      ? `${owner.wins}-${owner.losses}-${owner.ties}`
      : `${owner.wins}-${owner.losses}`;

  const teamRows = (await getLeagueHistory()).filter((t) => t.owner_alias_num === aliasNum);
  const teams = new Map<string, { name: string; abbrev: string; color: string; years: number[] }>();
  for (const row of teamRows) {
    const key = `${row.abbrev}-${row.team_name}`;
    let team = teams.get(key);
    if (!team) {
      team = { name: row.team_name, abbrev: row.abbrev, color: row.color, years: [] };
      teams.set(key, team);
    }
    if (!team.years.includes(row.year)) team.years.push(row.year);
  }
  const teamList = [...teams.values()];
  const seasons = new Set(teamRows.map((t) => t.year));

  return (
    <div className="space-y-6">
      <Reveal>
        <Link
          href="/all-time"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-4 w-4" />
          All-Time Rankings
        </Link>
      </Reveal>

      <Reveal delay={0.03}>
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold"
            style={{ backgroundColor: `${color}1f`, color }}
          >
            {initials(owner.display_name)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight md:text-3xl">
              {owner.display_name}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Running Elo {Math.round(owner.rating)} · career {record}
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatChip label="Rating" value={String(Math.round(owner.rating))} />
          <StatChip label="Record" value={record} />
          <StatChip label="Win%" value={winPct} />
          <StatChip label="Seasons" value={String(seasons.size)} />
        </div>
      </Reveal>

      <Reveal delay={0.09}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Elo Trajectory</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {history.length > 0 ? (
              <OwnerEloChart history={history} color={color} />
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">
                No rating history recorded yet.
              </p>
            )}
          </CardContent>
        </Card>
      </Reveal>

      {teamList.length > 0 && (
        <Reveal delay={0.12}>
          <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
            <CardHeader className="border-b border-zinc-800 pb-3">
              <CardTitle className="font-display">Teams Fielded</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-4">
              {teamList.map((team) => (
                <div
                  key={`${team.abbrev}-${team.name}`}
                  className="flex items-center gap-2.5 rounded-lg bg-foreground/[0.03] px-2.5 py-2"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-[10px] font-bold"
                    style={{ backgroundColor: `${team.color}1f`, color: team.color }}
                  >
                    {team.abbrev}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-500">
                    {team.years.length > 1
                      ? `${Math.min(...team.years)}\u2013${Math.max(...team.years)}`
                      : team.years[0]}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      )}
    </div>
  );
}
