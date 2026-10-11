export function normalizeDateStr(s) {
  if (!s) return '';
  if (typeof s !== 'string') {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const parts = s.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return s;
}

export function todayString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateDisplay(dateStr) {
  const norm = normalizeDateStr(dateStr);
  const parts = norm.split('-');
  if (parts.length !== 3) return norm;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(Date.UTC(year, month, day, 12, 0, 0));
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${dayName} ${d.getUTCDate()} ${monthName}`;
}

export function addDays(dateStr, n) {
  const norm = normalizeDateStr(dateStr);
  const d = new Date(norm + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function daysBetween(a, b) {
  const normA = normalizeDateStr(a);
  const normB = normalizeDateStr(b);
  const d1 = new Date(normA + 'T12:00:00Z');
  const d2 = new Date(normB + 'T12:00:00Z');
  return Math.round((d2 - d1) / 86400000);
}

export function isoWeekKey(dateStr) {
  const norm = normalizeDateStr(dateStr);
  const d = new Date(norm + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export function weekDates(dateStr) {
  const norm = normalizeDateStr(dateStr);
  const d = new Date(norm + 'T12:00:00Z');
  const day = d.getUTCDay() || 7;
  const monday = addDays(norm, 1 - day);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(monday, i));
  }
  return dates;
}
