import { TeamLink } from "@/components/links/TeamLink";
import { PositionBadge } from "@/components/players/PositionBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DraftPickRow } from "@/lib/queries";

interface DraftBoardProps {
  picks: DraftPickRow[];
}

interface RoundGroup {
  round: number;
  items: DraftPickRow[];
}

function groupByRound(picks: DraftPickRow[]): RoundGroup[] {
  const groups: RoundGroup[] = [];
  for (const pick of picks) {
    const last = groups[groups.length - 1];
    if (last && last.round === pick.round_num) {
      last.items.push(pick);
    } else {
      groups.push({ round: pick.round_num, items: [pick] });
    }
  }
  return groups;
}

function KeeperBadge() {
  return (
    <span className="inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-400 uppercase">
      Keeper
    </span>
  );
}

function DraftRow({ pick }: { pick: DraftPickRow }) {
  return (
    <TableRow className="border-zinc-800/70 transition-colors hover:bg-foreground/[0.03]">
      <TableCell className="text-center">
        <span className="font-mono text-xs font-bold tabular-nums text-muted-foreground">
          {pick.round_pick}
        </span>
      </TableCell>
      <TableCell>
        {pick.team_id != null && pick.tname != null ? (
          <TeamLink
            teamId={pick.team_id}
            className="flex items-center gap-1.5 transition-colors hover:text-emerald-400"
          >
            {pick.color && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: pick.color }}
              />
            )}
            <span className="truncate text-xs">{pick.tname}</span>
          </TeamLink>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <PositionBadge position={pick.position} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium">{pick.player_name}</span>
              {pick.keeper_status > 0 && <KeeperBadge />}
            </div>
            {pick.nfl_team && <p className="text-xs text-muted-foreground">{pick.nfl_team}</p>}
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden text-right sm:table-cell">
        {pick.bid_amount != null && pick.bid_amount > 0 ? (
          <span className="font-mono text-sm font-bold tabular-nums text-amber-400">
            ${pick.bid_amount}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export function DraftBoard({ picks }: DraftBoardProps) {
  const groups = groupByRound(picks);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.round}>
          <div className="mb-2 flex items-center gap-3">
            <h3 className="font-display text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              Round {group.round}
            </h3>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16 text-center text-muted-foreground">Pick</TableHead>
                  <TableHead className="text-muted-foreground">Team</TableHead>
                  <TableHead className="text-muted-foreground">Player</TableHead>
                  <TableHead className="hidden text-right text-muted-foreground sm:table-cell">
                    Bid
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((pick) => (
                  <DraftRow key={pick.id} pick={pick} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
