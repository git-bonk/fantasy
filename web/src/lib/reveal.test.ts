import { describe, expect, it } from "vitest";
import { aliasOwner, aliasTeam } from "@/lib/reveal";

describe("aliasOwner", () => {
  it("renders a neutral owner pseudonym", () => {
    expect(aliasOwner(0)).toBe("Owner 0");
    expect(aliasOwner(1)).toBe("Owner 1");
    expect(aliasOwner(11)).toBe("Owner 11");
  });
});

describe("aliasTeam", () => {
  it("renders a neutral team pseudonym", () => {
    expect(aliasTeam(0)).toBe("Team 0");
    expect(aliasTeam(5)).toBe("Team 5");
    expect(aliasTeam(12)).toBe("Team 12");
  });
});
