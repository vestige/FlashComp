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
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const parsed = parseDateInputAsLocalDate(String(value));
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

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
