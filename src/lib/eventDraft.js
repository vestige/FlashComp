import { parseDateInputAsLocalDate } from "./dateInput";

export const validateEventDraft = ({ name, gymId, startDate, endDate }) => {
  if (!name || !name.trim()) return "イベント名を入力してください";
  if (!gymId) return "担当ジムを選択してください";
  if (!startDate || !endDate) return "開始日と終了日を入力してください";

  const start = parseDateInputAsLocalDate(startDate);
  const end = parseDateInputAsLocalDate(endDate);
  if (!start || !end) {
    return "日付の形式が不正です";
  }
  if (start > end) return "開始日は終了日以前にしてください";

  return "";
};
