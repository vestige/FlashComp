export function readArgValue(argv, flag) {
  const exactIndex = argv.indexOf(flag);
  if (exactIndex >= 0 && exactIndex + 1 < argv.length) {
    return argv[exactIndex + 1] || "";
  }

  const prefixed = argv.find((arg) => arg.startsWith(`${flag}=`));
  if (!prefixed) return "";
  return prefixed.slice(flag.length + 1);
}

export function parseScopeValue(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return { events: new Set(), gyms: new Set(), invalid: [] };

  const events = new Set();
  const gyms = new Set();
  const invalid = [];
  const tokens = raw.split(",").map((item) => item.trim()).filter(Boolean);
  for (const token of tokens) {
    if (token.startsWith("event:")) {
      const eventId = token.slice("event:".length).trim();
      if (eventId) events.add(eventId);
      else invalid.push(token);
      continue;
    }
    if (token.startsWith("gym:")) {
      const gymId = token.slice("gym:".length).trim();
      if (gymId) gyms.add(gymId);
      else invalid.push(token);
      continue;
    }
    invalid.push(token);
  }
  return { events, gyms, invalid };
}

export function readScopeFromArgv(argv) {
  return parseScopeValue(readArgValue(argv, "--scope"));
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

export function validateScopeOptions({ clearAll, scope }) {
  const hasScope = scope.events.size > 0 || scope.gyms.size > 0;

  if (scope.invalid.length > 0) {
    return {
      ok: false,
      hasScope,
      messages: [
        `Invalid --scope token(s): ${scope.invalid.join(", ")}`,
        "Use --scope event:<eventId>,gym:<gymId>",
      ],
    };
  }

  if (clearAll && hasScope) {
    return {
      ok: false,
      hasScope,
      messages: [
        "--all cannot be combined with --scope.",
        "Use --all for full cleanup, or --scope for targeted cleanup.",
      ],
    };
  }

  return { ok: true, hasScope, messages: [] };
}

export function createPurgeLogEntry({
  startedAt,
  completedAt,
  dryRun,
  actor,
  includeSystem,
  clearAll,
  scopeEvents,
  scopeGyms,
  hasAllGymAccess,
  role,
  manageableEventCount,
  targetEventCount,
  processedEventCount,
  deletedCount,
  wouldDeleteCount,
  skippedByPermission,
  skippedByScope,
  logFile,
}) {
  return {
    startedAt,
    completedAt,
    mode: dryRun ? "dry-run" : "apply",
    actor,
    includeSystem,
    clearAll,
    requestedScope: {
      events: scopeEvents,
      gyms: scopeGyms,
    },
    hasAllGymAccess,
    role,
    manageableEventCount,
    targetEventCount,
    processedEventCount,
    deletedCount,
    wouldDeleteCount,
    skippedByPermission,
    skippedByScope,
    logFile,
  };
}
