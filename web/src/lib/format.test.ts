import { describe, expect, it } from "vitest";
import { fmtDate, fmtPct, fmtPts, fmtRecord, initials, ownerColor } from "@/lib/format";

const PALETTE = ["#10b981", "#fbbf24", "#38bdf8", "#a855f7", "#f43f5e", "#14b8a6", "#f97316"];

describe("fmtPts", () => {
  it("returns an em dash for null/undefined", () => {
    expect(fmtPts(null)).toBe("—");
    expect(fmtPts(undefined)).toBe("—");
  });

  it("formats numbers to two decimals", () => {
    expect(fmtPts(0)).toBe("0.00");
    expect(fmtPts(123.4)).toBe("123.40");
    expect(fmtPts(99.999)).toBe("100.00");
  });
});

describe("fmtRecord", () => {
  it("omits ties when there are none", () => {
    expect(fmtRecord(5, 3, 0)).toBe("5-3");
  });

  it("includes ties when present", () => {
    expect(fmtRecord(5, 3, 1)).toBe("5-3-1");
  });
});

describe("fmtPct", () => {
  it("returns an em dash for null/undefined", () => {
    expect(fmtPct(null)).toBe("—");
    expect(fmtPct(undefined)).toBe("—");
  });

  it("renders a rounded percentage", () => {
    expect(fmtPct(1)).toBe("100%");
    expect(fmtPct(0.5)).toBe("50%");
    expect(fmtPct(0.333)).toBe("33%");
    expect(fmtPct(0)).toBe("0%");
  });
});

describe("fmtDate", () => {
  it("returns an em dash for falsy input", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
    expect(fmtDate("")).toBe("—");
  });

  it("formats an ISO date as 'Mon D, YYYY'", () => {
    expect(fmtDate("2024-07-04T12:00:00Z")).toMatch(/^Jul \d{1,2}, 2024$/);
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("John Doe")).toBe("JD");
    expect(initials("alice bob carol")).toBe("AB");
  });

  it("handles a single word", () => {
    expect(initials("john")).toBe("J");
  });

  it("returns empty string for blank input", () => {
    expect(initials("")).toBe("");
    expect(initials("   ")).toBe("");
  });
});

describe("ownerColor", () => {
  it("always returns a palette color", () => {
    for (const id of ["a", "owner-1", "zebra", "12345"]) {
      expect(PALETTE).toContain(ownerColor(id));
    }
  });

  it("is deterministic for a given id", () => {
    expect(ownerColor("stable")).toBe(ownerColor("stable"));
  });

  it("computes stable exact values", () => {
    expect(ownerColor("")).toBe("#10b981");
    expect(ownerColor("a")).toBe("#f97316");
  });
});
