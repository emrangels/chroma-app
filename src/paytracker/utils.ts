export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatMoney(n: number): string {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
}

export function formatHours(n: number): string {
  return `${(Math.round(n * 100) / 100).toString()}h`;
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_SHORT[date.getDay()]} ${d}/${m}/${y}`;
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, '0')}${period}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime12h(start)}–${formatTime12h(end)}`;
}

export function dayTypeLabel(dayType: string): string {
  switch (dayType) {
    case 'saturday':
      return 'Saturday';
    case 'sunday':
      return 'Sunday';
    case 'publicHoliday':
      return 'Public holiday';
    default:
      return 'Weekday';
  }
}
