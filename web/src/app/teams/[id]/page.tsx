import { notFound } from "next/navigation";
import { ArrowLeft, Shield, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { SeasonPointsChart } from "@/components/charts/SeasonPointsChart";
import { StreakBadge } from "@/components/cards/StreakBadge";
import {
  getRankings,
  getStreaks,
  getTeam,
  getTeamPointsByWeek,
  getTeamRecord,
  getTeamRoster,
  getTeamSos,
} from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { fmtPct, fmtPts, fmtRecord } from "@/lib/format";
import { cn } from "@/lib/utils";

interface TeamDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; week?: string }>;
}

export default async function TeamDetailPage({ params, searchParams }: TeamDetailPageProps) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const { id } = await params;
  const teamId = Number(id);

  const team = await getTeam(seasonId, teamId);
  if (!team) notFound();

  const record = getTeamRecord(seasonId, teamId);
  const sos = getTeamSos(seasonId, teamId);
  const pointsByWeek = getTeamPointsByWeek(seasonId, teamId);
  const roster = getTeamRoster(seasonId, teamId);
  const elo = (await getRankings(seasonId)).find((r) => r.id === teamId)?.rating;
  const teamStreak = (await getStreaks(seasonId)).find((s) => s.team_id === teamId);

  const starters = roster.filter((r) => r.lineup_slot !== "BN");
  const bench = roster.filter((r) => r.lineup_slot === "BN");

  return (
    <div className="space-y-6">
      <Reveal>
        <Link
          href="/teams"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          All teams
        </Link>
      </Reveal>

      <Reveal>
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl font-display text-lg font-bold"
            style={{ backgroundColor: `${team.color}1f`, color: team.color }}
          >
            {team.abbrev}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {team.name}
            </h1>
            <p className="text-sm text-zinc-400">Owned by {team.owner_name}</p>
          </div>
          {teamStreak && (
            <StreakBadge streak={teamStreak.streak} type={teamStreak.type} className="px-2 py-1 text-xs" />
          )}
          {record?.playoff_seed != null ? (
            <Badge className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
              Playoff Seed #{record.playoff_seed}
            </Badge>
          ) : (
            <Badge variant="outline" className="border-zinc-700 text-zinc-500">
              Missed Playoffs
            </Badge>
          )}
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              Record
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {fmtRecord(record?.wins ?? 0, record?.losses ?? 0, record?.ties ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              Points For
            </p>
            <CountUp
              value={record?.points_for ?? 0}
              decimals={1}
              className="mt-1 block font-display text-2xl font-bold tabular-nums"
            />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              Points Against
            </p>
            <CountUp
              value={record?.points_against ?? 0}
              decimals={1}
              className="mt-1 block font-display text-2xl font-bold tabular-nums"
            />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="flex items-center gap-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              <TrendingUp className="h-3 w-3" /> Elo
            </p>
            <CountUp
              value={elo ?? 1500}
              className="mt-1 block font-display text-2xl font-bold tabular-nums"
            />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="flex items-center gap-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              <Shield className="h-3 w-3" /> SOS Rank
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {sos?.sos_rank != null ? `#${sos.sos_rank}` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="flex items-center gap-1 text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
              <Target className="h-3 w-3" /> Playoff Odds
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-500">
              {fmtPct(record?.playoff_odds)}
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Season Scoring</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <SeasonPointsChart data={pointsByWeek} color={team.color} id={`team-${team.id}`} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Roster</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="w-16 text-zinc-500">Slot</TableHead>
                  <TableHead className="text-zinc-500">Player</TableHead>
                  <TableHead className="text-zinc-500">Pos</TableHead>
                  <TableHead className="text-zinc-500">NFL Team</TableHead>
                  <TableHead className="text-right text-zinc-500">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...starters, ...bench].map((p, i) => {
                  const isStarter = p.lineup_slot !== "BN";
                  return (
                    <TableRow
                      key={`${p.player_name}-${i}`}
                      className={cn(
                        "border-zinc-800/70",
                        !isStarter && "opacity-60"
                      )}
                    >
                      <TableCell className="py-2.5">
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold",
                            isStarter
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-zinc-800 text-zinc-500"
                          )}
                        >
                          {p.lineup_slot}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 font-semibold">
                        {p.player_name}
                      </TableCell>
                      <TableCell className="py-2.5 font-mono text-xs text-zinc-400">
                        {p.position}
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-zinc-400">
                        {p.nfl_team}
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-mono font-semibold tabular-nums">
                        {fmtPts(p.points)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
