import { DeliveryModel, Period, Project, StoredPeriod, StoredProject } from '../types/ReportTypes';
import { addDays, daysBetween, isIsoDate, isoDate, toDate } from './dates';

// A project id made from its name: lowercase letters, digits and dashes.
export const slug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 60).replace(/-+$/, '');

export const NEW_ID = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

// Back-to-back sprints of `weeks` weeks from start to end (the last one cut at end).
export function genSprints(start: string, end: string, weeks: number): Period[] {
  const out: Period[] = [];
  if (!isIsoDate(start) || !isIsoDate(end) || end < start) return out;
  let s = start;
  for (let i = 1; s <= end && i <= 104; i++) {
    let e = addDays(s, weeks * 7 - 1);
    if (e > end) e = end;
    out.push({ name: `Sprint ${i}`, start: s, end: e });
    s = addDays(e, 1);
  }
  return out;
}

// A starting point for phased projects: three phases at 20/60/20.
export function genPhases(start: string, end: string): Period[] {
  if (!isIsoDate(start) || !isIsoDate(end) || end <= start) return [{ name: '', start: start || '', end: end || '' }];
  const t = daysBetween(start, end);
  const a = addDays(start, Math.round(t * 0.2));
  const b = addDays(start, Math.round(t * 0.8));
  return [
    { name: 'Discovery and design', start, end: a },
    { name: 'Implementation', start: addDays(a, 1), end: b },
    { name: 'Handover', start: addDays(b, 1), end },
  ];
}

const validPeriod = (x: StoredPeriod | undefined): x is StoredPeriod =>
  !!x && isIsoDate(x.startDate) && isIsoDate(x.endDate) && x.endDate >= x.startDate;

// The stored project as the screens use it.
export function normalizeProject(raw: StoredProject): Project {
  const model: DeliveryModel = raw.deliveryModel === 'milestone' ? 'milestone' : 'sprint';
  const start = isIsoDate(raw.startDate) ? raw.startDate : '';
  const end = isIsoDate(raw.endDate) ? raw.endDate : '';
  const weeks = Number.isInteger(raw.sprintDuration) && raw.sprintDuration! >= 1 && raw.sprintDuration! <= 8 ? raw.sprintDuration! : 2;
  const stored = (model === 'sprint' ? raw.sprints : raw.phases) || [];
  const periods: Period[] = stored.filter(validPeriod).map((x, i) => ({
    name: (x.name || '').trim() || (model === 'sprint' ? `Sprint ${x.number || i + 1}` : `Phase ${i + 1}`),
    start: x.startDate,
    end: x.endDate,
    ...(model === 'sprint' && typeof x.goal === 'string' && x.goal.trim() ? { goal: x.goal.trim().slice(0, 50), tentative: x.tentative === true } : {}),
  }));
  return {
    id: raw.id,
    name: (raw.name || '').trim() || raw.id,
    description: raw.description || '',
    customer: raw.customer || '',
    team: raw.teamName || '',
    start,
    end,
    model,
    sprintWeeks: weeks,
    periods,
    goals: (raw.projectGoals || []).filter((g) => typeof g === 'string' && g.trim()),
    status: raw.status === 'completed' ? 'completed' : 'in-progress',
    hasLogo: !!raw.hasLogo || !!raw.logo,
    hasCompanyLogo: !!raw.hasCompanyLogo || !!raw.companyLogo,
    reports: (raw.reports || []).filter((r) => r && typeof r.json === 'string'),
  };
}

// Indices of the periods running on a date: more than one when phases overlap.
export function periodsAt(p: Pick<Project, 'periods'>, date: string): number[] {
  const out: number[] = [];
  p.periods.forEach((x, i) => {
    if (x.start && x.end && date >= x.start && date <= x.end) out.push(i);
  });
  return out;
}

export const periodWord = (p: Pick<Project, 'model'>): string => (p.model === 'milestone' ? 'Phase' : 'Sprint');

export interface CurrentPeriod {
  n: string; // badge: the period's number, or – between periods
  name: string;
  state: BlockState;
}

// What "Current Phase(s)" shows: the phase names (a sprint as "Sprint 4 of 6"),
// or why there is none. "Closed" is kept for projects marked closed; one
// still active after its end date is "Past end date".
export function currentList(p: Pick<Project, 'model' | 'periods' | 'end' | 'status'>, indices: number[], date: string): CurrentPeriod[] {
  if (p.status === 'completed') return [{ n: '–', name: 'Closed', state: 'past' }];
  const list = indices.filter((i) => p.periods[i]);
  if (!list.length) {
    const first = p.periods.reduce((m, x) => (x.start && x.start < m ? x.start : m), p.periods.length ? p.periods[0].start : '');
    const name = p.end && date > p.end ? 'Past end date'
      : !p.periods.length ? 'No periods set'
        : first && date < first ? 'Yet to start'
          : p.model === 'milestone' ? 'No active phase' : 'No active sprint';
    return [{ n: '–', name, state: 'future' }];
  }
  return list.map((i) => ({
    n: String(i + 1),
    name: p.model === 'milestone' ? p.periods[i].name : `${p.periods[i].name} of ${p.periods.length}`,
    state: 'current',
  }));
}

