import { cn } from "@/lib/utils";
import { fmtPts } from "@/lib/format";
import { AWARD_META } from "@/components/cards/AwardBadge";
import { TeamLink } from "@/components/links/TeamLink";
import type { MatchupRow, PlayerRow, RecapAwardRow } from "@/lib/types";

interface FeaturedTeamProps {
  teamId: number;
  abbrev: string;
  name: string;
  color: string;
  score: number;
  isWinner: boolean;
}

function FeaturedTeam({ teamId, abbrev, name, color, score, isWinner }: FeaturedTeamProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-lg font-display text-xs font-bold"
        style={{
          backgroundColor: `${color}1f`,
          color,
          boxShadow: isWinner ? `0 0 0 1px ${color}55` : undefined,
        }}
      >
        {abbrev}
      </span>
      <TeamLink
        teamId={teamId}
        className={cn(
          "w-full truncate text-xs font-semibold transition-colors hover:text-emerald-400",
          isWinner ? "text-foreground" : "text-zinc-500"
        )}
      >
        {name}
      </TeamLink>
      <p
        className={cn(
          "font-display text-2xl font-bold tabular-nums",
          isWinner ? "text-foreground" : "text-zinc-500"
        )}
      >
        {fmtPts(score)}
      </p>
    </div>
  );
}

interface MiniStatProps {
  label: string;
  value: string;
  sub?: string | null;
}

function MiniStat({ label, value, sub }: MiniStatProps) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="truncate text-[10px] text-zinc-500">{sub}</p>}
    </div>
  );
}

interface RecapCardProps {
  weekLabel: string;
  seasonYear: number;
  leagueName: string;
  featured: MatchupRow | null;
  awards: RecapAwardRow[];
  topScorer: PlayerRow | null;
  biggestBust: RecapAwardRow | null;
  leagueAvg: number;
}

export function RecapCard({
  weekLabel,
  seasonYear,
  leagueName,
  featured,
  awards,
  topScorer,
  biggestBust,
  leagueAvg,
}: RecapCardProps) {
  const featuredIsTie = featured?.winner_team_id === null;

  return (
    <div className="relative w-[560px] max-w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative space-y-5 p-6">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
            Fantasy NFL · {seasonYear}
          </p>
          <h3 className="mt-1 font-display text-3xl font-bold tracking-tight">{weekLabel}</h3>
        </div>

        {featured && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <p className="mb-3 text-[10px] font-semibold tracking-widest text-emerald-500 uppercase">
              Game of the Week
            </p>
            <div className="flex items-start justify-between gap-3">
              <FeaturedTeam
                teamId={featured.aid}
                abbrev={featured.aabb}
                name={featured.aname}
                color={featured.acolor}
                score={featured.away_score}
                isWinner={!featuredIsTie && featured.winner_team_id === featured.aid}
              />
              <span className="mt-3 font-display text-xs font-bold text-zinc-600">VS</span>
              <FeaturedTeam
                teamId={featured.hid}
                abbrev={featured.habb}
                name={featured.hname}
                color={featured.hcolor}
                score={featured.home_score}
                isWinner={!featuredIsTie && featured.winner_team_id === featured.hid}
              />
            </div>
          </div>
        )}

        {awards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {awards.map((a, i) => {
              const meta = AWARD_META[a.type];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <span
                  key={`${a.type}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1"
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  <span
                    className="text-[10px] font-semibold tracking-wider uppercase"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  {a.value != null && (
                    <span className="font-mono text-[10px] font-bold tabular-nums text-zinc-300">
                      {fmtPts(a.value)}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4">
          <MiniStat
            label="Top Scorer"
            value={topScorer ? fmtPts(topScorer.points) : "—"}
            sub={topScorer?.player_name}
          />
          <MiniStat
            label="Biggest Bust"
            value={biggestBust?.value != null ? fmtPts(biggestBust.value) : "—"}
            sub={biggestBust?.tname ?? biggestBust?.player_name}
          />
          <MiniStat label="League Avg" value={fmtPts(leagueAvg)} sub="per team" />
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
          <p className="text-[10px] text-zinc-500">Screenshot this for the group chat</p>
          <p className="text-[10px] font-semibold text-zinc-400">{leagueName}</p>
        </div>
      </div>
    </div>
  );
}
