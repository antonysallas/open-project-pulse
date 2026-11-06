import React, { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { jsPDF as JsPdf } from 'jspdf';
import { Project, ReportDraft } from '../types/ReportTypes';
import { downloadName, statusHistory } from '../utils/report';
import ReportPdf from './ReportPdf';

type Stage = 'a4' | 'wide';

export interface ReportExport {
  stage: JSX.Element | null; // render it once in the screen
  busy: boolean;
  pdf: () => Promise<JsPdf>;
  pptx: () => Promise<Blob>;
}

export const pptxName = (projectName: string, date: string): string => downloadName(projectName, date).replace(/\.pdf$/, '.pptx');

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Draws the report pages off screen (A4 for the PDF, 16:9 for slides) just
// long enough to capture them. The libraries load on first use.
export function useReportExport(project: Project | undefined, draft: ReportDraft | null, logo: string, orgLogo: string): ReportExport {
  const [kind, setKind] = useState<Stage | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const run = async <T, >(k: Stage, make: (el: HTMLElement) => Promise<T>): Promise<T> => {
    flushSync(() => setKind(k));
    try {
      if (!ref.current) throw new Error("Couldn't draw the report. Try again.");
      return await make(ref.current);
    } finally {
      setKind(null);
    }
  };

  const stage = kind && project && draft ? (
    <div className="pulse-pdf-stage" data-theme="light" ref={ref} aria-hidden="true">
      <ReportPdf project={project} draft={draft} logo={logo} orgLogo={orgLogo} history={statusHistory(project, draft.date, draft.status)} wide={kind === 'wide'} />
    </div>
  ) : null;

  return {
    stage,
    busy: kind !== null,
    pdf: () => run('a4', async (el) => (await import('./exportPdf')).exportPdf(el)),
    pptx: () => run('wide', async (el) => (await import('./exportPptx')).exportPptx(el, project ? `${project.name} · ${draft ? draft.date : ''}` : 'Report')),
  };
}
