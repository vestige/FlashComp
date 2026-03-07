import { buildRankingBackLink } from "./rankingNavigation";

describe("buildRankingBackLink", () => {
  it("returns portal list path when source is portal", () => {
    expect(buildRankingBackLink({ source: "portal", eventId: "event-1" })).toEqual({
      backTo: "/score-summary",
      backLabel: "↑ Back to Portal",
    });
  });

  it("returns owner result path when source is owner", () => {
    expect(buildRankingBackLink({ source: "owner", eventId: "event-1" })).toEqual({
      backTo: "/events/event-1/result",
      backLabel: "↑ Back to Result",
    });
  });

  it("returns top path for unknown source", () => {
    expect(buildRankingBackLink({ source: "", eventId: "event-1" })).toEqual({
      backTo: "/",
      backLabel: "↑ Back to TOP",
    });
  });
});
