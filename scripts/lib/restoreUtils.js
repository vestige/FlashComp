export function readArgValue(argv, flag) {
  const exactIndex = argv.indexOf(flag);
  if (exactIndex >= 0 && exactIndex + 1 < argv.length) {
    return argv[exactIndex + 1] || "";
  }

  const prefixed = argv.find((arg) => arg.startsWith(`${flag}=`));
  if (!prefixed) return "";
  return prefixed.slice(flag.length + 1);
}

export function readList(argv, flag) {
  const raw = readArgValue(argv, flag);
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeGymIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.trim().length > 0);
}

export function formatTimestamp(dateIsoString) {
  const date = new Date(dateIsoString);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export function createRestoreLogEntry({
  mode,
  startedAt,
  completedAt,
  actor,
  sourceFile,
  includeSystem,
  hasAllGymAccess,
  sourceProject,
  environment,
  requestedScope,
  targetDocs,
  sourceDocs,
  skipped,
  restoredCount,
  restoredEvents,
  restoredGyms,
}) {
  return {
    startedAt,
    completedAt,
    mode,
    actor,
    sourceFile,
    includeSystem,
    hasAllGymAccess,
    sourceProject: sourceProject || undefined,
    environment: environment || "manual",
    requestedScope,
    targetDocs,
    sourceDocs,
    skipped,
    restoredCount,
    restoredEvents,
    restoredGyms,
  };
}
