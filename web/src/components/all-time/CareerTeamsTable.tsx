import { Crown, Medal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeamLink } from "@/components/links/TeamLink";
import { AnimatedRow } from "@/components/motion/Reveal";
import { fmtPct, fmtRecord } from "@/lib/format";
import { seasonWinPct, type OwnerCareerTeamRow } from "@/lib/queries";

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

interface FinishCellProps {
  finalStanding: number | null;
}

function FinishCell({ finalStanding }: FinishCellProps) {
  if (finalStanding == null || finalStanding <= 0) {
    return <span className="text-zinc-600">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      {finalStanding === 1 ? (
        <Crown className="h-3.5 w-3.5 text-amber-400" />
      ) : finalStanding === 2 ? (
        <Medal className="h-3.5 w-3.5 text-zinc-400" />
      ) : null}
      <span
        className={
          finalStanding === 1
            ? "font-semibold text-amber-400"
            : finalStanding === 2
              ? "font-semibold text-zinc-300"
              : "text-zinc-400"
        }
      >
        {ordinal(finalStanding)}
      </span>
    </span>
  );
}

interface CareerTeamsTableProps {
  teams: OwnerCareerTeamRow[];
}

export function CareerTeamsTable({ teams }: CareerTeamsTableProps) {
  return (
    <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0">
      <CardHeader className="border-b border-zinc-800 pb-3">
        <CardTitle className="font-display">Career Teams</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {teams.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            No teams recorded for this owner yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="w-20 text-zinc-500">Year</TableHead>
                <TableHead className="text-zinc-500">Team</TableHead>
                <TableHead className="text-right text-zinc-500">Record</TableHead>
                <TableHead className="text-right text-zinc-500">Win%</TableHead>
                <TableHead className="pr-4 text-right text-zinc-500">Finish</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team, i) => (
                <AnimatedRow
                  key={team.team_id}
                  delay={i * 0.03}
                  className="border-zinc-800/70 transition-colors hover:bg-foreground/[0.03]"
                >
                  <TableCell className="py-3 font-mono text-sm tabular-nums text-zinc-400">
                    {team.year}
                  </TableCell>
                  <TableCell className="py-3">
                    <TeamLink
                      teamId={team.team_id}
                      className="group flex items-center gap-2.5"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-display text-[9px] font-bold"
                        style={{ backgroundColor: `${team.color}1f`, color: team.color }}
                      >
                        {team.abbrev}
                      </span>
                      <span className="truncate font-medium transition-colors group-hover:text-emerald-400">
                        {team.name}
                      </span>
                    </TeamLink>
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono text-sm font-semibold tabular-nums text-zinc-300">
                    {fmtRecord(team.wins, team.losses, team.ties)}
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono text-sm tabular-nums text-zinc-400">
                    {fmtPct(seasonWinPct(team))}
                  </TableCell>
                  <TableCell className="py-3 pr-4 text-right">
                    <FinishCell finalStanding={team.final_standing} />
                  </TableCell>
                </AnimatedRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
