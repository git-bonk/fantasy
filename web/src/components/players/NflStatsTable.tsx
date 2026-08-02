import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtPts } from "@/lib/format";
import type { NflStatColumn } from "@/lib/queries/player-career";

export interface NflStatsRow {
  year: number;
  games: number;
  fantasyPoints: number;
  stats: Record<string, number>;
}

interface NflStatsTableProps {
  rows: NflStatsRow[];
  columns: NflStatColumn[];
}

export function NflStatsTable({ rows, columns }: NflStatsTableProps) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.games += row.games;
      acc.fantasyPoints += row.fantasyPoints;
      for (const col of columns) {
        acc.stats[col.key] = (acc.stats[col.key] ?? 0) + (row.stats[col.key] ?? 0);
      }
      return acc;
    },
    { games: 0, fantasyPoints: 0, stats: {} as Record<string, number> }
  );

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800">
            <TableHead className="text-muted-foreground">Season</TableHead>
            <TableHead className="text-right text-muted-foreground">Wks</TableHead>
            {columns.map((col) => (
              <TableHead key={col.key} className="text-right text-muted-foreground">
                {col.label}
              </TableHead>
            ))}
            <TableHead className="text-right text-muted-foreground">Fant Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.year} className="border-zinc-800/70">
              <TableCell className="font-semibold tabular-nums">{row.year}</TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-zinc-400">
                {row.games}
              </TableCell>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className="text-right font-mono text-sm tabular-nums"
                >
                  {row.stats[col.key] ?? 0}
                </TableCell>
              ))}
              <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-emerald-400">
                {fmtPts(row.fantasyPoints)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {rows.length > 1 && (
          <TableFooter>
            <TableRow className="border-zinc-800">
              <TableCell className="font-semibold">Career</TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-zinc-400">
                {totals.games}
              </TableCell>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className="text-right font-mono text-sm font-semibold tabular-nums"
                >
                  {totals.stats[col.key] ?? 0}
                </TableCell>
              ))}
              <TableCell className="text-right font-mono text-sm font-bold tabular-nums text-emerald-400">
                {fmtPts(totals.fantasyPoints)}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
