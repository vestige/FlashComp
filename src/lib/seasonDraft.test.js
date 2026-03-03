import { describe, expect, it } from "vitest";
import {
  findSeasonsOutsideEventRange,
  validateEventRangeAgainstSeasons,
  validateSeasonDraft,
  validateSeasonInEventRange,
} from "./seasonDraft";

describe("validateSeasonDraft", () => {
  it("returns error when required fields are missing", () => {
    expect(validateSeasonDraft({ name: "", startDate: "", endDate: "" })).toBe(
      "シーズン名を入力してください"
    );
    expect(validateSeasonDraft({ name: "Season 1", startDate: "", endDate: "" })).toBe(
      "開始日と終了日を入力してください"
    );
  });

  it("returns error when date range is invalid", () => {
    expect(
      validateSeasonDraft({
        name: "Season 1",
        startDate: "2026-03-20",
        endDate: "2026-03-01",
      })
    ).toBe("開始日は終了日以前にしてください");
  });

  it("returns empty string when input is valid", () => {
    expect(
      validateSeasonDraft({
        name: "Season 1",
        startDate: "2026-03-01",
        endDate: "2026-03-20",
      })
    ).toBe("");
  });
});

describe("validateSeasonInEventRange", () => {
  it("returns error when season is outside event period", () => {
    expect(
      validateSeasonInEventRange({
        startDate: "2026-02-28",
        endDate: "2026-03-10",
        eventStartDate: "2026-03-01",
        eventEndDate: "2026-03-31",
      })
    ).toBe("シーズン期間はイベント期間の範囲内で設定してください");
    expect(
      validateSeasonInEventRange({
        startDate: "2026-03-10",
        endDate: "2026-04-01",
        eventStartDate: "2026-03-01",
        eventEndDate: "2026-03-31",
      })
    ).toBe("シーズン期間はイベント期間の範囲内で設定してください");
  });

  it("returns empty string when season is inside event period", () => {
    expect(
      validateSeasonInEventRange({
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        eventStartDate: "2026-03-01",
        eventEndDate: "2026-03-31",
      })
    ).toBe("");
  });
});

describe("findSeasonsOutsideEventRange", () => {
  it("returns seasons that become out of event range", () => {
    const outOfRange = findSeasonsOutsideEventRange({
      eventStartDate: "2026-03-01",
      eventEndDate: "2026-03-31",
      seasons: [
        { id: "s1", name: "Season 1", startDate: "2026-03-01", endDate: "2026-03-10" },
        { id: "s2", name: "Season 2", startDate: "2026-02-28", endDate: "2026-03-15" },
        { id: "s3", name: "Season 3", startDate: "2026-03-20", endDate: "2026-04-01" },
      ],
    });

    expect(outOfRange.map((season) => season.id)).toEqual(["s2", "s3"]);
  });

  it("supports timestamp-like values", () => {
    const makeTs = (value) => ({
      toDate: () => new Date(`${value}T09:00:00`),
    });
    const outOfRange = findSeasonsOutsideEventRange({
      eventStartDate: makeTs("2026-03-01"),
      eventEndDate: makeTs("2026-03-31"),
      seasons: [
        {
          id: "s1",
          name: "Season 1",
          startDate: makeTs("2026-03-05"),
          endDate: makeTs("2026-03-20"),
        },
        {
          id: "s2",
          name: "Season 2",
          startDate: makeTs("2026-02-25"),
          endDate: makeTs("2026-03-10"),
        },
      ],
    });

    expect(outOfRange.map((season) => season.id)).toEqual(["s2"]);
  });
});

describe("validateEventRangeAgainstSeasons", () => {
  it("returns error message with conflicted season names", () => {
    const error = validateEventRangeAgainstSeasons({
      eventStartDate: "2026-03-01",
      eventEndDate: "2026-03-31",
      seasons: [
        { id: "s1", name: "Season 1", startDate: "2026-02-28", endDate: "2026-03-10" },
        { id: "s2", name: "Season 2", startDate: "2026-03-01", endDate: "2026-04-01" },
        { id: "s3", name: "Season 3", startDate: "2026-02-25", endDate: "2026-04-02" },
      ],
    });

    expect(error).toContain("Season 1");
    expect(error).toContain("Season 2");
    expect(error).toContain("ほか1件");
  });

  it("returns empty string when no conflict exists", () => {
    expect(
      validateEventRangeAgainstSeasons({
        eventStartDate: "2026-03-01",
        eventEndDate: "2026-03-31",
        seasons: [{ id: "s1", name: "Season 1", startDate: "2026-03-01", endDate: "2026-03-31" }],
      })
    ).toBe("");
  });
});
