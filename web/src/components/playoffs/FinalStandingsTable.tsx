import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AliasTag } from "@/components/cards/AliasTag";
import { cn } from "@/lib/utils";
import { fmtPts, fmtRecord } from "@/lib/format";
import type { FinalStandingRow } from "@/lib/types";

interface FinalStandingsTableProps {
  rows: FinalStandingRow[];
  revealed: boolean;
}

export function FinalStandingsTable({ rows, revealed }: FinalStandingsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-14 text-center text-muted-foreground">Rank</TableHead>
            <TableHead className="text-muted-foreground">Team</TableHead>
            <TableHead className="text-right text-muted-foreground">Record</TableHead>
            <TableHead className="text-right text-muted-foreground">Pts For</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="border-zinc-800/70">
              <TableCell className="text-center">
                {row.final_standing != null ? (
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold tabular-nums",
                      row.final_standing === 1
                        ? "bg-amber-400/15 text-amber-400"
                        : "bg-zinc-800 text-zinc-400"
                    )}
                  >
                    {row.final_standing}
                  </span>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={`/teams/${row.id}`}
                  className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                    style={{ backgroundColor: `${row.color}1f`, color: row.color }}
                  >
                    {row.abbrev}
                  </span>
                  {revealed ? (
                    <span className="truncate text-sm font-medium">{row.name}</span>
                  ) : (
                    <AliasTag label={row.name} />
                  )}
                </Link>
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                {row.wins != null ? fmtRecord(row.wins, row.losses ?? 0, row.ties ?? 0) : "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                {fmtPts(row.points_for)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
