import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { AnimatedRow, Reveal } from "@/components/motion/Reveal";
import { EloLineChart } from "@/components/charts/EloLineChart";
import { getEloHistory, getLatestSeasonId, getRankings } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default function RankingsPage() {
  const seasonId = getLatestSeasonId();
  const rankings = getRankings(seasonId);
  const history = getEloHistory(seasonId);

  const weeks = [...new Set(history.map((h) => h.week_num))].sort((a, b) => a - b);
  const maxRegWeek = weeks.filter((w) => w <= 14).at(-1) ?? weeks.at(-1) ?? 1;
  const prevWeek = maxRegWeek - 1;

  const prevRating = new Map<number, number>();
  for (const h of history) {
    if (h.week_num === prevWeek) prevRating.set(h.id, h.rating);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Power Rankings"
        subtitle="Elo ratings through the regular season"
      />

      <Reveal>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="font-display">Elo Movement</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <EloLineChart history={history} />
          </CardContent>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="w-14 text-zinc-500">Rank</TableHead>
                  <TableHead className="text-zinc-500">Team</TableHead>
                  <TableHead className="text-right text-zinc-500">Rating</TableHead>
                  <TableHead className="text-right text-zinc-500">Move</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((team, i) => {
                  const prev = prevRating.get(team.id);
                  const delta = prev !== undefined ? team.rating - prev : 0;
                  const rounded = Math.round(delta);
                  return (
                    <AnimatedRow
                      key={team.id}
                      delay={i * 0.03}
                      className="border-zinc-800/70 transition-colors hover:bg-foreground/[0.03]"
                    >
                        <TableCell className="py-3">
                          <span
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums",
                              i === 0
                                ? "bg-amber-400/15 text-amber-400"
                                : "bg-zinc-800 text-zinc-400"
                            )}
                          >
                            {i + 1}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-[10px] font-bold"
                              style={{
                                backgroundColor: `${team.color}1f`,
                                color: team.color,
                              }}
                            >
                              {team.abbrev}
                            </span>
                            <span className="font-semibold">{team.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-base font-bold tabular-nums">
                          {Math.round(team.rating)}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums",
                              rounded > 0
                                ? "text-emerald-500"
                                : rounded < 0
                                  ? "text-rose-500"
                                  : "text-zinc-500"
                            )}
                          >
                            {rounded > 0 ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : rounded < 0 ? (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ) : (
                              <Minus className="h-3.5 w-3.5" />
                            )}
                            {rounded > 0 ? "+" : ""}
                            {rounded}
                          </span>
                        </TableCell>
                    </AnimatedRow>
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
