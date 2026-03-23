import { describe, expect, it } from "vitest";
import {
  createPurgeLogEntry,
  formatTimestamp,
  parseScopeValue,
  readArgValue,
  validateScopeOptions,
} from "./purgeUtils.js";

describe("purgeUtils", () => {
  it("reads CLI arg values from both '--flag value' and '--flag=value'", () => {
    expect(readArgValue(["node", "x", "--log", "a.jsonl"], "--log")).toBe("a.jsonl");
    expect(readArgValue(["node", "x", "--log=a.jsonl"], "--log")).toBe("a.jsonl");
    expect(readArgValue(["node", "x"], "--log")).toBe("");
  });

  it("parses scope tokens into events and gyms", () => {
    const scope = parseScopeValue("event:event-spring-2026,gym:gym-shibuya,event:event-live-now");
    expect(Array.from(scope.events)).toEqual(["event-spring-2026", "event-live-now"]);
    expect(Array.from(scope.gyms)).toEqual(["gym-shibuya"]);
    expect(scope.invalid).toEqual([]);
  });

  it("reports invalid scope tokens", () => {
    const scope = parseScopeValue("event:,gym:,unknown:abc");
    expect(Array.from(scope.events)).toEqual([]);
    expect(Array.from(scope.gyms)).toEqual([]);
    expect(scope.invalid).toEqual(["event:", "gym:", "unknown:abc"]);
  });

  it("rejects '--all' with scope", () => {
    const scope = parseScopeValue("event:event-spring-2026");
    const result = validateScopeOptions({ clearAll: true, scope });
    expect(result.ok).toBe(false);
    expect(result.messages[0]).toContain("--all cannot be combined with --scope");
  });

  it("validates a normal scoped request", () => {
    const scope = parseScopeValue("gym:gym-shibuya");
    const result = validateScopeOptions({ clearAll: false, scope });
    expect(result.ok).toBe(true);
    expect(result.hasScope).toBe(true);
  });

  it("formats timestamp for default purge log filenames", () => {
    const formatted = formatTimestamp("2026-03-23T12:34:56.000Z");
    expect(formatted).toMatch(/^\d{8}-\d{6}$/);
  });

  it("creates purge log payload with dry-run mode and scope", () => {
    const entry = createPurgeLogEntry({
      startedAt: "2026-03-23T10:00:00.000Z",
      completedAt: "2026-03-23T10:00:05.000Z",
      dryRun: true,
      actor: "vestige_sync@me.com",
      includeSystem: false,
      clearAll: false,
      scopeEvents: ["event-spring-2026"],
      scopeGyms: ["gym-shibuya"],
      hasAllGymAccess: true,
      role: "admin",
      manageableEventCount: 5,
      targetEventCount: 1,
      processedEventCount: 1,
      deletedCount: 0,
      wouldDeleteCount: 19,
      skippedByPermission: 0,
      skippedByScope: 4,
      logFile: "backups/purge-logs/purge-20260323-190000.jsonl",
    });

    expect(entry.mode).toBe("dry-run");
    expect(entry.requestedScope.events).toEqual(["event-spring-2026"]);
    expect(entry.requestedScope.gyms).toEqual(["gym-shibuya"]);
    expect(entry.wouldDeleteCount).toBe(19);
    expect(entry.deletedCount).toBe(0);
  });
});
