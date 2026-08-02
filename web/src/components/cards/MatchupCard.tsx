"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AliasTag } from "@/components/cards/AliasTag";
import { MatchupTagBadge } from "@/components/cards/MatchupTagBadge";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import { fmtPts } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";
import type { MatchupRow, MatchupTag, WeekRosterRow } from "@/lib/types";

interface TeamSideProps {
  teamId: number;
  name: string;
  abbrev: string;
  color: string;
  score: number;
  isWinner: boolean;
  isTie: boolean;
  revealed: boolean;
}

function TeamSide({ teamId, name, abbrev, color, score, isWinner, isTie, revealed }: TeamSideProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        isWinner ? "bg-foreground/[0.04]" : "opacity-70"
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-bold"
        style={{
          backgroundColor: `${color}1f`,
          color,
          boxShadow: isWinner ? `0 0 0 1px ${color}55` : undefined,
        }}
      >
        {abbrev}
      </span>
      <div className="min-w-0 flex-1">
        <TeamLink teamId={teamId} className="inline-flex max-w-full items-center">
          {revealed ? (
            <span
              className={cn(
                "truncate text-sm font-semibold transition-colors hover:text-emerald-400",
                isWinner ? "text-foreground" : "text-zinc-400"
              )}
            >
              {name}
            </span>
          ) : (
            <AliasTag label={name} className="transition-colors hover:border-zinc-600" />
          )}
        </TeamLink>
        <p className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
          {isWinner ? "Winner" : isTie ? "Tie" : "\u00a0"}
        </p>
      </div>
      <span
        className={cn(
          "font-display text-2xl font-bold tabular-nums",
          isWinner ? "text-foreground" : "text-zinc-500"
        )}
      >
        {fmtPts(score)}
      </span>
    </div>
  );
}

interface BoxScoreRowProps {
  row: WeekRosterRow;
  color: string;
  isTop: boolean;
}

function BoxScoreRow({ row, color, isTop }: BoxScoreRowProps) {
  const isStarter = row.lineup_slot !== "BN";
  return (
    <div
      title={`${row.player_name} · ${row.position} · ${row.nfl_team}`}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-foreground/[0.04]",
        !isStarter && "opacity-55"
      )}
    >
      <span
        className={cn(
          "w-8 shrink-0 rounded px-1 py-px text-center font-mono text-[9px] font-bold",
          !isStarter && "bg-zinc-800 text-zinc-500"
        )}
        style={isStarter ? { backgroundColor: `${color}1a`, color } : undefined}
      >
        {row.lineup_slot}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs font-medium",
          !isStarter && "font-normal text-zinc-500"
        )}
      >
        {row.player_name}
      </span>
      <span className="w-7 shrink-0 font-mono text-[10px] text-zinc-600">{row.position}</span>
      <span
        className={cn(
          "w-11 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums",
          isTop ? "text-emerald-400" : "text-zinc-300"
        )}
      >
        {fmtPts(row.points)}
      </span>
    </div>
  );
}

interface RosterColumnProps {
  abbrev: string;
  color: string;
  score: number;
  rows: WeekRosterRow[];
}

function RosterColumn({ abbrev, color, score, rows }: RosterColumnProps) {
  const starters = rows.filter((r) => r.lineup_slot !== "BN");
  const bench = rows.filter((r) => r.lineup_slot === "BN");
  const top = starters.reduce((best, r) => Math.max(best, r.points), 0);

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between px-1.5">
        <span
          className="rounded px-1.5 py-0.5 font-display text-[10px] font-bold"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          {abbrev}
        </span>
        <span className="font-display text-sm font-bold tabular-nums">{fmtPts(score)}</span>
      </div>
      <div className="space-y-px">
        {starters.map((r, i) => (
          <BoxScoreRow
            key={`s-${r.player_name}-${i}`}
            row={r}
            color={color}
            isTop={top > 0 && r.points === top}
          />
        ))}
      </div>
      {bench.length > 0 && (
        <>
          <div className="my-1 flex items-center gap-1.5 px-1.5">
            <span className="text-[9px] font-semibold tracking-widest text-zinc-600 uppercase">
              Bench
            </span>
            <span className="h-px flex-1 bg-zinc-800" />
          </div>
          <div className="space-y-px">
            {bench.map((r, i) => (
              <BoxScoreRow key={`b-${r.player_name}-${i}`} row={r} color={color} isTop={false} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export interface MatchupRosters {
  home: WeekRosterRow[];
  away: WeekRosterRow[];
}

interface MatchupCardProps {
  matchup: MatchupRow;
  tag?: MatchupTag | null;
  rosters?: MatchupRosters | null;
  autoOpenOnDesktop?: boolean;
  revealed: boolean;
  className?: string;
}

export function MatchupCard({ matchup, tag, rosters, autoOpenOnDesktop = false, revealed, className }: MatchupCardProps) {
  const m = matchup;
  const isTie = m.winner_team_id === null;
  const awayWins = !isTie && m.winner_team_id === m.aid;
  const homeWins = !isTie && m.winner_team_id === m.hid;
  const expandable = Boolean(rosters);
  const homeRoster = rosters?.home ?? [];
  const awayRoster = rosters?.away ?? [];
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? (autoOpenOnDesktop && isDesktop);
  const reduce = useReducedMotion();

  const sides = (
    <>
      <TeamSide
        teamId={m.aid}
        name={m.aname}
        abbrev={m.aabb}
        color={m.acolor}
        score={m.away_score}
        isWinner={awayWins}
        isTie={isTie}
        revealed={revealed}
      />
      <TeamSide
        teamId={m.hid}
        name={m.hname}
        abbrev={m.habb}
        color={m.hcolor}
        score={m.home_score}
        isWinner={homeWins}
        isTie={isTie}
        revealed={revealed}
      />
    </>
  );

  return (
    <Card
      className={cn(
        "border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-all duration-200",
        expandable
          ? open
            ? "border-zinc-700"
            : "hover:border-zinc-700"
          : "hover:-translate-y-0.5 hover:border-zinc-700",
        className
      )}
    >
      <CardContent className="space-y-1 p-2.5">
        {tag && (
          <div className="flex justify-end pb-0.5">
            <MatchupTagBadge tag={tag} />
          </div>
        )}
        {expandable ? (
          <button
            type="button"
            onClick={() => setUserOpen(!open)}
            aria-expanded={open}
            className="group w-full cursor-pointer space-y-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            {sides}
            <span className="flex items-center justify-center gap-1 pt-1 text-[10px] font-medium tracking-wider text-zinc-500 uppercase transition-colors group-hover:text-zinc-300">
              <ChevronDown
                className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")}
              />
              {open ? "Hide box score" : "Box score"}
            </span>
          </button>
        ) : (
          sides
        )}
        {expandable && (
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="box-score"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-2 border-t border-zinc-800 pt-2">
                  <RosterColumn
                    abbrev={m.aabb}
                    color={m.acolor}
                    score={m.away_score}
                    rows={awayRoster}
                  />
                  <RosterColumn
                    abbrev={m.habb}
                    color={m.hcolor}
                    score={m.home_score}
                    rows={homeRoster}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}
