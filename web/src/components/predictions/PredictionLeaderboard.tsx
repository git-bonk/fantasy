import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnimatedRow } from "@/components/motion/Reveal";
import { StreakBadge } from "@/components/cards/StreakBadge";
import { OwnerLink } from "@/components/links/OwnerLink";
import { cn } from "@/lib/utils";
import type { PredictionLeaderboardRow } from "@/lib/types";

interface PredictionLeaderboardProps {
  rows: PredictionLeaderboardRow[];
  currentOwnerId: string | null;
}

export function PredictionLeaderboard({ rows, currentOwnerId }: PredictionLeaderboardProps) {
  return (
    <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
      <CardHeader className="border-b border-zinc-800 pb-3">
        <CardTitle className="font-display">Leaderboard</CardTitle>
        <CardDescription>Season-long prediction record</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">No picks scored yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-14 text-zinc-500">Rank</TableHead>
                <TableHead className="text-zinc-500">Owner</TableHead>
                <TableHead className="text-right text-zinc-500">Record</TableHead>
                <TableHead className="w-20 text-right text-zinc-500">Streak</TableHead>
                <TableHead className="text-right text-zinc-500">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => {
                const isYou = row.owner_id === currentOwnerId;
                return (
                  <AnimatedRow
                    key={row.owner_id}
                    delay={i * 0.03}
                    className={cn(
                      "border-zinc-800/70 transition-colors hover:bg-foreground/[0.03]",
                      isYou && "bg-emerald-500/[0.04]"
                    )}
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
                      <OwnerLink aliasNum={row.alias_num} className="inline-flex items-center">
                        <span
                          className={cn(
                            "font-semibold transition-colors hover:text-emerald-400",
                            isYou && "text-emerald-400"
                          )}
                        >
                          {row.display_name}
                        </span>
                        {isYou && (
                          <span className="ml-1.5 text-xs font-normal text-zinc-500">(you)</span>
                        )}
                      </OwnerLink>
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm font-semibold tabular-nums text-zinc-300">
                      {row.correct}/{row.total}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <StreakBadge streak={row.streak} type="W" />
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="font-display text-lg font-bold tabular-nums">
                        {row.points}
                      </span>
                    </TableCell>
                  </AnimatedRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
