import React, { useEffect, useRef, useState } from 'react';
import { Project } from '../types/ReportTypes';
import { ToastTone } from '../types/ScreenTypes';
import Icon from './Icon';
import { importExport, ImportMode } from '../utils/api';
import { dayMonth, dayMonthYear, isIsoDate, isoWeek } from '../utils/dates';
import { actionItems, cleanExport, projectPeriods, PulseExport, readExportFile } from '../utils/exchange';
import { forgetLogo } from '../utils/logo';
import { reportFile, STATUS } from '../utils/report';
import { go, href } from '../utils/route';

interface ImportDialogProps {
  projects: Project[];
  reload: () => Promise<void>;
  notify: (message: string, tone?: ToastTone) => void;
  onClose: () => void;
}

interface Review {
  kind: string;
  title: string;
  sub: string;
  facts: [string, string][];
  notice: string; // amber: what importing will replace
  replacing: number | null; // with Keep both or Replace existing: the reports Replace would overwrite
  blocked: string; // red: why it can't be imported
  runLabel: string;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

// What the file holds, and what importing it would do to what is here.
function review(d: PulseExport, projects: Project[], mode: ImportMode): Review {
  const exported = typeof d.exportedAt === 'string' && isIsoDate(d.exportedAt.slice(0, 10)) ? dayMonthYear(d.exportedAt.slice(0, 10)) : 'Unknown';
  if (d.kind === 'project') {
    const p = d.project;
    const there = projects.find((x) => x.id === p.id);
    const periods = projectPeriods(p).length;
    const dates = d.reports.map((r) => r.reportDate).sort();
    const n = dates.length;
    return {
      kind: 'Project',
      title: p.name || p.id,
      sub: [p.customer, `${dayMonth(p.startDate as string)} – ${dayMonthYear(p.endDate as string)}`].filter(Boolean).join(' · '),
      facts: [
        ['Timeline', plural(periods, p.deliveryModel === 'milestone' ? 'phase' : 'sprint')],
        ['Reports', n ? `${n} · ${dayMonth(dates[0])} – ${dayMonthYear(dates[n - 1])}` : 'None · setup only'],
        ['Logos', p.companyLogo && p.logo ? 'Company and customer' : p.companyLogo ? 'Company only' : p.logo ? 'Customer only' : 'None'],
        ['Exported', exported],
      ],
      notice: there ? `'${there.name}' is already in Pulse. Choose what to do with the file.` : '',
      replacing: there ? there.reports.length : null,
      blocked: '',
      runLabel: !there ? 'Import project' : mode === 'replace' ? 'Replace project' : 'Import as a copy',
    };
  }
  const r = d.report;
  const target = projects.find((x) => x.id === d.projectId);
  const clash = target && target.reports.find((x) => x.json === reportFile(target.id, r.reportDate));
  const actions = actionItems(r);
  return {
    kind: 'Report',
    title: `Report · ${dayMonthYear(r.reportDate)}`,
    sub: `${d.projectName || d.projectId} · Week ${isoWeek(r.reportDate)}`,
    facts: [
      ['Status', r.status && r.status in STATUS ? STATUS[r.status as keyof typeof STATUS].label : '—'],
      ['Stakeholder action', actions ? plural(actions, 'item') : 'None'],
      ['Goes into', target ? target.name : 'No matching project'],
      ['Exported', exported],
    ],
    notice: target && clash && !clash.locked ? `${target.name} already has a ${clash.draft ? 'draft' : 'report'} for ${dayMonth(r.reportDate)}. Importing replaces it.` : '',
    replacing: null,
    blocked: !target
      ? `It belongs to '${d.projectName || d.projectId}', which isn't in Pulse. Import that project's file first, then this report.`
      : clash && clash.locked ? `${target.name} has a locked report for ${dayMonth(r.reportDate)}. Unlock it, then import this file again.` : '',
    runLabel: clash ? 'Replace report' : 'Import report',
  };
}

// "Import from a .json file": pick a file, see what it holds and what it
// would replace, then import it. The file decides what comes in: a project
// with its reports, or one report into the project it came from.
const ImportDialog: React.FC<ImportDialogProps> = ({ projects, reload, notify, onClose }): JSX.Element => {
  const [file, setFile] = useState<{ data: PulseExport; name: string } | null>(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<ImportMode>('copy');
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.querySelector<HTMLElement>('input, button.s-btn--primary')?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose, file]);

