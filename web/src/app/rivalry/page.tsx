import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { RivalryPicker } from "@/components/rivalry/RivalryPicker";
import { StreakBadge } from "@/components/cards/StreakBadge";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { getRivalryGames, getTeam, getTeams } from "@/lib/queries";
import { resolveSeason } from "@/lib/resolve-season";
import { fmtPts } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Team } from "@/lib/types";

interface RivalryPageProps {
  searchParams: Promise<{ year?: string; week?: string; a?: string; b?: string }>;
}

function TeamLockup({ team, flip }: { team: Team; flip?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-3",
        flip && "flex-row-reverse text-right"
      )}
    >
      <span
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl font-display text-lg font-bold"
        style={{ backgroundColor: `${team.color}1f`, color: team.color }}
      >
        {team.abbrev}
      </span>
      <p className="min-w-0 truncate font-display text-xl font-bold md:text-2xl">{team.name}</p>
    </div>
  );
}

interface StatChipProps {
  label: string;
  children: React.ReactNode;
}

function StatChip({ label, children }: StatChipProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-center">
      <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">{label}</p>
      <div className="mt-1.5 flex items-center justify-center gap-1.5">{children}</div>
    </div>
  );
}

export default async function RivalryPage({ searchParams }: RivalryPageProps) {
  const ctx = await resolveSeason(searchParams);
  const seasonId = ctx.seasonId;
  const teams = getTeams(seasonId);
  const validIds = teams.map((t) => t.id);

  if (validIds.length < 2) {
    return (
      <div className="space-y-6">
        <PageHeader title="Rivalry Finder" subtitle="All-time head-to-head" />
        <p className="py-16 text-center text-sm text-zinc-500">Not enough teams to compare.</p>
      </div>
    );
  }

  const params = await searchParams;
  let a = Number(params.a) || validIds[0];
  let b = Number(params.b) || validIds[1];
  if (!validIds.includes(a)) a = validIds[0];
  if (!validIds.includes(b)) b = validIds[1];
  if (a === b) b = validIds.find((id) => id !== a) ?? b;

  const teamA = getTeam(seasonId, a);
  const teamB = getTeam(seasonId, b);
  if (!teamA || !teamB) notFound();

  const games = getRivalryGames(seasonId, a, b);

  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  let totalPoints = 0;
  let totalMargin = 0;
  for (const g of games) {
    const aScore = g.home_team_id === a ? g.home_score : g.away_score;
    const bScore = g.home_team_id === b ? g.home_score : g.away_score;
    totalPoints += aScore + bScore;
    totalMargin += Math.abs(aScore - bScore);
    if (g.winner_team_id === a) aWins++;
    else if (g.winner_team_id === b) bWins++;
    else ties++;
  }
  const meetings = games.length;
  const avgMargin = meetings > 0 ? totalMargin / meetings : 0;

  let streakTeamId: number | null = null;
  let streakLen = 0;
  for (let i = games.length - 1; i >= 0; i--) {
    const winner = games[i].winner_team_id;
    if (winner === null) break;
    if (streakTeamId === null) {
      streakTeamId = winner;
      streakLen = 1;
    } else if (winner === streakTeamId) {
      streakLen++;
    } else {
      break;
    }
  }
  const streakTeam = streakTeamId === a ? teamA : streakTeamId === b ? teamB : null;

  const record = `${aWins}\u2013${bWins}${ties > 0 ? `\u2013${ties}` : ""}`;
  const seriesText =
    aWins > bWins
      ? `${teamA.name} lead ${record}`
      : bWins > aWins
        ? `${teamB.name} lead ${bWins}\u2013${aWins}${ties > 0 ? `\u2013${ties}` : ""}`
        : `Series tied ${record}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Rivalry Finder" subtitle="All-time head-to-head" />

      <Reveal>
        <RivalryPicker teams={teams} a={a} b={b} />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 md:p-8">
          <div className="flex items-center gap-4">
            <TeamLockup team={teamA} flip />
            <span className="shrink-0 font-display text-3xl font-black text-zinc-700 md:text-4xl">
              VS
            </span>
            <TeamLockup team={teamB} />
          </div>
          <p className="mt-6 text-center font-display text-2xl font-bold tracking-tight md:text-3xl">
            {meetings === 0 ? "Never met" : seriesText}
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatChip label="H2H Streak">
            {streakLen >= 2 && streakTeam ? (
              <>
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                  style={{ backgroundColor: `${streakTeam.color}1f`, color: streakTeam.color }}
                >
                  {streakTeam.abbrev}
                </span>
                <StreakBadge streak={streakLen} type="W" />
              </>
            ) : (
              <span className="font-display text-lg font-bold text-zinc-400">Even</span>
            )}
          </StatChip>
          <StatChip label="Avg Margin">
            <span className="font-display text-lg font-bold tabular-nums">
              {meetings > 0 ? avgMargin.toFixed(1) : "—"}
            </span>
          </StatChip>
          <StatChip label="Total Points">
            <span className="font-display text-lg font-bold tabular-nums">
              {meetings > 0 ? totalPoints.toFixed(0) : "—"}
            </span>
          </StatChip>
        </div>
      </Reveal>

      <section className="space-y-3">
        <Reveal>
          <h2 className="font-display text-sm font-semibold tracking-widest text-zinc-500 uppercase">
            Meetings ({meetings})
          </h2>
        </Reveal>
        {meetings === 0 ? (
          <Reveal>
            <p className="py-12 text-center text-sm text-zinc-500">
              These two teams have never faced off.
            </p>
          </Reveal>
        ) : (
          <Stagger className="space-y-2" stagger={0.04}>
            {games.map((g) => {
              const aIsHome = g.home_team_id === a;
              const aScore = aIsHome ? g.home_score : g.away_score;
              const bScore = aIsHome ? g.away_score : g.home_score;
              const aWon = g.winner_team_id === a;
              const bWon = g.winner_team_id === b;
              const margin = Math.abs(aScore - bScore);
              return (
                <StaggerItem key={g.id}>
                  <div className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                    <div className="w-24 shrink-0">
                      <p className="text-sm font-semibold">{g.label}</p>
                      {g.is_playoff === 1 && (
                        <p className="text-[9px] font-bold tracking-wider text-amber-400 uppercase">
                          Playoff
                        </p>
                      )}
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <span
                        className={cn(
                          "flex items-center gap-2 font-mono tabular-nums",
                          aWon ? "font-bold" : "text-zinc-500"
                        )}
                      >
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                          style={{ backgroundColor: `${teamA.color}1f`, color: teamA.color }}
                        >
                          {teamA.abbrev}
                        </span>
                        <span className={cn("text-sm", aWon && "text-foreground")}>
                          {fmtPts(aScore)}
                        </span>
                      </span>
                      <span className="text-[10px] text-zinc-600">vs</span>
                      <span
                        className={cn(
                          "flex items-center gap-2 font-mono tabular-nums",
                          bWon ? "font-bold" : "text-zinc-500"
                        )}
                      >
                        <span className={cn("text-sm", bWon && "text-foreground")}>
                          {fmtPts(bScore)}
                        </span>
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                          style={{ backgroundColor: `${teamB.color}1f`, color: teamB.color }}
                        >
                          {teamB.abbrev}
                        </span>
                      </span>
                    </div>
                    <div className="w-14 shrink-0 text-right">
                      <p className="text-[9px] tracking-wider text-zinc-500 uppercase">Margin</p>
                      <p className="font-mono text-sm font-bold tabular-nums">
                        {g.winner_team_id === null ? "TIE" : margin.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </section>
    </div>
  );
}
