import { describe, expect, it } from "vitest";
import { validateEventDraft } from "./eventDraft";

describe("validateEventDraft", () => {
  it("returns error when required fields are missing", () => {
    expect(validateEventDraft({ name: "", gymId: "", startDate: "", endDate: "" })).toBe(
      "イベント名を入力してください"
    );
    expect(
      validateEventDraft({ name: "   ", gymId: "gym-a", startDate: "2026-03-01", endDate: "2026-03-02" })
    ).toBe("イベント名を入力してください");
    expect(validateEventDraft({ name: "Event", gymId: "", startDate: "2026-03-01", endDate: "2026-03-02" })).toBe(
      "担当ジムを選択してください"
    );
  });

  it("returns error when date range is invalid", () => {
    expect(
      validateEventDraft({
        name: "Event",
        gymId: "gym-a",
        startDate: "2026-03-10",
        endDate: "2026-03-01",
      })
    ).toBe("開始日は終了日以前にしてください");
  });

  it("returns empty string when input is valid", () => {
    expect(
      validateEventDraft({
        name: "Event",
        gymId: "gym-a",
        startDate: "2026-03-01",
        endDate: "2026-03-10",
      })
    ).toBe("");
  });
});
