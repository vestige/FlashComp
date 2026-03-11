const PERMISSION_DENIED_CODES = new Set(["permission-denied", "firestore/permission-denied"]);

export const isPermissionDeniedError = (error) => {
  const code = error?.code;
  return typeof code === "string" && PERMISSION_DENIED_CODES.has(code);
};

export const getAdminPermissionDeniedMessage = (actionLabel = "この操作") =>
  `❌ ${actionLabel}を実行する権限がありません。システム管理者に users/{uid} の role / gymIds 設定を確認してください。`;

export const getAdminActionErrorMessage = ({ error, actionLabel, defaultMessage }) => {
  if (isPermissionDeniedError(error)) {
    return getAdminPermissionDeniedMessage(actionLabel);
  }
  return defaultMessage;
};
