import { Project, StoredProject, StoredReport } from '../types/ReportTypes';
import { normalizeProject } from './project';

// Calls to server/api.js. Each throws an Error whose message can be shown as is.

// With sign-in on, a proxy sits in front of the app. Once the sign-in lapses it answers
// /api/ with 401 and redirects everything else to its sign-in page; the app then shows
// "Your session has ended" (utils/session.ts). With sign-in off, this never happens.
const SIGNED_OUT = 'Your sign-in has expired. Sign in again to carry on: what you typed is kept as a draft.';

type SignedOutListener = (signedOut: boolean) => void;
const listeners = new Set<SignedOutListener>();
let signedOut = false;

function setSignedOut(value: boolean): void {
  if (value === signedOut) return;
  signedOut = value;
  listeners.forEach((listener) => listener(value));
}

// Called with true when a call finds the sign-in lapsed, false when one works again.
export function onSignedOut(listener: SignedOutListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function request<T>(url: string, init?: RequestInit, onResponse?: (res: Response) => void): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, redirect: 'manual' });
  } catch {
    throw new Error("Couldn't reach Pulse. Check your connection and try again.");
  }
  if (res.status === 401 || res.type === 'opaqueredirect') {
    setSignedOut(true);
    throw new Error(SIGNED_OUT);
  }
  setSignedOut(false);
  if (onResponse) onResponse(res);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // The server's own messages that start with a capital are written for people.
    const own: string | null = body && typeof body.error === 'string' ? body.error : null;
    if (own && /^[A-Z]/.test(own)) throw new Error(own);
    const failed = init && init.method === 'POST' ? "Couldn't save" : "Couldn't load";
    throw new Error(`${failed}: ${own || `Pulse answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`}.`);
  }
  return body as T;
}

const postJson = <T>(url: string, body: unknown): Promise<T> =>
  request<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const enc = encodeURIComponent;

export async function fetchProjects(): Promise<Project[]> {
  const { projects } = await request<{ projects: StoredProject[] }>('/api/projects');
  return projects.map(normalizeProject);
}

// The details file, with the logo the project list leaves out.
export const fetchProjectDetails = (id: string): Promise<StoredProject> => request<StoredProject>(`/data/projects/${enc(id)}.json`);

export const createProject = (project: StoredProject): Promise<unknown> => postJson('/api/projects', { project });

export const updateProject = (id: string, project: Partial<StoredProject>): Promise<unknown> =>
  postJson(`/api/projects/${enc(id)}`, { project });

export const fetchReport = (id: string, file: string): Promise<StoredReport> =>
  request<StoredReport>(`/data/reports/${enc(id)}/${enc(file)}`);

// A saved report and its version, which a save sends back to show what it was based on.
export async function fetchReportToEdit(id: string, file: string): Promise<{ report: StoredReport; version: string | null }> {
  let version: string | null = null;
  const report = await request<StoredReport>(`/data/reports/${enc(id)}/${enc(file)}`, undefined, (res) => {
    version = res.headers.get('X-Report-Version');
  });
  return { report, version };
}

// `opened` is the file this report was opened from, null when it is new, and
// `version` that file's version then. The server refuses to replace any other
// report, or a version that has changed since. Returns the new version.
export const saveReport = (id: string, filename: string, data: StoredReport, opened: string | null, version: string | null): Promise<{ version: string }> =>
  postJson(`/api/reports/${enc(id)}`, { filename, data, opened, version });

export const savePdf = (id: string, filename: string, base64: string): Promise<unknown> =>
  postJson(`/api/reports/${enc(id)}/pdf`, { filename, base64 });

// Lock a submitted report once presented (no more edits), or unlock it. Returns the report.
export async function lockReport(id: string, filename: string, locked: boolean): Promise<StoredReport> {
  const { report } = await postJson<{ report: StoredReport }>(`/api/reports/${enc(id)}/lock`, { filename, locked });
  return report;
}

// Whether sign-in is on, and who is signed in. Through a sign-in proxy, any call
// also keeps the sign-in alive; this is the cheapest.
export interface SessionInfo {
  auth: boolean;
  user: string | null;
  signInUrl?: string;
  signOutUrl?: string;
  idleMinutes?: number;
}

export const pingSession = (): Promise<SessionInfo> => request<SessionInfo>('/api/session');

// A form's unsaved state kept on the server (utils/drafts.ts), or null when there is none.
export async function fetchDraft<T>(key: string): Promise<T | null> {
  try {
    return await request<T>(`/api/drafts/${enc(key)}`);
  } catch (err) {
    if (signedOut) throw err;
    return null;
  }
}

export const putDraft = (key: string, draft: unknown): Promise<unknown> => postJson(`/api/drafts/${enc(key)}`, { draft });

export const dropDraft = (key: string): Promise<unknown> => postJson(`/api/drafts/${enc(key)}`, { draft: null });

export const reportUrl = (id: string, file: string): string => `/data/reports/${enc(id)}/${enc(file)}`;
