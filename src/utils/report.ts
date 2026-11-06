import { EditItem, ItemType, Period, Project, ReportDraft, ReportItem, ReportStatus, ReportSummary, StoredReport } from '../types/ReportTypes';
import { addDays, compactDate, isIsoDate, today } from './dates';
import { periodsAt } from './project';
import { isRichEmpty, richHtml } from './rich';

const AMBER = '#f5a524';
const AMBER_SOFT = '#fdf1d6';

// Order of the status boxes: worst on the left.
export const STATUS_ORDER: ReportStatus[] = ['delayed', 'at-risk', 'on-track'];

export const STATUS: Record<ReportStatus, { label: string; fill: string; on: string; soft: string }> = {
  'on-track': { label: 'On Track', fill: 'var(--success)', on: '#ffffff', soft: 'var(--success-soft)' },
  'at-risk': { label: 'At Risk', fill: AMBER, on: 'var(--text)', soft: AMBER_SOFT },
  delayed: { label: 'Delayed', fill: 'var(--danger)', on: '#ffffff', soft: 'var(--danger-soft)' },
};

export const isStatus = (s: unknown): s is ReportStatus => typeof s === 'string' && s in STATUS;

// Most urgent first: the order items are grouped in and the legend.
export const ACTION_ORDER: ItemType[] = ['ASK', 'APPROVAL', 'DIRECTIVE', 'FYI'];

export const TYPES: Record<ItemType, { bg: string; fg: string; desc: string }> = {
  ASK: { bg: 'var(--danger)', fg: '#ffffff', desc: 'High risk. Needs urgent resolution by stakeholders.' },
  APPROVAL: { bg: AMBER, fg: 'var(--text)', desc: 'Awaiting a yes or no decision.' },
  DIRECTIVE: { bg: 'var(--info-text)', fg: '#ffffff', desc: "Needs stakeholders' mandatory instruction." },
  FYI: { bg: 'var(--border-strong)', fg: 'var(--text)', desc: 'For information only.' },
};
const isType = (t: unknown): t is ItemType => typeof t === 'string' && t in TYPES;

export const reportFile = (projectId: string, date: string): string => `${compactDate(date)}_${projectId}_report.json`;
export const pdfFile = (projectId: string, date: string): string => `${compactDate(date)}_${projectId}_report.pdf`;

// The saved report that saving on this date would collide with, other than
// `own`, the file this one was opened from.
export const reportOnDate = (p: Pick<Project, 'id' | 'reports'>, date: string, own: string | null = null): ReportSummary | undefined => {
  const name = reportFile(p.id, date);
  return name === own ? undefined : p.reports.find((r) => r.json === name);
};

// The first weekly date from `date` on that has no saved report.
export const freeDate = (p: Pick<Project, 'id' | 'reports'>, date: string): string => {
  let free = date;
  while (reportOnDate(p, free)) free = addDays(free, 7);
  return free;
};
export const downloadName = (projectName: string, date: string): string =>
  `${projectName.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Project'}_Report_${date}.pdf`;

// The second list's title: phased projects track tasks, sprints track goals.
export const upcomingTitle = (p: Pick<Project, 'model'>): string => (p.model === 'milestone' ? 'Ongoing and Outstanding Tasks' : 'Upcoming Goals');

let nextKey = 1;
export const newItem = (text = '', type: ItemType = 'FYI'): EditItem => ({ key: `i${nextKey++}`, text, type });

// Saved items as rich text; empty ones dropped.
export const richItems = (list: ReportItem[] | undefined): ReportItem[] =>
  (Array.isArray(list) ? list : [])
    .map((x) => ({ text: richHtml(x && x.text), type: isType(x && x.type) ? x.type : ('FYI' as ItemType) }))
    .filter((x) => x.text);

const toEdit = (list: ReportItem[] | undefined, keepOne: boolean): EditItem[] => {
  const items = richItems(list).map((x) => newItem(x.text, x.type));
  return items.length || !keepOne ? items : [newItem()];
};

export function blankDraft(date: string): ReportDraft {
  return {
    date, nextDate: addDays(date, 7), periods: null, status: 'on-track', reason: '',
    done: [newItem()], upcoming: [newItem()], people: [], tech: [], copiedFrom: null,
  };
}

const storedPeriods = (r: StoredReport): number[] | null =>
  Array.isArray(r.currentPeriods) && r.currentPeriods.every((n) => Number.isInteger(n) && n >= 0) ? [...r.currentPeriods] : null;