  const pick = async (f: File): Promise<void> => {
    setErr('');
    try {
      setFile({ data: await readExportFile(f), name: f.name });
      setMode('copy');
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const again = (): void => {
    setFile(null);
    setErr('');
  };

  const shown = file ? review(file.data, projects, mode) : null;

  const run = async (): Promise<void> => {
    if (!file || !shown || shown.blocked) return;
    const d = file.data;
    const there = d.kind === 'project' && projects.some((x) => x.id === d.project.id);
    setBusy(true);
    setErr('');
    try {
      const res = await importExport(cleanExport(d), there ? mode : null);
      forgetLogo(res.id);
      await reload();
      onClose();
      go(href.project(res.id));
      if ('name' in res) notify(`${res.name} imported · ${plural(res.reports, 'report')}`);
      else if (d.kind === 'report') notify(`Report for ${dayMonth(d.report.reportDate)} imported into ${(projects.find((x) => x.id === res.id) || { name: res.id }).name}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="pulse-dialog-back" onClick={() => !busy && onClose()}>
      <div ref={box} className="pulse-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title" onClick={(e) => e.stopPropagation()}>
        <div className="pulse-dialog__head">
          <h2 id="import-title" className="pulse-dialog__title">Import from a .json file</h2>
          <button type="button" className="pulse-dialog__close" aria-label="Close" disabled={busy} onClick={onClose}><Icon name="x" /></button>
        </div>

        {!shown || !file ? (
          <div className="pulse-dialog__body">
            <span>Choose a file exported from Pulse. A project file brings its setup, logos and reports. A report file adds one report to the project it came from.</span>
            <label
              className="s-dropzone"
              data-dragover={drag ? 'true' : undefined}
              style={{ position: 'relative', padding: '22px 12px', gap: 8, boxSizing: 'border-box' }}
              onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) pick(f);
              }}
            >
              <Icon name="file-json" size={20} />
              <span>Drop a .json file or <span style={{ color: 'var(--accent-text)', fontWeight: 500 }}>browse</span></span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  e.target.value = '';
                  if (f) pick(f);
                }}
              />
            </label>
            {err && <span className="s-error" role="alert">{err}</span>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="s-btn s-btn--ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="pulse-dialog__body">
            <div className="pulse-file-card">
              <span className="pulse-file-card__icon" aria-hidden="true">JSON</span>
              <span className="pulse-file-card__text">
                <span className="pulse-file-card__kind">{shown.kind}</span>
                <span className="pulse-file-card__title">{shown.title}</span>
                <span className="pulse-file-card__sub">{shown.sub}</span>
                <span className="pulse-file-card__file">{file.name}</span>
              </span>
            </div>
            <dl className="pulse-facts">
              {shown.facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {shown.notice && (
              <div className="pulse-warn" role="status">
                <Icon name="triangle-alert" />
                <span>{shown.notice}</span>
              </div>
            )}
            {shown.replacing !== null && (
              <div className="pulse-choices" role="group" aria-label="What to do with the file">
                {([
                  ['copy', 'Keep both', 'Adds the file as a second project. Nothing existing changes.'],
                  ['replace', 'Replace existing', `Overwrites its setup and ${plural(shown.replacing, 'report')} with the file's contents.`],
                ] as [ImportMode, string, string][]).map(([key, title, desc]) => (
                  <button key={key} type="button" className="pulse-choice" aria-pressed={mode === key} disabled={busy} onClick={() => setMode(key)}>
                    <span className="pulse-choice__title">{title}</span>
                    <span className="pulse-choice__desc">{desc}</span>
                  </button>
                ))}
              </div>
            )}
            {shown.blocked && (
              <div className="pulse-blocked" role="alert">
                <strong>This file can't be imported yet.</strong>
                {` ${shown.blocked}`}
              </div>
            )}
            {err && <span className="s-error" role="alert">{err}</span>}
            <div className="pulse-dialog__foot">
              <button type="button" className="s-btn s-btn--ghost" disabled={busy} onClick={again}>Choose another file</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="s-btn s-btn--ghost" disabled={busy} onClick={onClose}>Cancel</button>
                <button type="button" className="s-btn s-btn--primary" disabled={busy || !!shown.blocked} onClick={run}>{busy ? 'Importing…' : shown.runLabel}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportDialog;
