export const validateCategoryDraft = ({ name }) => {
  if (!name || !name.trim()) return "カテゴリ名を入力してください";
  return "";
};
