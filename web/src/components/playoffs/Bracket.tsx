import { BracketGame } from "./BracketGame";
import type { BracketGameRow } from "@/lib/types";

interface BracketProps {
  games: BracketGameRow[];
}

interface Round {
  label: string;
  games: BracketGameRow[];
}

function organizeRounds(games: BracketGameRow[]): Round[] {
  const byWeek = new Map<number, BracketGameRow[]>();
  for (const g of games) {
    const list = byWeek.get(g.week_num) ?? [];
    list.push(g);
    byWeek.set(g.week_num, list);
  }

  const weekNums = [...byWeek.keys()].sort((a, b) => a - b);
  if (weekNums.length === 0) return [];

  const rounds: Round[] = [];
  const lastWeek = weekNums[weekNums.length - 1];
  const semiWeek = weekNums[weekNums.length - 2];

  for (const week of weekNums) {
    const weekGames = byWeek.get(week) ?? [];
    const label = weekGames[0]?.label ?? `Round ${week}`;

    if (week === lastWeek && weekGames.length > 1 && semiWeek != null) {
      const semiWinners = new Set(
        (byWeek.get(semiWeek) ?? [])
          .map((g) => g.winner_team_id)
          .filter((id): id is number => id != null)
      );
      const championship = weekGames.filter(
        (g) => semiWinners.has(g.hid) && semiWinners.has(g.aid)
      );
      const consolation = weekGames.filter((g) => !championship.includes(g));
      rounds.push({ label, games: [...championship, ...consolation] });
    } else {
      rounds.push({ label, games: weekGames });
    }
  }

  return rounds;
}

export function Bracket({ games }: BracketProps) {
  const rounds = organizeRounds(games);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 md:gap-8">
      {rounds.map((round, ri) => (
        <div key={round.label} className="flex shrink-0 flex-col">
          <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {round.label}
          </div>
          <div className="flex flex-1 flex-col justify-around gap-4">
            {round.games.map((game, gi) => (
              <BracketGame
                key={game.id}
                game={game}
                label={ri === rounds.length - 1 && gi === 0 ? "Championship" : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
