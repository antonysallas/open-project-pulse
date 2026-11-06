import { useEffect, useState } from 'react';

// Screens live in the URL hash, so the back button and reloads keep your place
// without any server routes:
//   #/                                  active projects
//   #/closed                            closed projects
//   #/new-project                       project form
//   #/projects/<id>                     project page
//   #/projects/<id>/edit                project form for <id>
//   #/projects/<id>/reports/new         new report (?copy=<file>: start from that report)
//   #/projects/<id>/reports/<file>      a saved report, read-only (a draft opens in the editor)
//   #/projects/<id>/reports/<file>/edit a saved report in the editor
export type Route =
  | { name: 'projects'; filter: 'active' | 'completed' }
  | { name: 'new-project' }
  | { name: 'project'; id: string }
  | { name: 'edit-project'; id: string }
  | { name: 'report'; id: string; file: string | null; copy: string | null }
  | { name: 'view'; id: string; file: string };

export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const copy = new URLSearchParams(query).get('copy');
  if (parts[0] === 'closed' && parts.length === 1) return { name: 'projects', filter: 'completed' };
  if (parts[0] === 'new-project' && parts.length === 1) return { name: 'new-project' };
  if (parts[0] === 'projects' && parts[1]) {
    const id = parts[1];
    if (parts.length === 2) return { name: 'project', id };
    if (parts.length === 3 && parts[2] === 'edit') return { name: 'edit-project', id };
    if (parts.length === 4 && parts[2] === 'reports') {
      return parts[3] === 'new' ? { name: 'report', id, file: null, copy } : { name: 'view', id, file: parts[3] };
    }
    if (parts.length === 5 && parts[2] === 'reports' && parts[4] === 'edit') return { name: 'report', id, file: parts[3], copy: null };
  }
  return { name: 'projects', filter: 'active' };
}

const enc = encodeURIComponent;

export const href = {
  projects: (): string => '#/',
  completed: (): string => '#/closed',
  newProject: (): string => '#/new-project',
  project: (id: string): string => `#/projects/${enc(id)}`,
  editProject: (id: string): string => `#/projects/${enc(id)}/edit`,
  newReport: (id: string, copy?: string): string => `#/projects/${enc(id)}/reports/new${copy ? `?copy=${enc(copy)}` : ''}`,
  report: (id: string, file: string): string => `#/projects/${enc(id)}/reports/${enc(file)}`,
  editReport: (id: string, file: string): string => `#/projects/${enc(id)}/reports/${enc(file)}/edit`,
};

// The window scrolls; the top bar is sticky.
export const scrollToTop = (smooth = false): void => {
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
};

export const go = (to: string): void => {
  window.location.hash = to;
};

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = (): void => {
      setRoute(parseRoute(window.location.hash));
      scrollToTop();
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
