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
  nflTeam?: string | null;
  games: number | null;
  fantasyPoints: number | null;
  stats: Record<string, number>;
}

interface NflStatsTableProps {
  rows: NflStatsRow[];
  columns: NflStatColumn[];
  showTeam?: boolean;
  gamesLabel?: string;
}

export function NflStatsTable({ rows, columns, showTeam = false, gamesLabel = "GP" }: NflStatsTableProps) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.games += row.games ?? 0;
      acc.fantasyPoints += row.fantasyPoints ?? 0;
      for (const col of columns) {
        acc.stats[col.key] = (acc.stats[col.key] ?? 0) + (row.stats[col.key] ?? 0);
      }
      return acc;
    },
    { games: 0, fantasyPoints: 0, stats: {} as Record<string, number> }
  );
  const anyFantasyPoints = rows.some((row) => row.fantasyPoints != null);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800">
            <TableHead className="text-muted-foreground">Season</TableHead>
            {showTeam && <TableHead className="text-muted-foreground">Team</TableHead>}
            <TableHead className="text-right text-muted-foreground">{gamesLabel}</TableHead>
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
              {showTeam && (
                <TableCell className="text-xs text-zinc-400">{row.nflTeam ?? "—"}</TableCell>
              )}
              <TableCell className="text-right font-mono text-sm tabular-nums text-zinc-400">
                {row.games ?? "—"}
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
                {row.fantasyPoints != null ? fmtPts(row.fantasyPoints) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {rows.length > 1 && (
          <TableFooter>
            <TableRow className="border-zinc-800">
              <TableCell className="font-semibold">Career</TableCell>
              {showTeam && <TableCell />}
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
                {anyFantasyPoints ? fmtPts(totals.fantasyPoints) : "—"}
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
