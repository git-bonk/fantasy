import { cn } from "@/lib/utils";
import { fmtPts } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PositionBadge } from "./PositionBadge";
import type { PlayerRow } from "@/lib/types";

interface PerformersTableProps {
  players: PlayerRow[];
}

export function PerformersTable({ players }: PerformersTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 text-center text-muted-foreground">#</TableHead>
            <TableHead className="text-muted-foreground">Player</TableHead>
            <TableHead className="hidden text-muted-foreground sm:table-cell">Team</TableHead>
            <TableHead className="text-right text-muted-foreground">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p, i) => (
            <TableRow key={`${p.player_name}-${i}`} className={cn(i === 0 && "bg-amber-400/5")}>
              <TableCell className="text-center">
                <span
                  className={cn(
                    "font-mono text-xs font-bold tabular-nums",
                    i === 0 ? "text-amber-400" : "text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <PositionBadge position={p.position} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.player_name}</p>
                    <p className="text-xs text-muted-foreground">{p.nfl_team}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate text-xs text-muted-foreground">{p.tname}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "font-mono text-sm font-bold tabular-nums",
                    i === 0 ? "text-amber-400" : "text-foreground"
                  )}
                >
                  {fmtPts(p.points)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
