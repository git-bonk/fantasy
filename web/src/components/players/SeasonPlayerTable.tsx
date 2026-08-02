"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AliasTag } from "@/components/cards/AliasTag";
import { EmptyState } from "@/components/EmptyState";
import { PositionBadge } from "@/components/players/PositionBadge";
import { PlayerLink } from "@/components/links/PlayerLink";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import { fmtPts } from "@/lib/format";
import type { SeasonPlayerTableRow } from "@/lib/queries/players";

type SortKey =
  | "player_name"
  | "position"
  | "games"
  | "starts"
  | "benches"
  | "total_points"
  | "ppg";

type SortDir = "asc" | "desc";

const DEFAULT_DIR: Record<SortKey, SortDir> = {
  player_name: "asc",
  position: "asc",
  games: "desc",
  starts: "desc",
  benches: "desc",
  total_points: "desc",
  ppg: "desc",
};

const COLLAPSED_LIMIT = 25;

function sortValue(row: SeasonPlayerTableRow, key: SortKey): number | string {
  switch (key) {
    case "player_name":
      return row.player_name;
    case "position":
      return row.position;
    case "games":
      return row.games;
    case "starts":
      return row.starts;
    case "benches":
      return row.benches;
    case "total_points":
      return row.total_points;
    case "ppg":
      return row.ppg;
  }
}

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  sortBy: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}

function SortHeader({ label, sortKey, sortBy, sortDir, onSort, align = "left" }: SortHeaderProps) {
  const active = sortBy === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 transition-colors",
        align === "right" && "flex-row-reverse",
        active ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {label}
      <ChevronDown
        className={cn(
          "h-3 w-3 transition-transform",
          active ? "opacity-100" : "opacity-0",
          active && sortDir === "asc" && "rotate-180"
        )}
      />
    </button>
  );
}

interface SeasonPlayerTableProps {
  rows: SeasonPlayerTableRow[];
  revealed: boolean;
}

export function SeasonPlayerTable({ rows, revealed }: SeasonPlayerTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>("total_points");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showAll, setShowAll] = useState(false);

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  };

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortValue(a, sortBy);
      const bv = sortValue(b, sortBy);
      const cmp =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv)
          : (av as number) - (bv as number);
      const primary = sortDir === "asc" ? cmp : -cmp;
      return primary !== 0 ? primary : b.total_points - a.total_points;
    });
    return copy;
  }, [rows, sortBy, sortDir]);

  if (rows.length === 0) {
    return <EmptyState message="No players appeared on a roster this season." />;
  }

  const visible = showAll ? sorted : sorted.slice(0, COLLAPSED_LIMIT);

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-center text-muted-foreground">#</TableHead>
              <TableHead>
                <SortHeader
                  label="Player"
                  sortKey="player_name"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="GP"
                  sortKey="games"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
              </TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                <SortHeader
                  label="GS"
                  sortKey="starts"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
              </TableHead>
              <TableHead className="hidden text-right md:table-cell">
                <SortHeader
                  label="BN"
                  sortKey="benches"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Pts"
                  sortKey="total_points"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Pts/G"
                  sortKey="ppg"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={handleSort}
                  align="right"
                />
              </TableHead>
              <TableHead className="hidden text-muted-foreground lg:table-cell">Team</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row, i) => (
              <TableRow
                key={`${row.player_id ?? row.player_name}-${i}`}
                className="border-zinc-800/70 transition-colors hover:bg-foreground/[0.03]"
              >
                <TableCell className="text-center">
                  <span className="font-mono text-xs font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <PositionBadge position={row.position} />
                    <div className="min-w-0">
                      <PlayerLink
                        playerId={row.player_id}
                        className="block truncate text-sm font-medium transition-colors hover:text-emerald-400"
                      >
                        {row.player_name}
                      </PlayerLink>
                      <p className="text-xs text-muted-foreground">{row.nfl_team}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums">
                  {row.games}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-sm tabular-nums sm:table-cell">
                  {row.starts}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-sm tabular-nums md:table-cell">
                  {row.benches}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-bold tabular-nums">
                  {fmtPts(row.total_points)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm tabular-nums text-zinc-300">
                  {fmtPts(row.ppg)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {row.team_id != null && row.tname != null ? (
                    <TeamLink
                      teamId={row.team_id}
                      className="flex items-center gap-1.5 transition-colors hover:text-emerald-400"
                    >
                      {row.color && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                      )}
                      {revealed ? (
                        <span className="truncate text-xs">{row.tname}</span>
                      ) : (
                        <AliasTag label={row.tname} />
                      )}
                    </TeamLink>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
        >
          {showAll ? "Show top 25" : `Show all ${rows.length} players`}
        </button>
      )}
    </div>
  );
}
