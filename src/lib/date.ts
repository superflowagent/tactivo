export function formatDateWithOffset(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  // timezone offset in minutes, positive if behind UTC
  const tzOffsetMin = -d.getTimezoneOffset();
  const tzSign = tzOffsetMin >= 0 ? '+' : '-';
  const absOffsetMin = Math.abs(tzOffsetMin);
  const tzHours = pad(Math.floor(absOffsetMin / 60));
  const tzMinutes = pad(absOffsetMin % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzSign}${tzHours}:${tzMinutes}`;
}

/**
 * Robust parser for datetime values returned by the DB/RPC.
 * Accepts strings like:
 *  - "2026-01-15T08:30Z"
 *  - "2026-01-15T08:30+01:00"
 *  - "2026-01-15T08:30" (treated as local)
 *  - "2026-01-15 08:30:00"
 *  - ISO strings including seconds or timezone
 */
export function parseDatetime(raw: any): Date | null {
  if (!raw) return null;
  let s = String(raw);

  // Convert offsets like '+01' -> '+01:00' so Date parser accepts them
  if (/[+-]\d{2}$/.test(s)) {
    s = s.replace(/([+-]\d{2})$/, '$1:00');
  }

  // If contains explicit timezone (Z or +hh:mm) parse directly with Date
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Match common local formats with either 'T' or space separator (no timezone)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const day = parseInt(m[3], 10);
    const hh = parseInt(m[4], 10);
    const mm = parseInt(m[5], 10);
    const ss = m[6] ? parseInt(m[6], 10) : 0;
    const d = new Date(y, mo, day, hh, mm, ss);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Fallback to Date parser
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
