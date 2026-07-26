"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnimatedRow } from "@/components/motion/Reveal";
import { AliasTag } from "@/components/cards/AliasTag";
import { cn } from "@/lib/utils";
import { fmtRecord } from "@/lib/format";
import type { RankingRow } from "@/lib/types";

type SortKey = "rating" | "record";

interface SortHeaderProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function SortHeader({ label, active, onClick }: SortHeaderProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 transition-colors",
        active ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {label}
      <ChevronDown
        className={cn("h-3 w-3 transition-opacity", active ? "opacity-100" : "opacity-0")}
      />
    </button>
  );
}

interface RankingsTableProps {
  rankings: RankingRow[];
  deltas: Record<number, number>;
  revealed: boolean;
}

export function RankingsTable({ rankings, deltas, revealed }: RankingsTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>("rating");

  const sorted = useMemo(() => {
    const rows = [...rankings];
    if (sortBy === "rating") {
      rows.sort((a, b) => b.rating - a.rating);
    } else {
      rows.sort(
        (a, b) =>
          b.wins - a.wins ||
          b.ties - a.ties ||
          b.points_for - a.points_for ||
          b.rating - a.rating
      );
    }
    return rows;
  }, [rankings, sortBy]);

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800 hover:bg-transparent">
          <TableHead className="w-14 text-zinc-500">Rank</TableHead>
          <TableHead className="text-zinc-500">Team</TableHead>
          <TableHead className="text-right">
            <SortHeader
              label="Record"
              active={sortBy === "record"}
              onClick={() => setSortBy("record")}
            />
          </TableHead>
          <TableHead className="text-right">
            <SortHeader
              label="Rating"
              active={sortBy === "rating"}
              onClick={() => setSortBy("rating")}
            />
          </TableHead>
          <TableHead className="text-right text-zinc-500">Move</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((team, i) => {
          const rounded = Math.round(deltas[team.id] ?? 0);
          return (
            <AnimatedRow
              key={team.id}
              layout
              delay={i * 0.03}
              className="border-zinc-800/70 transition-colors hover:bg-foreground/[0.03]"
            >
              <TableCell className="py-3">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold tabular-nums",
                    i === 0
                      ? "bg-amber-400/15 text-amber-400"
                      : "bg-zinc-800 text-zinc-400"
                  )}
                >
                  {i + 1}
                </span>
              </TableCell>
              <TableCell className="py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-[10px] font-bold"
                    style={{
                      backgroundColor: `${team.color}1f`,
                      color: team.color,
                    }}
                  >
                    {team.abbrev}
                  </span>
                  {revealed ? (
                    <span className="font-semibold">{team.name}</span>
                  ) : (
                    <AliasTag label={team.name} />
                  )}
                </div>
              </TableCell>
              <TableCell className="py-3 text-right font-mono text-sm font-semibold tabular-nums text-zinc-300">
                {fmtRecord(team.wins, team.losses, team.ties)}
              </TableCell>
              <TableCell className="py-3 text-right font-mono text-base font-bold tabular-nums">
                {Math.round(team.rating)}
              </TableCell>
              <TableCell className="py-3 text-right">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums",
                    rounded > 0
                      ? "text-emerald-500"
                      : rounded < 0
                        ? "text-rose-500"
                        : "text-zinc-500"
                  )}
                >
                  {rounded > 0 ? (
                    <ArrowUp className="h-3.5 w-3.5" />
                  ) : rounded < 0 ? (
                    <ArrowDown className="h-3.5 w-3.5" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                  {rounded > 0 ? "+" : ""}
                  {rounded}
                </span>
              </TableCell>
            </AnimatedRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
