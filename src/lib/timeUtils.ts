export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toUpperCase();
  let hours = 0;
  let minutes = 0;

  if (cleaned.includes('AM') || cleaned.includes('PM')) {
    const match = cleaned.match(/^(\d{1,2}):?(\d{2})?(?:\.\d+)?\s*(AM|PM)$/);
    if (!match) return 0;
    hours = parseInt(match[1], 10);
    minutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3];
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  } else {
    const parts = cleaned.split(':');
    hours = parseInt(parts[0], 10) || 0;
    minutes = parts[1] ? Math.floor(parseFloat(parts[1])) : 0;
  }
  return hours * 60 + minutes;
}

export function minutesToTimeStr(minutes: number): string {
  let m = Math.round(minutes) % 1440;
  if (m < 0) m += 1440;
  let hours = Math.floor(m / 60);
  const mins = m % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

export function getCurrentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function getCurrentTimeStr(): string {
  return minutesToTimeStr(getCurrentTimeMinutes());
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDateStr(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${weekdays[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function isDateInRange(dateStr: string, startDate: string, endDate: string): boolean {
  return dateStr >= startDate && dateStr <= endDate;
}

export function timeDiffMinutes(a: string, b: string): number {
  return parseTimeToMinutes(a) - parseTimeToMinutes(b);
}

export function addMinutesToTime(timeStr: string, mins: number): string {
  return minutesToTimeStr(parseTimeToMinutes(timeStr) + mins);
}

export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const cleaned = timeStr.trim().toUpperCase();
  if (cleaned.includes('AM') || cleaned.includes('PM')) {
    const match = cleaned.match(/^(\d{1,2}):?(\d{2})?(?:\.\d+)?\s*(AM|PM)$/);
    if (!match) return timeStr;
    const hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3];
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
  const parts = cleaned.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parts[1] ? Math.floor(parseFloat(parts[1])) : 0;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHours = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHours}:${m.toString().padStart(2, '0')} ${period}`;
}

export function getDelayText(originalTime: string, currentTime: string): string | null {
  const diff = parseTimeToMinutes(currentTime) - parseTimeToMinutes(originalTime);
  if (diff <= 0) return null;
  if (diff < 60) return `Delayed by ${diff}m`;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `Delayed by ${hours}h ${mins}m` : `Delayed by ${hours}h`;
}
