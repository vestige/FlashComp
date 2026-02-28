import { describe, expect, it } from "vitest";
import { validateSeasonDraft } from "./seasonDraft";

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
