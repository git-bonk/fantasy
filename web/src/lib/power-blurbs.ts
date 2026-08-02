export type StreakKind = "W" | "L";

export interface PowerBlurbStreak {
  kind: StreakKind;
  count: number;
}

export interface PowerBlurbInput {
  rank: number;
  prevRank: number | null;
  points: number;
  streak: PowerBlurbStreak;
  luckScore: number | null;
}

export type MovementKind = "riser" | "faller" | "hold" | "first";

export const STREAK_FLAME_THRESHOLD = 3;
export const LUCK_THRESHOLD = 1;
export const POINTS_STATEMENT = 130;
export const POINTS_BUST = 70;

export function movementKind(rank: number, prevRank: number | null): MovementKind {
  if (prevRank === null) return "first";
  if (rank < prevRank) return "riser";
  if (rank > prevRank) return "faller";
  return "hold";
}

export function opener(rank: number, prevRank: number | null): string {
  switch (movementKind(rank, prevRank)) {
    case "riser":
      return `Rising from No. ${prevRank} to No. ${rank},`;
    case "faller":
      return `Slipping from No. ${prevRank} to No. ${rank},`;
    case "hold":
      return `Holding steady at No. ${rank},`;
    case "first":
      return `Opening the board at No. ${rank},`;
  }
}

export function pointsClause(points: number): string {
  const pts = points.toFixed(1);
  if (points >= POINTS_STATEMENT) return `this team made a statement with ${pts} points`;
  if (points <= POINTS_BUST) return `this team scraped together just ${pts} points`;
  return `this team posted ${pts} points`;
}

export function streakClause(streak: PowerBlurbStreak): string {
  if (streak.count < 2) return "";
  const hot = streak.count >= STREAK_FLAME_THRESHOLD;
  if (streak.kind === "W") {
    return hot
      ? ` and is catching fire on a ${streak.count}-game win streak`
      : ` and has won ${streak.count} straight`;
  }
  return hot
    ? ` and is going up in flames on a ${streak.count}-game losing streak`
    : ` and has dropped ${streak.count} straight`;
}

export function luckClause(luckScore: number | null): string {
  if (luckScore === null) return "";
  if (luckScore >= LUCK_THRESHOLD) {
    return ` Luck has been on their side too — outperforming their expected wins by ${luckScore.toFixed(1)}.`;
  }
  if (luckScore <= -LUCK_THRESHOLD) {
    return ` The record flatters the production, though — underperforming their expected wins by ${Math.abs(luckScore).toFixed(1)}.`;
  }
  return "";
}

export function powerBlurb(input: PowerBlurbInput): string {
  const lead = `${opener(input.rank, input.prevRank)} ${pointsClause(input.points)}${streakClause(input.streak)}.`;
  return `${lead}${luckClause(input.luckScore)}`.trim();
}
