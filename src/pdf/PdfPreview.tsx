import React, { useLayoutEffect, useRef, useState } from 'react';
import { Project, ReportDraft } from '../types/ReportTypes';
import { statusHistory } from '../utils/report';
import { fitPage } from './fit';
import ReportPdf from './ReportPdf';

interface PdfPreviewProps {
  project: Project;
  draft: ReportDraft;
  logo: string;
  orgLogo: string;
}

const PAGE_PX = (297 / 25.4) * 96; // A4 landscape width at 96 dpi
const PAGE_H = (210 / 25.4) * 96;
const GAP = 24;

// The two PDF pages as they will be exported, text fitting included, scaled
// to the width of the column.
const PdfPreview: React.FC<PdfPreviewProps> = ({ project, draft, logo, orgLogo }): JSX.Element => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = (): void => setScale(Math.min(1, el.clientWidth / PAGE_PX));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    pagesRef.current?.querySelectorAll<HTMLElement>('[data-pdf-page]').forEach(fitPage);
  });

  return (
    <div ref={wrapRef} className="pulse-pdf-preview" style={{ width: '100%', height: (PAGE_H * 2 + GAP) * scale, overflow: 'hidden' }}>
      <div
        ref={pagesRef}
        data-theme="light"
        style={{ width: PAGE_PX, display: 'flex', flexDirection: 'column', gap: GAP, transform: `scale(${scale})`, transformOrigin: 'top left', background: 'transparent' }}
      >
        <ReportPdf project={project} draft={draft} logo={logo} orgLogo={orgLogo} history={statusHistory(project, draft.date, draft.status)} />
      </div>
    </div>
  );
};

export default PdfPreview;
