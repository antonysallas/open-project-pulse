import React, { useEffect, useMemo, useState } from 'react';
import { StoredReport } from '../types/ReportTypes';
import { ScreenProps } from '../types/ScreenTypes';
import AppHeader from '../components/AppHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import ExportMenu, { ExportFormat, JSON_TONE, MenuChoice, REPORT_FORMATS } from '../components/ExportMenu';
import Icon from '../components/Icon';
import { ActionGroups, Legend, NumberedRich, ReportHead, StatStrip, TimelineCard } from '../components/ReportParts';
import { InkCard, LabelChip, Rich, WhyBanner } from '../components/ui';
import { downloadBlob, pptxName, useReportExport } from '../pdf/useExport';
import { fetchReport, lockReport, reportUrl } from '../utils/api';
import { downloadJson, exportReport, reportFileName } from '../utils/exchange';
import { dayMonth, dayMonthYear, isoDate, isoWeek } from '../utils/dates';
import { useLogo, useOrgLogo } from '../utils/logo';
import { currentList } from '../utils/project';
import { actionCounts, downloadName, draftFromStored, recentHistory, reportPeriods, richItems, submitted, upcomingTitle } from '../utils/report';
import { isRichEmpty } from '../utils/rich';
import { go, href } from '../utils/route';
import { NotFound } from './ProjectScreen';

const FORMATS: MenuChoice<ExportFormat | 'json'>[] = [
  ...REPORT_FORMATS,
  { key: 'json', label: 'Pulse data (.json)', desc: 'This report only · import it into Pulse elsewhere', abbr: 'JSON', tone: JSON_TONE },
];

interface ReportViewScreenProps extends ScreenProps {
  id: string;
  file: string;
}

