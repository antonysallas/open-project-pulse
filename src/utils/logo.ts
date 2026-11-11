import { useEffect, useState } from 'react';
import { Project } from '../types/ReportTypes';
import { fetchProjectDetails } from './api';

// A project's logos (data URLs) are left out of the project list: fetch its
// details file once for both.
interface Logos {
  logo: string; // the customer's
  companyLogo: string; // your own organisation's, for this project
}

const cache = new Map<string, Promise<Logos>>();
const loaded = new Map<string, Logos>(); // the same, once they have come, for a first render without a flash
// An SVG logo needs a width and height on its <svg> tag: without them the PDF
// export (html2canvas) can't size it, draws nothing, and the empty box pushes
// the footer's other logo off the page. Taken from the viewBox when missing.
// Returns the logo with a size, the same logo when it isn't an SVG or already
// has one, or null when an SVG gives no size at all.
const SVG_URL = /^data:image\/svg\+xml;base64,/;
const NUMBER = /^\s*\d+(?:\.\d+)?(?:px)?\s*$/;

export function sizedSvg(url: string): string | null {
  if (!SVG_URL.test(url)) return url;
  let svg: string;
  try {
    svg = new TextDecoder().decode(Uint8Array.from(atob(url.replace(SVG_URL, '')), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
  const tag = (svg.match(/<svg\b[^>]*>/) || [''])[0];
  if (!tag) return null;
  const attr = (name: string): string | null => {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`));
    return m ? (m[1] ?? m[2]) : null;
  };
  const w = attr('width');
  const h = attr('height');
  if (w !== null && h !== null && NUMBER.test(w) && NUMBER.test(h)) return url;
  const box = (attr('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (box.length !== 4 || !(box[2] > 0) || !(box[3] > 0)) return null;
  const sized = tag
    .replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/g, '')
    .replace(/^<svg\b/, `<svg width="${box[2]}" height="${box[3]}"`);
  const bytes = new TextEncoder().encode(svg.replace(tag, sized));
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

// A stored logo as reports can use it: an unsized SVG gets its size here, so
// logos saved before uploads were checked still show.
const dataUrl = (v: unknown): string => (typeof v === 'string' && v.startsWith('data:image/') ? sizedSvg(v) || '' : '');

export const forgetLogo = (id: string): void => {
  cache.delete(id);
  loaded.delete(id);
};

function logosOf(id: string): Promise<Logos> {
  let known = cache.get(id);
  if (!known) {
    known = fetchProjectDetails(id).then((d) => {
      const logos = { logo: dataUrl(d.logo), companyLogo: dataUrl(d.companyLogo) };
      loaded.set(id, logos);
      return logos;
    });
    known.catch(() => cache.delete(id));
    cache.set(id, known);
  }
  return known;
}

function useProjectLogo(id: string | null, which: keyof Logos): string {
  const now = (): string => (id && loaded.has(id) ? (loaded.get(id) as Logos)[which] : '');
  const [logo, setLogo] = useState(now);
  useEffect(() => {
    setLogo(now());
    if (!id) return undefined;
    let live = true;
    logosOf(id).then((l) => live && setLogo(l[which])).catch(() => undefined);
    return () => {
      live = false;
    };
    // now() reads only id and which.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, which]);
  return logo;
}

// The customer logo for report footers.
export const useLogo = (project: Pick<Project, 'id' | 'hasLogo'> | null | undefined): string =>
  useProjectLogo(project && project.hasLogo ? project.id : null, 'logo');

// Your organisation's logo for report footers, when you have added one
// (`pulse logo <file>`; server/api.js serves it from the data folder). None is
// a normal answer (204), so check that an image came back.
export const ORG_LOGO = '/brand/org-logo';
let brand: Promise<boolean> | null = null;

function useDefaultOrgLogo(): string {
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

// The logo beside the customer's in report footers: the project's own company
// logo when it has one, otherwise the default above.
export function useOrgLogo(project: Pick<Project, 'id' | 'hasCompanyLogo'> | null | undefined): string {
  const fallback = useDefaultOrgLogo();
  const own = useProjectLogo(project && project.hasCompanyLogo ? project.id : null, 'companyLogo');
  return own || fallback;
}
