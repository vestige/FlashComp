import { describe, expect, it } from "vitest";
import { formatSeasonDate, getSeasonStatus } from "./seasonStatus";

describe("seasonStatus", () => {
  it("returns season status by date range", () => {
    const season = {
      startDate: "2026-03-10",
      endDate: "2026-03-20",
    };

    expect(getSeasonStatus(season, new Date("2026-03-01"))).toBe("upcoming");
    expect(getSeasonStatus(season, new Date("2026-03-10"))).toBe("live");
    expect(getSeasonStatus(season, new Date("2026-03-25"))).toBe("completed");
  });

  it("returns unknown for invalid season dates", () => {
    expect(getSeasonStatus({ startDate: "", endDate: "" }, new Date("2026-03-01"))).toBe("unknown");
  });

  it("formats season date", () => {
    expect(formatSeasonDate("2026-03-10")).toBe("2026/3/10");
  });
});
