import { useEffect, useState } from 'react';
import { Project } from '../types/ReportTypes';
import { fetchProjectDetails } from './api';

// Customer logos (data URLs) are left out of the project list; fetch each once.
const cache = new Map<string, string>();

export const forgetLogo = (id: string): void => {
  cache.delete(id);
};

export function useLogo(project: Pick<Project, 'id' | 'hasLogo'> | null | undefined): string {
  const id = project && project.hasLogo ? project.id : null;
  const [logo, setLogo] = useState<string>(() => (id && cache.get(id)) || '');
  useEffect(() => {
    if (!id) {
      setLogo('');
      return undefined;
    }
    const known = cache.get(id);
    if (known) {
      setLogo(known);
      return undefined;
    }
    let live = true;
    fetchProjectDetails(id)
      .then((d) => {
        const url = typeof d.logo === 'string' && d.logo.startsWith('data:image/') ? d.logo : '';
        if (url) cache.set(id, url);
        if (live) setLogo(url);
      })
      .catch(() => live && setLogo(''));
    return () => {
      live = false;
    };
  }, [id]);
  return logo;
}

// Your organisation's logo for report footers, when you have added one
// (`pulse logo <file>`; server/api.js serves it from the data folder). None is
// a normal answer (204), so check that an image came back.
export const ORG_LOGO = '/brand/org-logo';
let brand: Promise<boolean> | null = null;

export function useOrgLogo(): string {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    brand = brand || fetch(ORG_LOGO, { method: 'HEAD' })
      .then((r) => r.ok && (r.headers.get('content-type') || '').startsWith('image/'))
      .catch(() => false);
    brand.then((v) => live && setOk(v));
    return () => {
      live = false;
    };
  }, []);
  return ok ? ORG_LOGO : '';
}
