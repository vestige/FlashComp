export const buildSettingsProgress = ({ seasonCount, categoryCount, taskCount }) => {
  const seasons = Number.isFinite(Number(seasonCount)) ? Math.max(0, Number(seasonCount)) : 0;
  const categories = Number.isFinite(Number(categoryCount)) ? Math.max(0, Number(categoryCount)) : 0;
  const tasks = Number.isFinite(Number(taskCount)) ? Math.max(0, Number(taskCount)) : 0;

  const steps = [
    {
      key: "seasons",
      label: "シーズン",
      count: seasons,
      unit: "件",
      status: seasons > 0 ? "done" : "todo",
      hint: seasons > 0 ? "登録済み" : "1件以上登録してください",
    },
    {
      key: "categories",
      label: "カテゴリ",
      count: categories,
      unit: "件",
      status: categories > 0 ? "done" : seasons > 0 ? "todo" : "blocked",
      hint:
        categories > 0
          ? "登録済み"
          : seasons > 0
            ? "1件以上登録してください"
            : "先にシーズンを登録してください",
    },
    {
      key: "tasks",
      label: "課題",
      count: tasks,
      unit: "件",
      status: tasks > 0 ? "done" : seasons > 0 && categories > 0 ? "todo" : "blocked",
      hint:
        tasks > 0
          ? "登録済み"
          : seasons > 0 && categories > 0
            ? "課題を登録してください"
            : "先にシーズンとカテゴリを登録してください",
    },
  ];

  const completed = steps.filter((step) => step.status === "done").length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);

  return {
    steps,
    completed,
    total,
    percent,
  };
};
