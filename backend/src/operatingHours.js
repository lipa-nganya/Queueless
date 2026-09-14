/**
 * Structured weekly operating hours.
 * Stored in business_branches.operating_hours as a JSON string.
 *
 * Shape: [{ day, open, start, end }, ...] for mon..sun
 * Times are 24h "HH:MM". Closed days still carry default start/end for the editor.
 */

export const WEEK_DAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

const DAY_KEYS = WEEK_DAYS.map((d) => d.key);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function defaultSchedule() {
  return WEEK_DAYS.map((d) => ({
    day: d.key,
    open: d.key !== "sat" && d.key !== "sun",
    start: "08:00",
    end: "18:00",
  }));
}

function normalizeTime(value, fallback = "08:00") {
  const raw = String(value || "").trim();
  if (TIME_RE.test(raw)) return raw;
  // Accept H:MM
  const loose = raw.match(/^(\d{1,2}):([0-5]\d)$/);
  if (loose) {
    const hour = Number(loose[1]);
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:${loose[2]}`;
    }
  }
  return fallback;
}

function timeToMinutes(value) {
  const [h, m] = normalizeTime(value).split(":").map(Number);
  return h * 60 + m;
}

function dayFromInput(item, index) {
  if (!item || typeof item !== "object") return null;
  const key = String(item.day || item.key || DAY_KEYS[index] || "")
    .trim()
    .toLowerCase()
    .slice(0, 3);
  if (!DAY_KEYS.includes(key)) return null;
  const open =
    item.open === true ||
    item.open === "true" ||
    item.enabled === true ||
    item.enabled === "true" ||
    item.is_open === true;
  const start = normalizeTime(item.start || item.start_time || item.from, "08:00");
  const end = normalizeTime(item.end || item.end_time || item.to, "18:00");
  return { day: key, open: Boolean(open), start, end };
}

/**
 * Normalize any accepted input into a full 7-day schedule.
 * Throws Error with a user-facing message when open days have invalid ranges.
 */
export function normalizeSchedule(input) {
  const byDay = new Map(defaultSchedule().map((d) => [d.day, { ...d }]));

  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      const day = dayFromInput(item, index);
      if (day) byDay.set(day.day, day);
    });
  } else if (input && typeof input === "object") {
    // { mon: {...}, tue: {...} } or { days: [...] }
    if (Array.isArray(input.days)) {
      return normalizeSchedule(input.days);
    }
    for (const key of DAY_KEYS) {
      if (input[key] != null) {
        const day = dayFromInput({ ...input[key], day: key }, DAY_KEYS.indexOf(key));
        if (day) byDay.set(key, day);
      }
    }
  }

  const schedule = DAY_KEYS.map((key) => byDay.get(key));
  for (const day of schedule) {
    if (!day.open) continue;
    if (timeToMinutes(day.start) >= timeToMinutes(day.end)) {
      const label = WEEK_DAYS.find((d) => d.key === day.day)?.label || day.day;
      throw new Error(`${label}: ending time must be after starting time.`);
    }
  }
  return schedule;
}

export function tryParseSchedule(value) {
  if (value == null || value === "") return null;
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    try {
      return normalizeSchedule(value);
    } catch {
      return null;
    }
  }
  const str = String(value).trim();
  if (!str) return null;
  if (!str.startsWith("[") && !str.startsWith("{")) return null;
  try {
    return normalizeSchedule(JSON.parse(str));
  } catch {
    return null;
  }
}

export function serializeSchedule(schedule) {
  return JSON.stringify(normalizeSchedule(schedule));
}

export function formatOperatingHours(schedule) {
  return normalizeSchedule(schedule)
    .map((day) => {
      const short = WEEK_DAYS.find((d) => d.key === day.day)?.short || day.day;
      return day.open ? `${short} ${day.start}–${day.end}` : `${short} Closed`;
    })
    .join("\n");
}

export function displayOperatingHours(value) {
  const schedule = tryParseSchedule(value);
  if (schedule) return formatOperatingHours(schedule);
  return String(value || "").trim() || null;
}

/** Resolve write payload from request body into a DB string (or null). */
export function resolveOperatingHoursFromBody(body = {}) {
  if (body.operating_schedule != null) {
    return serializeSchedule(body.operating_schedule);
  }
  if (body.operating_hours != null && typeof body.operating_hours === "object") {
    return serializeSchedule(body.operating_hours);
  }
  const str = String(body.operating_hours || "").trim();
  if (!str) return null;
  const parsed = tryParseSchedule(str);
  if (parsed) return serializeSchedule(parsed);
  return str;
}

export function enrichHoursFields(row) {
  if (!row || typeof row !== "object") return row;
  const schedule = tryParseSchedule(row.operating_hours);
  return {
    ...row,
    operating_schedule: schedule,
    operating_hours_display: displayOperatingHours(row.operating_hours),
  };
}
