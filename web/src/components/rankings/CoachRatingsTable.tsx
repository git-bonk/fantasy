import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AliasTag } from "@/components/cards/AliasTag";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import { fmtPct, fmtPts } from "@/lib/format";
import type { CoachLeaderboardRow } from "@/lib/queries/coach";

interface CoachRatingsTableProps {
  rows: CoachLeaderboardRow[];
  revealed: boolean;
}

export function CoachRatingsTable({ rows, revealed }: CoachRatingsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No lineup data yet — coach ratings appear once games are played.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800 hover:bg-transparent">
          <TableHead className="w-14 text-zinc-500">Rank</TableHead>
          <TableHead className="text-zinc-500">Team</TableHead>
          <TableHead className="text-right text-zinc-500">Avg Efficiency</TableHead>
          <TableHead className="text-right text-zinc-500">Bench Pts / Wk</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={row.id} className="border-zinc-800/70 transition-colors hover:bg-foreground/[0.03]">
            <TableCell className="py-3">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums",
                  i === 0 ? "bg-amber-400/15 text-amber-400" : "bg-zinc-800 text-zinc-400"
                )}
              >
                {i + 1}
              </span>
            </TableCell>
            <TableCell className="py-3">
              <TeamLink
                teamId={row.id}
                className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-[10px] font-bold"
                  style={{ backgroundColor: `${row.color}1f`, color: row.color }}
                >
                  {row.abbrev}
                </span>
                {revealed ? (
                  <span className="font-semibold">{row.name}</span>
                ) : (
                  <AliasTag label={row.name} />
                )}
              </TeamLink>
            </TableCell>
            <TableCell className="py-3 text-right font-mono text-base font-bold tabular-nums">
              {fmtPct(row.avg_efficiency)}
            </TableCell>
            <TableCell className="py-3 text-right font-mono text-sm font-semibold tabular-nums text-zinc-300">
              {row.weeks > 0 ? fmtPts(row.bench_points / row.weeks) : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
