// Dates are YYYY-MM-DD strings, read as local calendar days.
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number): string => String(n).padStart(2, '0');

export const toDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const isoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = (): string => isoDate(new Date());

export const isIsoDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDate(toDate(s)) === s;

export const addDays = (s: string, n: number): string => {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
};

export const daysBetween = (a: string, b: string): number => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 864e5);

// "07 Apr"
export const dayMonth = (s: string): string => {
  const d = toDate(s);
  return `${pad(d.getDate())} ${MON[d.getMonth()]}`;
};

// "07/04": sprint dates on a timeline
export const dayNumMonth = (s: string): string => {
  const d = toDate(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

// "07 Apr 2031"
export const dayMonthYear = (s: string): string => `${dayMonth(s)} ${toDate(s).getFullYear()}`;

// "7 Apr 2031"
export const longDate = (s: string): string => {
  const d = toDate(s);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
};

// "Mon 7 Apr"
export const weekdayDate = (s: string): string => {
  const d = toDate(s);
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
};

// "Mon 7 Apr 2031"
export const fullDate = (s: string): string => `${weekdayDate(s)} ${toDate(s).getFullYear()}`;

// "Apr 2031"
export const monthYear = (s: string): string => {
  const d = toDate(s);
  return `${MON[d.getMonth()]} ${d.getFullYear()}`;
};

export const isoWeek = (s: string): number => {
  const d = toDate(s);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
};

// "20310515"
export const compactDate = (s: string): string => s.replace(/-/g, '');
