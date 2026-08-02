import { describe, expect, it } from "vitest";
import { scopeFor } from "@/lib/selector-scope";

describe("scopeFor", () => {
  it("hides both selectors on history", () => {
    expect(scopeFor("/history")).toEqual({ year: false, week: false });
  });

  it("shows both selectors on the dashboard root", () => {
    expect(scopeFor("/")).toEqual({ year: true, week: true });
  });

  it("is week-independent for season-long views", () => {
    for (const p of ["/rankings", "/rivalry", "/transactions", "/trends", "/records"]) {
      expect(scopeFor(p)).toEqual({ year: true, week: false });
    }
  });

  it("shows the week selector on the teams list", () => {
    expect(scopeFor("/teams")).toEqual({ year: true, week: true });
  });

  it("hides the week selector on a team detail page", () => {
    expect(scopeFor("/teams/5")).toEqual({ year: true, week: false });
  });

  it("shows both selectors for week-scoped pages", () => {
    for (const p of ["/scores", "/recap", "/predict", "/playoffs", "/all-time", "/players"]) {
      expect(scopeFor(p)).toEqual({ year: true, week: true });
    }
  });
});