// How far through the project a date is.
export function elapsed(p: Pick<Project, 'start' | 'end'>, date: string): { pct: number; days: number; total: number; left: number } {
  if (!p.start || !p.end) return { pct: 0, days: 0, total: 0, left: 0 };
  const total = Math.max(1, daysBetween(p.start, p.end));
  const days = Math.max(0, Math.min(total, daysBetween(p.start, date)));
  return { pct: Math.round((days / total) * 100), days, total, left: Math.max(0, daysBetween(date, p.end)) };
}

export type BlockState = 'past' | 'current' | 'future';

export const periodState = (x: Pick<Period, 'start' | 'end'>, date: string | null): BlockState =>
  !date ? 'future' : date > x.end ? 'past' : date >= x.start ? 'current' : 'future';

export interface GanttBar {
  i: number; // the period's index
  name: string;
  goal: string; // sprints
  tentative: boolean;
  start: string;
  end: string;
  col: number; // first day column, from 1
  span: number; // days
  state: BlockState;
}

export interface Gantt {
  days: number; // columns, one per day
  first: string;
  last: string;
  lanes: GanttBar[][];
  ticks: { label: string; pct: number }[]; // the first of each month
  todayPct: number | null; // where `date` falls, null outside the periods
  progressPct: number; // how much of the span lies before `date`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The periods on a day grid. A period that starts before the one on a row
// ends goes on the next free row, so overlapping phases sit one under the
// other while back-to-back sprints share a row. With `window`, only that many
// periods are drawn: three before the current one, it, and the next.
export function gantt(periods: Period[], date: string | null, window?: number): Gantt | null {
  let list = periods.map((x, i) => ({ ...x, i })).filter((x) => isIsoDate(x.start) && isIsoDate(x.end) && x.end >= x.start);
  if (!list.length) return null;
  if (window && list.length > window) {
    const cur = date ? list.findIndex((x) => date >= x.start && date <= x.end) : -1;
    const at = cur >= 0 ? cur : date && date > list[list.length - 1].end ? list.length - 1 : 0;
    const from = Math.max(0, Math.min(at - 3, list.length - window));
    list = list.slice(from, from + window);
  }
  const first = list.reduce((m, x) => (x.start < m ? x.start : m), list[0].start);
  const last = list.reduce((m, x) => (x.end > m ? x.end : m), list[0].end);
  const days = daysBetween(first, last) + 1;
  const pct = (d: string): number => Math.max(0, Math.min(100, (daysBetween(first, d) / days) * 100));
  const ends: string[] = [];
  const lanes: GanttBar[][] = [];
  [...list].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.i - b.i)).forEach((x) => {
    let lane = ends.findIndex((e) => e < x.start);
    if (lane < 0) {
      lane = ends.length;
      lanes.push([]);
    }
    ends[lane] = x.end;
    lanes[lane].push({
      i: x.i, name: x.name, goal: x.goal || '', tentative: !!x.tentative, start: x.start, end: x.end,
      col: daysBetween(first, x.start) + 1, span: daysBetween(x.start, x.end) + 1, state: periodState(x, date),
    });
  });
  const ticks: Gantt['ticks'] = [];
  const f = toDate(first);
  for (let d = new Date(f.getFullYear(), f.getMonth() + (f.getDate() > 1 ? 1 : 0), 1); isoDate(d) <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    ticks.push({ label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, pct: pct(isoDate(d)) });
  }
  const inside = !!date && date >= first && date <= last;
  const todayPct = inside ? pct(date as string) + (0.5 / days) * 100 : null;
  return { days, first, last, lanes, ticks, todayPct, progressPct: todayPct ?? (date && date > last ? 100 : 0) };
}

export interface ProjectFormData {
  id: string;
  name: string;
  team: string;
  customer: string;
  logo: string;
  logoName: string;
  companyLogo: string;
  companyLogoName: string;
  start: string;
  end: string;
  model: DeliveryModel;
  sprintWeeks: number;
  periods: Period[];
  goals: string[];
}

// Periods as the project file stores them (sprint goals included).
export const toStoredPeriods = (periods: Period[]): StoredPeriod[] => periods.filter((r) => r.start && r.end).map((r) => ({
  name: r.name.trim(),
  startDate: r.start,
  endDate: r.end,
  ...(r.goal ? { goal: r.goal, ...(r.tentative ? { tentative: true } : {}) } : {}),
}));

// The body of POST /api/projects[/<id>].
export function toStoredProject(f: ProjectFormData): StoredProject {
  const rows = toStoredPeriods(f.model === 'sprint' ? f.periods : f.periods.map(({ goal, tentative, ...r }) => r));
  return {
    id: f.id,
    name: f.name.trim(),
    customer: f.customer.trim(),
    teamName: f.team.trim(),
    startDate: f.start,
    endDate: f.end,
    deliveryModel: f.model,
    sprintDuration: f.sprintWeeks,
    ...(f.model === 'sprint' ? { sprints: rows } : { phases: rows }),
    projectGoals: f.goals.map((g) => g.trim()).filter(Boolean),
    logo: f.logo,
    logoName: f.logoName,
    companyLogo: f.companyLogo,
    companyLogoName: f.companyLogoName,
  };
}
