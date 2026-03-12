import { describe, expect, it } from "vitest";
import {
  getAdminActionErrorMessage,
  getAdminPermissionDeniedMessage,
  isPermissionDeniedError,
} from "./firebaseErrorMessage";

describe("firebaseErrorMessage", () => {
  it("detects firestore permission-denied errors", () => {
    expect(isPermissionDeniedError({ code: "permission-denied" })).toBe(true);
    expect(isPermissionDeniedError({ code: "firestore/permission-denied" })).toBe(true);
    expect(isPermissionDeniedError({ code: "unavailable" })).toBe(false);
  });

  it("returns admin guidance message for permission-denied", () => {
    expect(
      getAdminActionErrorMessage({
        error: { code: "permission-denied" },
        actionLabel: "イベント更新",
        defaultMessage: "更新に失敗しました。",
      })
    ).toBe(getAdminPermissionDeniedMessage("イベント更新"));
  });

  it("falls back to default message for non-permission errors", () => {
    expect(
      getAdminActionErrorMessage({
        error: { code: "unavailable" },
        actionLabel: "イベント更新",
        defaultMessage: "更新に失敗しました。",
      })
    ).toBe("更新に失敗しました。");
  });
});
