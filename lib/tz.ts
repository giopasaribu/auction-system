export const TZ = process.env.NEXT_PUBLIC_TIMEZONE ?? "Asia/Jakarta";

function getOffsetMs(tz: string, date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0");
  const h = get("hour");
  const localMs = Date.UTC(get("year"), get("month") - 1, get("day"), h === 24 ? 0 : h, get("minute"), get("second"));
  return localMs - date.getTime();
}

// Convert a UTC date to a datetime-local input string in the configured timezone
export function toInputLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

// Parse a datetime-local input string (interpreted as being in the configured timezone) → UTC ISO string
export function fromInputLocal(value: string): string {
  if (!value) return "";
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const approxUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offsetMs = getOffsetMs(TZ, approxUtc);
  return new Date(approxUtc.getTime() - offsetMs).toISOString();
}

// Format a date for display in the configured timezone (e.g. "15 Jun 2026")
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit", month: "short", year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

// Format a time for display in the configured timezone (e.g. "20:30:00")
export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(typeof date === "string" ? new Date(date) : date);
}