// A submitted report. It stays editable (Edit report) until it is locked once
// presented. A draft goes to the editor instead.
const ReportViewScreen: React.FC<ReportViewScreenProps> = ({ projects, id, file, reload, notify }): JSX.Element => {
  const p = projects.find((x) => x.id === id);
  const logo = useLogo(p);
  const orgLogo = useOrgLogo(p);
  const [report, setReport] = useState<StoredReport | null>(null);
  const [loadError, setLoadError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [confirm, setConfirm] = useState<'lock' | 'unlock' | null>(null);
  const [locking, setLocking] = useState(false);
  // The report as the editor and the PDF see it.
  const draft = useMemo(() => (report ? draftFromStored(report, false) : null), [report]);
  const ex = useReportExport(p, draft, logo, orgLogo);

  useEffect(() => {
    if (!p) return undefined;
    let live = true;
    fetchReport(p.id, file)
      .then((r) => {
        if (!live) return;
        if (r && r.draft) go(href.editReport(p.id, file));
        else setReport(r);
      })
      .catch((err: Error) => live && setLoadError(err.message));
    return () => {
      live = false;
    };
    // Load once; the screen is keyed by the file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!p) return <NotFound />;

  const all = submitted(p);
  const ix = all.findIndex((r) => r.json === file);
  const summary = ix >= 0 ? all[ix] : null;
  const date = report && report.reportDate ? report.reportDate : summary && summary.date ? summary.date : '';
  const crumbs = [
    { label: 'Projects', href: href.projects() },
    { label: p.name, href: href.project(p.id) },
    { label: `Report · ${date ? dayMonth(date) : '…'}` },
  ];

  if (!report || !draft) {
    return (
      <>
        <AppHeader crumbs={crumbs} />
        <main className="pulse-main">
          {loadError ? (
            <div className="s-alert s-alert--danger">
              <div>
                <p className="s-alert__title">Couldn't open the report</p>
                <span>{loadError}</span>
              </div>
              <a href={href.project(p.id)} className="s-btn s-btn--sm" style={{ marginLeft: 'auto' }}>Back to project</a>
            </div>
          ) : (
            <div className="s-card" aria-busy="true"><div className="s-skeleton" style={{ height: 16, width: '50%' }} /></div>
          )}
        </main>
      </>
    );
  }

  const d = draft;
  const periods = reportPeriods(d, p);
  const people = richItems(report.peopleAndProcess);
  const tech = richItems(report.technology);
  const actions = actionCounts([...people, ...tech]);
  const actionCount = actions.reduce((s, a) => s + a.n, 0);

  const locked = report.locked === true;
  const lockedOn = report.lockedAt && !Number.isNaN(Date.parse(report.lockedAt)) ? dayMonthYear(isoDate(new Date(report.lockedAt))) : null;
  const lockedNote = [report.lockedBy && `by ${report.lockedBy}`, lockedOn && `on ${lockedOn}`].filter(Boolean).join(' ');
  const place = ix >= 0 ? `report ${ix + 1} of ${all.length}` : 'report';

  const setLock = async (on: boolean): Promise<void> => {
    setLocking(true);
    try {
      setReport(await lockReport(p.id, file, on));
      setConfirm(null);
      await reload();
      notify(on ? 'Report locked. It can no longer be edited.' : 'Report unlocked. It can be edited again.');
    } catch (err) {
      notify((err as Error).message, 'danger');
    } finally {
      setLocking(false);
    }
  };

  const exportAs = async (format: ExportFormat | 'json'): Promise<void> => {
    if (format === 'json') {
      setExporting(true);
      try {
        const name = reportFileName(p.id, d.date);
        downloadJson(name, await exportReport(p, file));
        notify(`${name} downloaded`);
      } catch (err) {
        notify((err as Error).message, 'danger');
      } finally {
        setExporting(false);
      }
      return;
    }
    if (format === 'pdf' && summary && summary.pdf) {
      window.open(reportUrl(p.id, summary.pdf), '_blank', 'noopener');
      return;
    }
    // No PDF was saved with this report, or slides: draw them now.
    setExporting(true);
    try {
      if (format === 'pdf') (await ex.pdf()).save(downloadName(p.name, d.date));
      else downloadBlob(await ex.pptx(), pptxName(p.name, d.date));
    } catch (err) {
      notify((err as Error).message, 'danger');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <AppHeader crumbs={crumbs}>
        <a href={href.project(p.id)} className="s-btn s-btn--ghost pulse-hide-sm">Back to project</a>
        {p.status !== 'completed' && (
          <a href={href.newReport(p.id, file)} className="s-btn">
            <Icon name="copy" />
            New report from this
          </a>
        )}
        {!locked && (
          <a href={href.editReport(p.id, file)} className="s-btn">
            <Icon name="pencil" />
            Edit report
          </a>
        )}
        <ExportMenu label={exporting ? 'Preparing…' : 'Export'} heading="Export this report as" items={FORMATS} disabled={exporting} onPick={exportAs} />
      </AppHeader>

      <main className="pulse-main" style={{ paddingTop: 24 }}>
        <div className="pulse-readonly">
          <span>
            <Icon name={locked ? 'lock' : 'check'} />
            <span>{locked ? `Locked${lockedNote ? ` ${lockedNote}` : ''} · ${place}` : `Submitted · ${place} · editable until locked`}</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {locked ? (
              <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={() => setConfirm('unlock')}>
                <Icon name="lock-open" />
                Unlock
              </button>
            ) : (
              <button type="button" className="s-btn s-btn--sm" onClick={() => setConfirm('lock')}>
                <Icon name="lock" />
                Lock report
              </button>
            )}
            {ix >= 0 && (
              <>
                <button type="button" className="s-btn s-btn--ghost s-btn--sm" disabled={ix === 0} onClick={() => go(href.report(p.id, all[ix - 1].json))}>
                  <Icon name="chevron-left" />
                  Newer
                </button>
                <button type="button" className="s-btn s-btn--ghost s-btn--sm" disabled={ix >= all.length - 1} onClick={() => go(href.report(p.id, all[ix + 1].json))}>
                  Older
                  <Icon name="chevron-right" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="pulse-pagerule">Page 1 · Status and plan</div>
        <ReportHead
          chips={(
            <>
              <LabelChip label="Report Date" value={dayMonthYear(d.date)} />
              <LabelChip label="Next Report" value={dayMonthYear(d.nextDate)} />
            </>
          )}
          title={p.name}
          sub={[p.team, p.customer].filter(Boolean).join(' · ')}
          week={String(isoWeek(d.date))}
          status={d.status}
        />
        {d.status !== 'on-track' && !isRichEmpty(d.reason) && <WhyBanner status={d.status}><Rich html={d.reason} sep="" /></WhyBanner>}
        <StatStrip
          project={p}
          date={d.date}
          current={currentList(p, periods, d.date)}
          actions={actions}
          history={recentHistory(p, file)}
          onOpen={(h) => h.json && go(href.report(p.id, h.json))}
          viewing={file}
        />
        <TimelineCard project={p} date={d.date} current={periods} />
        <InkCard title="Project Objectives">
          {p.goals.length ? <NumberedRich items={p.goals} sep=" — " /> : <span className="pulse-empty">No objectives set.</span>}
        </InkCard>

        <div className="pulse-pagerule" style={{ paddingTop: 10 }}>Page 2 · This week</div>
        <div className="pulse-pair">
          {[{ title: 'Accomplishments', items: d.done }, { title: upcomingTitle(p), items: d.upcoming }].map((L) => {
            const items = L.items.map((x) => x.text).filter((t) => !isRichEmpty(t));
            return (
              <InkCard key={L.title} title={L.title}>
                {items.length ? <NumberedRich items={items} /> : <span className="pulse-empty">Nothing listed.</span>}
              </InkCard>
            );
          })}
        </div>
        <h2 className="pulse-h2">{`Needs Stakeholder Action · ${actionCount}`}</h2>
        <div className="pulse-pair">
          <ActionGroups title="People and Process" items={people} />
          <ActionGroups title="Technology" items={tech} />
        </div>
        <Legend />
      </main>

      {ex.stage}
      {confirm && (
        <ConfirmDialog
          title={confirm === 'lock' ? 'Lock this report?' : 'Unlock this report?'}
          body={confirm === 'lock'
            ? 'Lock it once it has been presented. A locked report and its PDF can\'t be changed; you can still export it. You can unlock it later if something needs fixing.'
            : `It was locked${lockedNote ? ` ${lockedNote}` : ''} as presented. Unlocking lets it be edited again, and saving it replaces its PDF.`}
          confirmLabel={locking ? (confirm === 'lock' ? 'Locking…' : 'Unlocking…') : confirm === 'lock' ? 'Lock report' : 'Unlock'}
          busy={locking}
          onConfirm={() => setLock(confirm === 'lock')}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
};

export default ReportViewScreen;
