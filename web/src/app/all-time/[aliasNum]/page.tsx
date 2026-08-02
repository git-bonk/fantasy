import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarRange, Target, TrendingUp, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/cards/StatCard";
import { OwnerEloChart } from "@/components/charts/OwnerEloChart";
import { CareerTeamsTable } from "@/components/all-time/CareerTeamsTable";
import { SeasonCallouts } from "@/components/all-time/SeasonCallouts";
import { TrophyCase } from "@/components/all-time/TrophyCase";
import { Reveal } from "@/components/motion/Reveal";
import {
  getOwnerCareerByAlias,
  getOwnerEloHistoryByAlias,
  getOwnerStandings,
  getOwnerTrophiesByAlias,
  pickSeasonExtremes,
} from "@/lib/queries";
import { fmtRecord, initials, ownerColor } from "@/lib/format";

interface OwnerDetailPageProps {
  params: Promise<{ aliasNum: string }>;
}

function yearSpanLabel(years: number[]): string {
  if (years.length === 0) return "—";
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? `${min}` : `${min}\u2013${max}`;
}

export default async function OwnerDetailPage({ params }: OwnerDetailPageProps) {
  const { aliasNum: aliasParam } = await params;
  const aliasNum = Number.parseInt(aliasParam, 10);
  if (!Number.isFinite(aliasNum)) notFound();
  const owner = (await getOwnerStandings()).find((o) => o.owner_alias_num === aliasNum);
  if (!owner) notFound();

  const [career, trophies] = await Promise.all([
    getOwnerCareerByAlias(aliasNum),
    getOwnerTrophiesByAlias(aliasNum),
  ]);
  const history = getOwnerEloHistoryByAlias(aliasNum);

  const color = ownerColor(owner.owner_id);
  const { summary, teams } = career;
  const games = summary.wins + summary.losses + summary.ties;
  const winPctValue = games > 0 ? Math.round((summary.wins / games) * 1000) / 10 : 0;
  const record = fmtRecord(summary.wins, summary.losses, summary.ties);
  const { best, worst } = pickSeasonExtremes(teams);

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
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            label="Seasons"
            value={summary.seasons}
            icon={CalendarRange}
            accent="#38bdf8"
            sub={yearSpanLabel(teams.map((t) => t.year))}
          />
          <StatCard
            label="Win Rate"
            value={winPctValue}
            decimals={1}
            suffix="%"
            icon={Target}
            accent="#10b981"
            sub={`${record} career${summary.points_for != null ? ` · ${Math.round(summary.points_for).toLocaleString()} PF` : ""}`}
          />
          <StatCard
            label="Titles"
            value={summary.titles}
            icon={Trophy}
            accent="#fbbf24"
            sub={`${summary.runner_ups} runner-up · ${summary.appearances} playoff ${summary.appearances === 1 ? "run" : "runs"}`}
          />
          <StatCard
            label="Elo"
            value={Math.round(owner.rating)}
            icon={TrendingUp}
            accent="#a855f7"
            sub="running rating"
          />
        </div>
      </Reveal>

      <Reveal delay={0.09}>
        <TrophyCase trophies={trophies} />
      </Reveal>

      <Reveal delay={0.12}>
        <CareerTeamsTable teams={teams} />
      </Reveal>

      <Reveal delay={0.15}>
        <SeasonCallouts best={best} worst={worst} />
      </Reveal>

      <Reveal delay={0.18}>
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
    </div>
  );
}
