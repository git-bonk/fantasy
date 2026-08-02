import { fmtPct } from "@/lib/format";
import { TeamLink } from "@/components/links/TeamLink";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PlayoffScenarioRow } from "@/lib/queries/playoffs";

interface PlayoffScenariosProps {
  rows: PlayoffScenarioRow[];
}

function WinDistStrip({ dist }: { dist: PlayoffScenarioRow["win_dist"] }) {
  const entries = Object.entries(dist)
    .map(([k, [pMake]]) => ({ k: Number(k), pMake }))
    .sort((a, b) => a.k - b.k);

  return (
    <div className="flex items-end gap-0.5">
      {entries.map(({ k, pMake }) => (
        <div key={k} className="flex flex-col items-center gap-0.5">
          <div
            className="w-4 rounded-sm bg-emerald-500/60"
            style={{ height: `${Math.max(2, pMake * 24)}px` }}
            title={`${k} wins: ${Math.round(pMake * 100)}% make`}
          />
          <span className="font-mono text-[9px] text-muted-foreground">{k}</span>
        </div>
      ))}
    </div>
  );
}

export function PlayoffScenarios({ rows }: PlayoffScenariosProps) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-muted-foreground">Team</TableHead>
            <TableHead className="text-right text-muted-foreground">Wins Out</TableHead>
            <TableHead className="text-right text-muted-foreground">Loses Out</TableHead>
            <TableHead className="hidden text-right text-muted-foreground sm:table-cell">
              50% Shot
            </TableHead>
            <TableHead className="hidden text-right text-muted-foreground md:table-cell">
              Wins → Odds
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
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
              <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-emerald-400">
                {fmtPct(row.p_wins_out)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-rose-400">
                {fmtPct(row.p_lose_out)}
              </TableCell>
              <TableCell className="hidden text-right sm:table-cell">
                {row.min_wins_fifty != null ? (
                  <span className="font-mono text-sm tabular-nums">
                    ≈{row.min_wins_fifty} wins
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">long shot</span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex justify-end">
                  <WinDistStrip dist={row.win_dist} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-400">
        Conditional playoff odds given win-out / lose-out runs and final-win distribution
      </div>
    </div>
  );
}
