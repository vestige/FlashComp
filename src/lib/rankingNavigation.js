export const buildRankingBackLink = ({ source, eventId }) => {
  if (source === "portal") {
    return {
      backTo: "/score-summary",
      backLabel: "↑ Back to Portal",
    };
  }
  if (source === "owner") {
    return {
      backTo: `/events/${eventId}/result`,
      backLabel: "↑ Back to Result",
    };
  }
  return {
    backTo: "/",
    backLabel: "↑ Back to TOP",
  };
};
