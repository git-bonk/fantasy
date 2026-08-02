export function matchupKey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

export function winProbability(homeElo: number, awayElo: number): number {
  return 1 / (1 + 10 ** ((awayElo - homeElo) / 400));
}
