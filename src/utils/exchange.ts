import { Project, StoredPeriod, StoredProject, StoredReport } from '../types/ReportTypes';
import { fetchProjectDetails, fetchReport } from './api';
import { isIsoDate } from './dates';
import { isStatus } from './report';
import { looksLikeHtml, richHtml } from './rich';

// Projects and reports as .json files, to move them between Pulse installs or
// keep a copy. One envelope for both kinds; the project and reports inside are
// the shapes Pulse stores (types/ReportTypes.ts), logos included as the data
// URLs the project keeps, so a file stands on its own. server/api.js
// (POST /api/import) checks a file again before it changes anything.

export const EXPORT_FORMAT = 'pulse-export';
export const EXPORT_VERSION = 1;

interface Envelope {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
}

export interface ProjectExport extends Envelope {
  kind: 'project';
  project: StoredProject;
  reports: StoredReport[]; // drafts too, flagged draft: true
}

export interface ReportExport extends Envelope {
  kind: 'report';
  projectId: string;
  projectName: string;
  report: StoredReport;
}

export type PulseExport = ProjectExport | ReportExport;

export const projectFileName = (id: string, withReports: boolean): string => `${id}_${withReports ? 'project' : 'setup'}.json`;
export const reportFileName = (id: string, date: string): string => `${id}_${date}_report.json`;

const PROJECT_FIELDS: (keyof StoredProject)[] = [
  'id', 'name', 'description', 'customer', 'teamName', 'status', 'startDate', 'endDate', 'deliveryModel', 'sprintDuration',
  'sprints', 'phases', 'projectGoals', 'logo', 'logoName', 'companyLogo', 'companyLogoName',
];

const envelope = (): Envelope => ({ format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: new Date().toISOString() });

// Whether a report was locked here says nothing about the other Pulse.
const withoutLock = ({ locked, lockedAt, lockedBy, ...rest }: StoredReport): StoredReport => rest;

export async function exportProject(p: Project, withReports: boolean): Promise<ProjectExport> {
  const details = await fetchProjectDetails(p.id);
  const project = Object.fromEntries(PROJECT_FIELDS.filter((k) => details[k] !== undefined).map((k) => [k, details[k]])) as unknown as StoredProject;
  project.id = p.id;
  const reports = withReports ? await Promise.all(p.reports.map((r) => fetchReport(p.id, r.json).then(withoutLock))) : [];
  return { ...envelope(), kind: 'project', project, reports };
}

export async function exportReport(p: Project, file: string): Promise<ReportExport> {
  const report = withoutLock(await fetchReport(p.id, file));
  return { ...envelope(), kind: 'report', projectId: p.id, projectName: p.name, report };
}

export function downloadJson(name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Reading a file. Each message names the file and says what to do.
const notJson = (name: string): string => `${name} isn't a .json file. Choose a file exported from Pulse.`;
const notPulse = (name: string): string => `${name} isn't a Pulse export. Choose a .json file exported from Pulse.`;
const newer = (name: string): string => `${name} was made by a newer version of Pulse. Update Pulse, then import it again.`;
const damaged = (name: string): string => `${name} is incomplete or damaged, so nothing was imported. Export it again from Pulse.`;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const LISTS = ['accomplishments', 'upcomingGoals', 'peopleAndProcess', 'technology'] as const;

const goodReport = (r: unknown): r is StoredReport => isObject(r) && isIsoDate(r.reportDate) && isStatus(r.status) &&
  LISTS.every((k) => r[k] === undefined || (Array.isArray(r[k]) && (r[k] as unknown[]).every((x) => isObject(x) && typeof x.text === 'string')));

const goodPeriods = (list: unknown): list is StoredPeriod[] => Array.isArray(list) && list.every((x) => isObject(x) && isIsoDate(x.startDate) && isIsoDate(x.endDate));

function goodProject(p: unknown): p is StoredProject {
  if (!isObject(p) || typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name.trim()) return false;
  if (!isIsoDate(p.startDate) || !isIsoDate(p.endDate)) return false;
  const periods = p.deliveryModel === 'milestone' ? p.phases : p.sprints;
  if (periods !== undefined && !goodPeriods(periods)) return false;
  return p.projectGoals === undefined || (Array.isArray(p.projectGoals) && p.projectGoals.every((g) => typeof g === 'string'));
}

// The export a file holds, or an Error saying why it can't be imported.
export function parseExport(text: string, name: string): PulseExport {
  let d: unknown;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error(notPulse(name));
  }
  if (!isObject(d) || d.format !== EXPORT_FORMAT) throw new Error(notPulse(name));
  if (typeof d.version === 'number' && d.version > EXPORT_VERSION) throw new Error(newer(name));
  if (d.version !== EXPORT_VERSION) throw new Error(damaged(name));
  if (d.kind === 'project' && goodProject(d.project) && Array.isArray(d.reports) && d.reports.every(goodReport)) {
    const dates = d.reports.map((r) => r.reportDate);
    if (new Set(dates).size === dates.length) return d as unknown as ProjectExport;
  }
  if (d.kind === 'report' && typeof d.projectId === 'string' && d.projectId && goodReport(d.report)) return d as unknown as ReportExport;
  throw new Error(damaged(name));
}

export async function readExportFile(file: File): Promise<PulseExport> {
  if (!/\.json$/i.test(file.name) && file.type !== 'application/json') throw new Error(notJson(file.name));
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error(`Couldn't read ${file.name}. Try again.`);
  }
  return parseExport(text, file.name);
}

// Rich text from a file is cleaned as the editor cleans what it saves, so only
// the few tags Pulse allows are stored. Plain text stays as it is: it is shown
// escaped.
const cleanRich = (s: string): string => (looksLikeHtml(s) ? richHtml(s) : s);

function cleanReport(r: StoredReport): StoredReport {
  const out: StoredReport = { ...r };
  LISTS.forEach((k) => {
    if (r[k]) out[k] = (r[k] || []).map((x) => ({ ...x, text: cleanRich(x.text) }));
  });
  if (typeof r.statusReason === 'string') out.statusReason = cleanRich(r.statusReason);
  return out;
}

export function cleanExport(d: PulseExport): PulseExport {
  if (d.kind === 'report') return { ...d, report: cleanReport(d.report) };
  const goals = d.project.projectGoals;
  return { ...d, project: { ...d.project, ...(goals ? { projectGoals: goals.map(cleanRich) } : {}) }, reports: d.reports.map(cleanReport) };
}

// Stakeholder items in a report: everything but FYI.
export const actionItems = (r: StoredReport): number =>
  [...(r.peopleAndProcess || []), ...(r.technology || [])].filter((x) => x.type && x.type !== 'FYI').length;

export const projectPeriods = (p: StoredProject): StoredPeriod[] => (p.deliveryModel === 'milestone' ? p.phases : p.sprints) || [];
