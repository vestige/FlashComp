export function normalizeGymIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id.trim().length > 0);
}

export function readArgValue(argv, flag) {
  const exactIndex = argv.indexOf(flag);
  if (exactIndex >= 0 && exactIndex + 1 < argv.length) {
    return argv[exactIndex + 1] || "";
  }

  const prefixed = argv.find((arg) => arg.startsWith(`${flag}=`));
  if (!prefixed) return "";
  return prefixed.slice(flag.length + 1);
}

export function normalizeEnvironmentTag(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "manual";
  if (["demo", "prod", "production", "manual"].includes(raw)) {
    if (raw === "production") return "prod";
    return raw;
  }
  return `env-${raw.replace(/[^a-z0-9-_]/gi, "-")}`;
}

export function formatFileTimestamp(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export function createBackupPayload({
  exportedAt,
  sourceUser,
  sourceProject,
  includeSystem,
  environment,
  eventCount,
  docs,
}) {
  const collectionCounts = docs.reduce((acc, row) => {
    const collection = String(row.path || "").split("/")[0];
    if (!collection) return acc;
    acc[collection] = (acc[collection] || 0) + 1;
    return acc;
  }, {});

  return {
    exportedAt,
    sourceUser,
    sourceProject,
    includeSystem,
    environment,
    collectionCounts,
    eventCount,
    docCount: docs.length,
    docs,
  };
}
