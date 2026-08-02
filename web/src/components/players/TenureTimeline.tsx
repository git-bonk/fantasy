import { OwnerLink } from "@/components/links/OwnerLink";
import { TeamLink } from "@/components/links/TeamLink";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtPts } from "@/lib/format";
import type { PlayerTenureRow } from "@/lib/queries/player-career";

interface TenureTimelineProps {
  tenure: PlayerTenureRow[];
}

export function TenureTimeline({ tenure }: TenureTimelineProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800 hover:bg-transparent">
          <TableHead className="w-20 text-zinc-500">Year</TableHead>
          <TableHead className="text-zinc-500">Team</TableHead>
          <TableHead className="text-zinc-500">Owner</TableHead>
          <TableHead className="text-right text-zinc-500">Wks</TableHead>
          <TableHead className="text-right text-zinc-500">Starts</TableHead>
          <TableHead className="text-right text-zinc-500">Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tenure.map((row) => (
          <TableRow key={row.key} className="border-zinc-800/70">
            <TableCell className="py-2.5 font-mono text-sm tabular-nums">{row.year}</TableCell>
            <TableCell className="py-2.5">
              <TeamLink
                teamId={row.team_id}
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="font-semibold">{row.name}</span>
              </TeamLink>
            </TableCell>
            <TableCell className="py-2.5 text-sm text-zinc-400">
              <OwnerLink aliasNum={row.owner_alias_num} className="hover:underline">
                {row.owner_name}
              </OwnerLink>
            </TableCell>
            <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums text-zinc-400">
              {row.weeks}
            </TableCell>
            <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums text-zinc-400">
              {row.starts}
            </TableCell>
            <TableCell className="py-2.5 text-right font-mono font-semibold tabular-nums">
              {fmtPts(row.total_points)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