// A saved report back in the editor, or (copy) the start of next week's:
// dates move forward a week and the periods follow the new date.
export function draftFromStored(r: StoredReport, copy: boolean): ReportDraft {
  const saved = isIsoDate(r.reportDate) ? r.reportDate : null;
  const date = saved ? (copy ? addDays(saved, 7) : saved) : today();
  return {
    date,
    nextDate: !copy && isIsoDate(r.nextReportDate) ? r.nextReportDate : addDays(date, 7),
    periods: copy ? null : storedPeriods(r),
    status: isStatus(r.status) ? r.status : 'on-track',
    reason: richHtml(r.statusReason, ''),
    done: toEdit(r.accomplishments, true),
    upcoming: toEdit(r.upcomingGoals, true),
    people: toEdit(r.peopleAndProcess, false),
    tech: toEdit(r.technology, false),
    copiedFrom: copy ? saved : null,
    goalCur: !copy && typeof r.sprintGoal === 'string' ? r.sprintGoal : null,
    goalNext: !copy && typeof r.nextSprintGoal === 'string' ? r.nextSprintGoal : null,
  };
}

// The periods the report covers: picked by hand, or those running on its date.
export const reportPeriods = (d: Pick<ReportDraft, 'periods' | 'date'>, p: Pick<Project, 'periods'>): number[] =>
  (d.periods || periodsAt(p, d.date)).filter((i) => i >= 0 && i < p.periods.length);

const cleanItems = (list: EditItem[]): ReportItem[] =>
  list.map((x) => ({ text: richHtml(x.text), type: x.type })).filter((x) => !isRichEmpty(x.text));

// The report file. The reason is kept only while the status needs one.
export function draftToStored(d: ReportDraft, p: Pick<Project, 'periods'>, draft: boolean): StoredReport {
  const periods = reportPeriods(d, p);
  const out: StoredReport = {
    reportDate: d.date,
    nextReportDate: d.nextDate,
    status: d.status,
    accomplishments: cleanItems(d.done),
    upcomingGoals: cleanItems(d.upcoming),
    peopleAndProcess: cleanItems(d.people),
    technology: cleanItems(d.tech),
    draft,
  };
  if (d.periods) out.currentPeriods = periods;
  if (typeof d.goalCur === 'string') out.sprintGoal = d.goalCur.trim().slice(0, 50);
  if (typeof d.goalNext === 'string') out.nextSprintGoal = d.goalNext.trim().slice(0, 50);
  const reason = richHtml(d.reason, '');
  if (d.status !== 'on-track' && !isRichEmpty(reason)) out.statusReason = reason;
  return out;
}

// A sprint project's sprints with the goals the report sets: the covered
// sprint's goal (confirmed) and, when typed, the next one's (tentative).
export function sprintsWithGoals(p: Pick<Project, 'model' | 'periods'>, d: Pick<ReportDraft, 'periods' | 'date' | 'goalCur' | 'goalNext'>): Period[] {
  if (p.model !== 'sprint') return p.periods;
  const ci = reportPeriods(d, p)[0];
  if (ci === undefined) return p.periods;
  return p.periods.map((x, i) => {
    if (i === ci) {
      const goal = (typeof d.goalCur === 'string' ? d.goalCur : x.goal || '').trim().slice(0, 50);
      return { ...x, goal, tentative: false };
    }
    if (i === ci + 1 && typeof d.goalNext === 'string') return { ...x, goal: d.goalNext.trim().slice(0, 50), tentative: true };
    return x;
  });
}

// Items that need stakeholders, by type (FYI left out).
export function actionCounts(items: { type: ItemType }[]): { type: ItemType; n: number }[] {
  return ACTION_ORDER.filter((t) => t !== 'FYI')
    .map((type) => ({ type, n: items.filter((x) => x.type === type).length }))
    .filter((x) => x.n);
}

export const actionTotal = (counts: Partial<Record<ItemType, number>> | undefined): number =>
  counts ? (counts.ASK || 0) + (counts.APPROVAL || 0) + (counts.DIRECTIVE || 0) : 0;

export interface HistoryPoint {
  date: string;
  status: ReportStatus;
  json?: string; // the saved report, so a point can open it
}

// Submitted reports, newest first (drafts left out).
export const submitted = (p: Pick<Project, 'reports'>): ReportSummary[] =>
  p.reports.filter((r) => !r.draft && r.date && isStatus(r.status));

// The last eight submitted reports, oldest first, from `fromJson` back (or
// from the newest).
export function recentHistory(p: Pick<Project, 'reports'>, fromJson?: string): HistoryPoint[] {
  const all = submitted(p);
  const ix = fromJson ? Math.max(0, all.findIndex((r) => r.json === fromJson)) : 0;
  return all.slice(ix, ix + 8).reverse().map((r) => ({ date: r.date as string, status: r.status as ReportStatus, json: r.json }));
}

// Up to eight weeks of status, oldest first: submitted reports before `date`,
// then this one.
export function statusHistory(p: Pick<Project, 'reports'>, date: string, status: ReportStatus, weeks = 8): HistoryPoint[] {
  const earlier = submitted(p)
    .filter((r) => (r.date as string) < date)
    .map((r) => ({ date: r.date as string, status: r.status as ReportStatus }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return [...earlier.slice(-(weeks - 1)), { date, status }];
}
