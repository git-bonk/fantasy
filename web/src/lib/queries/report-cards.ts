import { db } from "../db";
import { maskRows, maskedOwnerName } from "./shared";

export type LetterGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "C-"
  | "D"
  | "F"
  | "—";

export interface GradeInput {
  scoring: number | null;
  luck: number | null;
  activity: number | null;
  waiver: number | null;
  consistency: number | null;
}

export interface SeasonGrades {
  composite: LetterGrade;
  scoring: LetterGrade;
  luck: LetterGrade;
  activity: LetterGrade;
  waiver: LetterGrade;
  consistency: LetterGrade;
}

export interface ReportCardMetrics {
  pfRank: number | null;
  teamCount: number;
  luckTotal: number | null;
  activity: number | null;
  waiverNet: number | null;
  consistency: number | null;
}

export interface SeasonReportCard {
  owner_alias_num: number | null;
  owner_name: string;
  color: string;
  metrics: ReportCardMetrics;
  grades: SeasonGrades;
}

const GRADE_SCALE: ReadonlyArray<readonly [number, LetterGrade]> = [
  [0.95, "A+"],
  [0.85, "A"],
  [0.75, "A-"],
  [0.65, "B+"],
  [0.55, "B"],
  [0.45, "B-"],
  [0.35, "C+"],
  [0.25, "C"],
  [0.15, "C-"],
  [0.05, "D"],
];

export const NEUTRAL_PERCENTILE = 0.5;

export function gradeFromPercentile(percentile: number | null): LetterGrade {
  if (percentile === null) return "—";
  for (const [threshold, grade] of GRADE_SCALE) {
    if (percentile >= threshold) return grade;
  }
  return "F";
}

const GRADE_RANK: Record<LetterGrade, number> = {
  "A+": 12,
  A: 11,
  "A-": 10,
  "B+": 9,
  B: 8,
  "B-": 7,
  "C+": 6,
  C: 5,
  "C-": 4,
  D: 3,
  F: 2,
  "—": 1,
};

export function letterGradeRank(grade: LetterGrade): number {
  return GRADE_RANK[grade];
}

export function gradeSeason(metrics: GradeInput): SeasonGrades {
  const components = [
    metrics.scoring,
    metrics.luck,
    metrics.activity,
    metrics.waiver,
    metrics.consistency,
  ];
  const present = components.filter((v): v is number => v !== null);
  const composite =
    present.length === 0 ? null : present.reduce((sum, v) => sum + v, 0) / present.length;

  return {
    composite: gradeFromPercentile(composite),
    scoring: gradeFromPercentile(metrics.scoring),
    luck: gradeFromPercentile(metrics.luck),
    activity: gradeFromPercentile(metrics.activity),
    waiver: gradeFromPercentile(metrics.waiver),
    consistency: gradeFromPercentile(metrics.consistency),
  };
}

