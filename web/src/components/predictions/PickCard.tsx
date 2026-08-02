"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WinProbBar } from "@/components/charts/WinProbBar";
import { clearPick, setPick } from "@/lib/prediction-actions";
import { fmtDate, fmtPts } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PickableRow } from "@/lib/types";

interface PickSideProps {
  name: string;
  abbrev: string;
  color: string;
  score: number | null;
  played: boolean;
  isWinner: boolean;
  isPicked: boolean;
  resolved: "hit" | "miss" | null;
  disabled: boolean;
  onClick: () => void;
}

function PickSide({
  name,
  abbrev,
  color,
  score,
  played,
  isWinner,
  isPicked,
  resolved,
  disabled,
  onClick,
}: PickSideProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? undefined : isPicked ? `Clear pick: ${name}` : `Pick ${name}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
        isPicked
          ? "bg-emerald-500/10 ring-1 ring-emerald-500/40"
          : "hover:bg-foreground/[0.04]",
        played && !isWinner && "opacity-70",
        disabled && "cursor-not-allowed opacity-60 hover:bg-transparent"
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-bold"
        style={{
          backgroundColor: `${color}1f`,
          color,
          boxShadow: isPicked ? `0 0 0 1px ${color}55` : undefined,
        }}
      >
        {abbrev}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            isPicked ? "text-foreground" : "text-zinc-400"
          )}
        >
          {name}
        </p>
        <p className="text-[10px] font-medium tracking-wider uppercase">
          {isPicked && resolved ? (
            <span className={resolved === "hit" ? "text-emerald-400" : "text-rose-400"}>
              {resolved === "hit" ? "Hit" : "Miss"}
            </span>
          ) : isPicked ? (
            <span className="text-emerald-400">Your pick</span>
          ) : (
            <span className="text-zinc-500">{"\u00a0"}</span>
          )}
        </p>
      </div>
      {played && score != null && (
        <span
          className={cn(
            "font-display text-2xl font-bold tabular-nums",
            isWinner ? "text-foreground" : "text-zinc-500"
          )}
        >
          {fmtPts(score)}
        </span>
      )}
    </button>
  );
}

interface PickCardProps {
  row: PickableRow;
  pickedTeamId: number | null;
  locked: boolean;
  signedIn: boolean;
  seasonId: number;
  weekNum: number;
}

export function PickCard({
  row,
  pickedTeamId,
  locked,
  signedIn,
  seasonId,
  weekNum,
}: PickCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (errorTimer.current !== null) window.clearTimeout(errorTimer.current);
    },
    []
  );

  const played = row.home_score != null && row.away_score != null;
  const resolved: "hit" | "miss" | null =
    played && pickedTeamId != null && row.winner_team_id != null
      ? pickedTeamId === row.winner_team_id
        ? "hit"
        : "miss"
      : null;
  const disabled = locked || !signedIn || pending;

  async function handlePick(teamId: number) {
    if (locked || !signedIn || pending) return;
    setPending(true);
    setError(null);
    const res =
      teamId === pickedTeamId
        ? await clearPick(seasonId, weekNum, row.matchup_key)
        : await setPick(seasonId, weekNum, row.matchup_key, teamId);
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Pick failed.");
      if (errorTimer.current !== null) window.clearTimeout(errorTimer.current);
      errorTimer.current = window.setTimeout(() => setError(null), 2500);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="border border-zinc-800 bg-zinc-900/60 py-0 ring-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700">
      <CardContent className="space-y-1 p-2.5">
        <div className="flex items-center justify-between px-1 pb-0.5">
          {resolved ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                resolved === "hit"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-rose-500/10 text-rose-500"
              )}
            >
              {resolved === "hit" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {resolved === "hit" ? "Hit" : "Miss"}
            </span>
          ) : played ? (
            <span className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
              Final
            </span>
          ) : (
            <span className="text-[10px] text-transparent">{"\u00a0"}</span>
          )}
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-rose-400 uppercase">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          ) : (
            row.kickoff && (
              <span className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                Locks {fmtDate(row.kickoff)}
              </span>
            )
          )}
        </div>

        <PickSide
          name={row.aname}
          abbrev={row.aabb}
          color={row.acolor}
          score={row.away_score}
          played={played}
          isWinner={row.winner_team_id === row.aid}
          isPicked={pickedTeamId === row.aid}
          resolved={resolved}
          disabled={disabled}
          onClick={() => handlePick(row.aid)}
        />
        <PickSide
          name={row.hname}
          abbrev={row.habb}
          color={row.hcolor}
          score={row.home_score}
          played={played}
          isWinner={row.winner_team_id === row.hid}
          isPicked={pickedTeamId === row.hid}
          resolved={resolved}
          disabled={disabled}
          onClick={() => handlePick(row.hid)}
        />

        {row.prob != null && (
          <div className="border-t border-zinc-800 px-1 pt-2.5">
            <WinProbBar
              homeProb={row.prob}
              homeColor={row.hcolor}
              awayColor={row.acolor}
              homeAbbrev={row.habb}
              awayAbbrev={row.aabb}
            />
          </div>
        )}

        <div className="min-h-4 px-1">
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
