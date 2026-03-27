import { parseDateInputAsLocalDate } from "./dateInput";

export const validateSeasonDraft = ({ name, startDate, endDate }) => {
  if (!name || !name.trim()) return "シーズン名を入力してください";
  if (!startDate || !endDate) return "開始日と終了日を入力してください";

  const start = parseDateInputAsLocalDate(startDate);
  const end = parseDateInputAsLocalDate(endDate);
  if (!start || !end) {
    return "日付の形式が不正です";
  }
  if (start > end) return "開始日は終了日以前にしてください";

  return "";
};

const parseAsDay = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const parsed = parseDateInputAsLocalDate(String(value));
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toInputDate = (value) => {
  if (!value) return "";
  const day = parseAsDay(value);
  if (!day) return "";
  const y = String(day.getFullYear());
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const addDays = (base, days) => {
  if (!base || !Number.isFinite(days)) return null;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
};

const getSeasonEndTime = (season) => parseAsDay(season?.endDate)?.getTime() || 0;

export const validateSeasonInEventRange = ({
  startDate,
  endDate,
  eventStartDate,
  eventEndDate,
}) => {
  const seasonStart = parseAsDay(startDate);
  const seasonEnd = parseAsDay(endDate);
  const eventStart = parseAsDay(eventStartDate);
  const eventEnd = parseAsDay(eventEndDate);

  if (!seasonStart || !seasonEnd || !eventStart || !eventEnd) return "";
  if (seasonStart < eventStart || seasonEnd > eventEnd) {
    return "シーズン期間はイベント期間の範囲内で設定してください";
  }
  return "";
};

export const getSeasonCreateDateDefaults = ({
  seasons = [],
  eventStartDate,
  eventEndDate,
}) => {
  const eventStart = parseAsDay(eventStartDate);
  const eventEnd = parseAsDay(eventEndDate);
  if (!eventStart || !eventEnd) {
    return { startDate: "", endDate: "" };
  }

  if (!Array.isArray(seasons) || seasons.length === 0) {
    return {
      startDate: toInputDate(eventStart),
      endDate: toInputDate(eventEnd),
    };
  }

  const latestSeason = [...seasons].sort((a, b) => getSeasonEndTime(b) - getSeasonEndTime(a))[0];
  const latestSeasonEnd = parseAsDay(latestSeason?.endDate);
  if (!latestSeasonEnd) {
    return {
      startDate: toInputDate(eventStart),
      endDate: toInputDate(eventEnd),
    };
  }

  const nextStart = addDays(latestSeasonEnd, 1);
  if (!nextStart || nextStart > eventEnd) {
    return {
      startDate: toInputDate(eventStart),
      endDate: toInputDate(eventEnd),
    };
  }

  return {
    startDate: toInputDate(nextStart),
    endDate: toInputDate(eventEnd),
  };
};

export const findSeasonsOutsideEventRange = ({
  seasons = [],
  eventStartDate,
  eventEndDate,
}) => {
  const eventStart = parseAsDay(eventStartDate);
  const eventEnd = parseAsDay(eventEndDate);
  if (!eventStart || !eventEnd) return [];

  return seasons.filter((season) => {
    const seasonStart = parseAsDay(season?.startDate);
    const seasonEnd = parseAsDay(season?.endDate);
    if (!seasonStart || !seasonEnd) return false;
    return seasonStart < eventStart || seasonEnd > eventEnd;
  });
};

export const validateEventRangeAgainstSeasons = ({
  seasons = [],
  eventStartDate,
  eventEndDate,
}) => {
  const invalidSeasons = findSeasonsOutsideEventRange({
    seasons,
    eventStartDate,
    eventEndDate,
  });
  if (invalidSeasons.length === 0) return "";

  const preview = invalidSeasons
    .slice(0, 2)
    .map((season) => season?.name?.trim() || season?.id || "無題シーズン")
    .join("、");
  const suffix = invalidSeasons.length > 2 ? ` ほか${invalidSeasons.length - 2}件` : "";
  return `既存シーズン（${preview}${suffix}）がイベント期間外になります。先にシーズン期間を調整してください`;
};