function stddev(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function percentileOf(value: number, all: readonly number[], higherIsBetter: boolean): number {
  if (all.length <= 1) return NEUTRAL_PERCENTILE;
  let worse = 0;
  for (const other of all) {
    if (higherIsBetter ? other < value : other > value) worse++;
  }
  return worse / (all.length - 1);
}

interface OwnerBaseRow {
  owner_id: string;
  owner_alias_num: number | null;
  owner_name: string;
  team_id: number;
  color: string;
}

export async function getSeasonReportCards(seasonId: number): Promise<SeasonReportCard[]> {
  const owners = db
    .prepare(
      `SELECT o.id AS owner_id, o.alias_num AS owner_alias_num, o.display_name AS owner_name,
              t.id AS team_id, t.color
       FROM teams t JOIN owners o ON o.id = t.owner_id
       WHERE t.season_id = @seasonId
       ORDER BY o.alias_num`
    )
    .all({ seasonId }) as OwnerBaseRow[];

  if (owners.length === 0) return [];

  const pfRows = db
    .prepare(
      `SELECT ps.team_id, ps.points_for
       FROM playoff_snapshots ps
       WHERE ps.season_id = @seasonId AND ps.week_num = (
         SELECT MAX(week_num) FROM playoff_snapshots WHERE season_id = @seasonId
       )`
    )
    .all({ seasonId }) as { team_id: number; points_for: number }[];
  const pfByTeam = new Map(pfRows.map((r) => [r.team_id, r.points_for]));

  const luckRows = db
    .prepare(
      `SELECT team_id, SUM(luck_score) AS luck_total
       FROM luck WHERE season_id = @seasonId GROUP BY team_id`
    )
    .all({ seasonId }) as { team_id: number; luck_total: number }[];
  const luckByTeam = new Map(luckRows.map((r) => [r.team_id, r.luck_total]));

  const activityRows = db
    .prepare(
      `SELECT team_id, COUNT(*) AS activity
       FROM transactions
       WHERE season_id = @seasonId AND source = 'derived' AND team_id IS NOT NULL
       GROUP BY team_id`
    )
    .all({ seasonId }) as { team_id: number; activity: number }[];
  const activityByTeam = new Map(activityRows.map((r) => [r.team_id, r.activity]));

  const waiverRows = db
    .prepare(
      `SELECT team_id,
              SUM(CASE move_type WHEN 'ADD' THEN points_after ELSE -points_after END) AS waiver_net
       FROM waiver_impact WHERE season_id = @seasonId GROUP BY team_id`
    )
    .all({ seasonId }) as { team_id: number; waiver_net: number }[];
  const waiverByTeam = new Map(waiverRows.map((r) => [r.team_id, r.waiver_net]));

  const scoreRows = db
    .prepare(
      `SELECT m.home_team_id AS team_id, m.home_score AS score
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       WHERE w.season_id = @seasonId AND w.is_playoff = 0
       UNION ALL
       SELECT m.away_team_id AS team_id, m.away_score AS score
       FROM matchups m JOIN weeks w ON w.id = m.week_id
       WHERE w.season_id = @seasonId AND w.is_playoff = 0`
    )
    .all({ seasonId }) as { team_id: number; score: number }[];
  const scoresByTeam = new Map<number, number[]>();
  for (const row of scoreRows) {
    const list = scoresByTeam.get(row.team_id);
    if (list) list.push(row.score);
    else scoresByTeam.set(row.team_id, [row.score]);
  }

  const enriched = owners.map((o) => ({
    ...o,
    pf: pfByTeam.get(o.team_id) ?? null,
    luckTotal: luckByTeam.get(o.team_id) ?? null,
    activity: activityByTeam.get(o.team_id) ?? null,
    waiverNet: waiverByTeam.get(o.team_id) ?? null,
    consistency: stddev(scoresByTeam.get(o.team_id) ?? []),
  }));

  const rankedPf = enriched
    .filter((r): r is typeof r & { pf: number } => r.pf !== null)
    .sort((a, b) => b.pf - a.pf);
  const pfRankByOwner = new Map(rankedPf.map((r, i) => [r.owner_id, i + 1]));
  const teamCount = rankedPf.length;

  const collect = (pick: (r: (typeof enriched)[number]) => number | null): number[] =>
    enriched.map(pick).filter((v): v is number => v !== null);
  const pfVals = collect((r) => r.pf);
  const luckVals = collect((r) => r.luckTotal);
  const activityVals = collect((r) => r.activity);
  const waiverVals = collect((r) => r.waiverNet);
  const consistencyVals = collect((r) => r.consistency);

  const cards = enriched.map((r) => {
    const grades = gradeSeason({
      scoring: r.pf !== null ? percentileOf(r.pf, pfVals, true) : null,
      luck: r.luckTotal !== null ? percentileOf(r.luckTotal, luckVals, true) : null,
      activity: r.activity !== null ? percentileOf(r.activity, activityVals, true) : null,
      waiver: r.waiverNet !== null ? percentileOf(r.waiverNet, waiverVals, true) : null,
      consistency:
        r.consistency !== null ? percentileOf(r.consistency, consistencyVals, false) : null,
    });
    return {
      owner_alias_num: r.owner_alias_num,
      owner_name: r.owner_name,
      color: r.color,
      metrics: {
        pfRank: pfRankByOwner.get(r.owner_id) ?? null,
        teamCount,
        luckTotal: r.luckTotal,
        activity: r.activity,
        waiverNet: r.waiverNet,
        consistency: r.consistency,
      },
      grades,
    };
  });

  return maskRows(cards, (r) => ({ owner_name: maskedOwnerName(r.owner_alias_num) }));
}
