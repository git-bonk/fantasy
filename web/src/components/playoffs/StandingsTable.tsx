import Link from "next/link";
import { cn } from "@/lib/utils";
import { fmtRecord, fmtPts } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OddsBar } from "./OddsBar";
import type { PlayoffStandingRow } from "@/lib/types";

interface StandingsTableProps {
  standings: PlayoffStandingRow[];
  playoffTeams: number;
}

export function StandingsTable({ standings, playoffTeams }: StandingsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-center text-muted-foreground">Seed</TableHead>
            <TableHead className="text-muted-foreground">Team</TableHead>
            <TableHead className="text-right text-muted-foreground">Record</TableHead>
            <TableHead className="hidden text-right text-muted-foreground sm:table-cell">
              Pts For
            </TableHead>
            <TableHead className="text-right text-muted-foreground">Odds</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((team, i) => {
            const inPlayoffs = team.playoff_seed != null;
            const isCutLine = i === playoffTeams - 1;
            return (
              <TableRow
                key={team.id}
                className={cn(
                  !inPlayoffs && "opacity-60",
                  isCutLine && "border-b-2 border-b-emerald-500/40"
                )}
              >
                <TableCell className="text-center">
                  {inPlayoffs ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 font-mono text-xs font-bold text-emerald-400">
                      {team.playoff_seed}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/teams/${team.id}`}
                    className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.abbrev}
                    </span>
                    <span className="truncate text-sm font-medium">{team.name}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                  {fmtRecord(team.wins, team.losses, team.ties)}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground sm:table-cell">
                  {fmtPts(team.points_for)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end">
                    <OddsBar odds={team.playoff_odds} inPlayoffs={inPlayoffs} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex items-center gap-2 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Top {playoffTeams} make the playoffs
      </div>
    </div>
  );
}
