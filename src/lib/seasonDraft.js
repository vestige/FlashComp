export const validateSeasonDraft = ({ name, startDate, endDate }) => {
  if (!name || !name.trim()) return "シーズン名を入力してください";
  if (!startDate || !endDate) return "開始日と終了日を入力してください";

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "日付の形式が不正です";
  }
  if (start > end) return "開始日は終了日以前にしてください";

  return "";
};
