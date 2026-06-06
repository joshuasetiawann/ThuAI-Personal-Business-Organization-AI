// Server timestamps are naive UTC (e.g. "2026-06-10T14:40:01", no 'Z'); browsers
// parse those as LOCAL time, which makes every "X ago" / clock display wrong by the
// local UTC offset. asUTC() marks datetime strings as UTC so they parse correctly.
// Date-only strings ("2026-06-10") are left untouched (already treated as UTC by JS,
// and appending 'Z' would be invalid).
export function asUTC(iso?: string | null): string {
  if (!iso) return "";
  return /T/.test(iso) && !/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso + "Z" : iso;
}
