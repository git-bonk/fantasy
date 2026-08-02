import { describe, expect, it } from "vitest";
import {
  NEUTRAL_PERCENTILE,
  gradeFromPercentile,
  gradeSeason,
  letterGradeRank,
  type GradeInput,
} from "@/lib/queries/report-cards";

const metrics = (overrides: Partial<GradeInput> = {}): GradeInput => ({
  scoring: null,
  luck: null,
  activity: null,
  waiver: null,
  consistency: null,
  ...overrides,
});

describe("gradeFromPercentile", () => {
  it("maps the top of the league to A+", () => {
    expect(gradeFromPercentile(1)).toBe("A+");
    expect(gradeFromPercentile(0.95)).toBe("A+");
  });

  it("maps the bottom to F", () => {
    expect(gradeFromPercentile(0)).toBe("F");
    expect(gradeFromPercentile(0.04)).toBe("F");
  });

  it("respects the boundary between tiers", () => {
    expect(gradeFromPercentile(0.85)).toBe("A");
    expect(gradeFromPercentile(0.8499)).toBe("A-");
  });

  it("returns a dash for null", () => {
    expect(gradeFromPercentile(null)).toBe("—");
  });
});

describe("gradeSeason", () => {
  it("gives a top-percentile owner straight A+s", () => {
    const grades = gradeSeason(
      metrics({ scoring: 1, luck: 1, activity: 1, waiver: 1, consistency: 1 })
    );
    expect(grades.composite).toBe("A+");
    expect(grades.scoring).toBe("A+");
    expect(grades.consistency).toBe("A+");
  });

  it("gives a bottom-percentile owner Fs", () => {
    const grades = gradeSeason(
      metrics({ scoring: 0, luck: 0, activity: 0, waiver: 0, consistency: 0 })
    );
    expect(grades.composite).toBe("F");
    expect(grades.waiver).toBe("F");
  });

  it("builds the composite from the component average", () => {
    const grades = gradeSeason(metrics({ scoring: 1, luck: 0 }));
    expect(grades.scoring).toBe("A+");
    expect(grades.luck).toBe("F");
    expect(grades.composite).toBe(gradeFromPercentile(NEUTRAL_PERCENTILE));
  });

  it("averages only the metrics that are present", () => {
    const grades = gradeSeason(metrics({ scoring: 1, luck: 1, waiver: 0 }));
    expect(grades.composite).toBe(gradeFromPercentile(2 / 3));
  });

  it("tolerates a fully empty season with dashes", () => {
    const grades = gradeSeason(metrics());
    expect(grades.composite).toBe("—");
    expect(grades.scoring).toBe("—");
    expect(grades.luck).toBe("—");
    expect(grades.activity).toBe("—");
    expect(grades.waiver).toBe("—");
    expect(grades.consistency).toBe("—");
  });

  it("grades a single present metric without dragging the composite down", () => {
    const grades = gradeSeason(metrics({ scoring: 0.9 }));
    expect(grades.scoring).toBe("A");
    expect(grades.composite).toBe("A");
  });
});

describe("letterGradeRank", () => {
  it("orders better grades higher", () => {
    expect(letterGradeRank("A+")).toBeGreaterThan(letterGradeRank("A"));
    expect(letterGradeRank("B")).toBeGreaterThan(letterGradeRank("C-"));
    expect(letterGradeRank("F")).toBeGreaterThan(letterGradeRank("—"));
  });
});
