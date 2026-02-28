import { describe, expect, it } from "vitest";
import { validateCategoryDraft } from "./categoryDraft";

describe("validateCategoryDraft", () => {
  it("returns error when category name is empty", () => {
    expect(validateCategoryDraft({ name: "" })).toBe("カテゴリ名を入力してください");
    expect(validateCategoryDraft({ name: "   " })).toBe("カテゴリ名を入力してください");
  });

  it("returns empty string when category name is valid", () => {
    expect(validateCategoryDraft({ name: "Beginner" })).toBe("");
  });
});
