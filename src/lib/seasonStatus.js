const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDay = (value) => {
  const date = toDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const formatSeasonDate = (value) => {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("ja-JP");
};

export const formatSeasonMonth = (value) => {
  const date = toDate(value);
  if (!date) return "---";
  return date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
};

export const formatSeasonDay = (value) => {
  const date = toDate(value);
  if (!date) return "--";
  return String(date.getDate());
};

export const getSeasonStatus = (season, now = new Date()) => {
  const start = toDay(season?.startDate);
  const end = toDay(season?.endDate);
  const today = toDay(now);
  if (!start || !end || !today) return "unknown";
  if (today < start) return "upcoming";
  if (today > end) return "completed";
  return "live";
};

export const seasonStatusLabel = {
  live: "LIVE",
  upcoming: "UPCOMING",
  completed: "Completed",
  unknown: "Unknown",
};

export const seasonStatusStyle = {
  live: "bg-red-50 text-red-600 border border-red-200",
  upcoming: "bg-sky-50 text-sky-700 border border-sky-200",
  completed: "bg-slate-100 text-slate-600 border border-slate-200",
  unknown: "bg-amber-50 text-amber-700 border border-amber-200",
};
