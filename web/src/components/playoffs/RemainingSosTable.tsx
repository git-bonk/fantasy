import { cn } from "@/lib/utils";
import { fmtPts } from "@/lib/format";
import { TeamLink } from "@/components/links/TeamLink";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isEvenSos, sosTier, type RemainingSosRow, type SosTier } from "@/lib/queries/sos";

interface RemainingSosTableProps {
  rows: RemainingSosRow[];
  throughWeek: number;
}

const TIER_STYLES: Record<SosTier, string> = {
  hard: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/40",
  easy: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/40",
};

const TIER_LABELS: Record<SosTier, string> = {
  hard: "Hard",
  easy: "Easy",
};

export function RemainingSosTable({ rows, throughWeek }: RemainingSosTableProps) {
  const even = isEvenSos(rows);

  const note = even
    ? throughWeek === 0
      ? "Even schedule — no games played yet"
      : "Remaining schedules are even"
    : "Rank 1 = hardest remaining schedule";

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-center text-muted-foreground">SOS</TableHead>
            <TableHead className="text-muted-foreground">Team</TableHead>
            <TableHead className="text-right text-muted-foreground">Games Left</TableHead>
            <TableHead className="hidden text-right text-muted-foreground sm:table-cell">
              Opp Avg
            </TableHead>
            <TableHead className="text-right text-muted-foreground">Outlook</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const tier = even ? null : sosTier(row, rows);
            return (
              <TableRow key={row.id}>
                <TableCell className="text-center">
                  {even ? (
                    <span className="font-mono text-xs text-muted-foreground">—</span>
                  ) : (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-700/40 font-mono text-xs font-bold text-zinc-300">
                      {row.sos_rank}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <TeamLink
                    teamId={row.id}
                    className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                      style={{ backgroundColor: row.color }}
                    >
                      {row.abbrev}
                    </span>
                    <span className="truncate text-sm font-medium">{row.name}</span>
                  </TeamLink>
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                  {row.games_left}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground sm:table-cell">
                  {fmtPts(row.opp_avg_rating)}
                </TableCell>
                <TableCell className="text-right">
                  {tier ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold",
                        TIER_STYLES[tier]
                      )}
                    >
                      {TIER_LABELS[tier]}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-400">{note}</div>
    </div>
  );
}
