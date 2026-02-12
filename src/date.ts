/**
 * Date helpers.
 *
 * IMPORTANT:
 * Avoid `Date.prototype.toISOString()` for "today" / calendar logic.
 * `toISOString()` is UTC-based and can shift the date forward/backward
 * depending on the user's timezone.
 */

/** Format a date as YYYY-MM-DD in the user's local timezone. */
export function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse YYYY-MM-DD into a local Date at midnight. */
export function fromISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
