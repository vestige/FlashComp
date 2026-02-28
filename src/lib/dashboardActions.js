export const PRIMARY_EVENT_ACTION_BY_STATUS = {
  upcoming: "settings",
  live: "scores",
  completed: "ranking",
  unknown: "settings",
};

const ALL_ACTIONS = ["settings", "climbers", "scores", "ranking"];

export const getPrimaryEventActionKey = (status) => {
  return PRIMARY_EVENT_ACTION_BY_STATUS[status] || PRIMARY_EVENT_ACTION_BY_STATUS.unknown;
};

export const getEventActionPlan = ({ status, isCompleted }) => {
  const visibleActions = ALL_ACTIONS.filter((action) => {
    if (action === "climbers") return !isCompleted;
    if (action === "scores") return status === "live";
    return true;
  });
  const preferredPrimary = getPrimaryEventActionKey(status);
  const primary = visibleActions.includes(preferredPrimary)
    ? preferredPrimary
    : visibleActions[0] || "settings";

  return {
    primary,
    secondary: visibleActions.filter((action) => action !== primary),
  };
};
