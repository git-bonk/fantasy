import { ArrowRightLeft } from "lucide-react";
import { TeamLink } from "@/components/links/TeamLink";
import { cn } from "@/lib/utils";
import { fmtPts } from "@/lib/format";
import type { TradeGradeRow, TradePlayer } from "@/lib/queries";

interface TradeGradesProps {
  trades: TradeGradeRow[];
}

export function TradeGrades({ trades }: TradeGradesProps) {
  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center text-sm text-zinc-400">
        No trades recorded this season.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trades.map((trade) => (
        <TradeCard
          key={`${trade.week_num}-${trade.team_a_id}-${trade.team_b_id}`}
          trade={trade}
        />
      ))}
    </div>
  );
}

function TradeCard({ trade }: { trade: TradeGradeRow }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-zinc-500" />
          <span className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {trade.week_label}
          </span>
          <span className="font-mono text-sm font-bold tabular-nums text-zinc-300">
            {fmtPts(trade.a_points)} – {fmtPts(trade.b_points)}
          </span>
        </div>
        <TradeVerdict trade={trade} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TradeSide
          teamId={trade.team_a_id}
          tname={trade.tname_a}
          color={trade.color_a}
          players={trade.a_players}
          points={trade.a_points}
          won={trade.winner_side === "A"}
        />
        <TradeSide
          teamId={trade.team_b_id}
          tname={trade.tname_b}
          color={trade.color_b}
          players={trade.b_players}
          points={trade.b_points}
          won={trade.winner_side === "B"}
        />
      </div>
    </div>
  );
}

function TradeVerdict({ trade }: { trade: TradeGradeRow }) {
  if (!trade.finalized) {
    return (
      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        Too early to tell
      </span>
    );
  }
  if (trade.winner_side === null) {
    return (
      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        Dead even
      </span>
    );
  }
  return (
    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
      {trade.winner_side === "A" ? trade.tname_a : trade.tname_b} wins
    </span>
  );
}

interface TradeSideProps {
  teamId: number;
  tname: string;
  color: string;
  players: TradePlayer[];
  points: number | null;
  won: boolean;
}

function TradeSide({ teamId, tname, color, players, points, won }: TradeSideProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        won ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800 bg-zinc-950/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <TeamLink
          teamId={teamId}
          className="flex min-w-0 items-center gap-1.5 transition-colors hover:text-emerald-400"
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-sm font-semibold">{tname}</span>
        </TeamLink>
        <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{fmtPts(points)}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {players.length === 0 && <li className="text-xs text-zinc-500">Nothing received</li>}
        {players.map((p) => (
          <li key={p.pid} className="flex items-center gap-1.5 text-xs text-zinc-300">
            <span className="shrink-0 rounded bg-zinc-800 px-1 py-0.5 font-mono text-[10px] text-zinc-400">
              {p.position}
            </span>
            <span className="truncate">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
