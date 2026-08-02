import { aliasOwner, aliasTeam, getRevealState } from "../reveal";

export function maskedTeamName(aliasNum: number | null | undefined): string {
  return aliasTeam(aliasNum ?? 0);
}

export function maskedTeamAbbrev(aliasNum: number | null | undefined): string {
  return `T${aliasNum ?? 0}`;
}

export function maskedOwnerName(aliasNum: number | null | undefined): string {
  return aliasOwner(aliasNum ?? 0);
}

export async function maskRows<T>(rows: T[], mask: (row: T) => Partial<T>): Promise<T[]> {
  if (await getRevealState()) return rows;
  return rows.map((row) => ({ ...row, ...mask(row) }));
}

export async function maskOne<T>(row: T, mask: (row: T) => Partial<T>): Promise<T> {
  if (await getRevealState()) return row;
  return { ...row, ...mask(row) };
}
