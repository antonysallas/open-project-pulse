import React, { useCallback, useState } from 'react';
import { ItemType } from '../types/ReportTypes';
import { ScreenProps } from '../types/ScreenTypes';
import AppHeader from '../components/AppHeader';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';
import { NumberedRich, ReportHead, StatStrip, TimelineCard } from '../components/ReportParts';
import { InkCard, LabelChip, Rich, StatusChip, WhyBanner } from '../components/ui';
import { reportUrl, updateProject } from '../utils/api';
import { addDays, dayMonth, dayMonthYear, daysBetween, isoWeek, today } from '../utils/dates';
import { currentList, periodsAt } from '../utils/project';
import { actionTotal, isStatus, recentHistory, submitted } from '../utils/report';
import { isRichEmpty } from '../utils/rich';
import { go, href } from '../utils/route';

interface ProjectScreenProps extends ScreenProps {
  id: string;
}

export const NotFound: React.FC = (): JSX.Element => (
  <>
    <AppHeader crumbs={[{ label: 'Projects', href: href.projects() }, { label: 'Not found' }]} />
    <main className="pulse-main">
      <div className="s-card">
        <div className="s-empty">
          <p className="s-empty__title">No such project</p>
          <span>It may have been renamed or never saved. Pick one from the list.</span>
          <a href={href.projects()} className="s-btn s-btn--primary">All projects</a>
        </div>
      </div>
    </main>
  </>
);

const PER_PAGE = 5;
const ACTION_TYPES: ItemType[] = ['ASK', 'APPROVAL', 'DIRECTIVE'];

const ProjectScreen: React.FC<ProjectScreenProps> = ({ projects, id, reload, notify }): JSX.Element => {
  const p = projects.find((x) => x.id === id);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const closeConfirm = useCallback(() => setConfirming(false), []);

  if (!p) return <NotFound />;

  const now = today();
  const done = p.status === 'completed';
  const reports = submitted(p);
  const last = reports[0];
  const status = last && isStatus(last.status) ? last.status : null;
  const due = last ? addDays(last.date as string, 7) : now;
  const history = recentHistory(p);
  const actions = ACTION_TYPES.map((type) => ({ type, n: (last && last.actions && last.actions[type]) || 0 })).filter((a) => a.n);
  const pages = Math.max(1, Math.ceil(p.reports.length / PER_PAGE));
  const pg = Math.min(page, pages - 1);
  const shown = p.reports.slice(pg * PER_PAGE, (pg + 1) * PER_PAGE);

  const setStatus = async (next: 'completed' | 'in-progress'): Promise<void> => {
    setBusy(true);
    try {
      await updateProject(p.id, { status: next });
      await reload();
      setConfirming(false);
      if (next === 'completed') {
        go(href.projects());
        notify(`${p.name} moved to Closed`);
      } else {
        notify('Project reopened');
      }
    } catch (err) {
      notify((err as Error).message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppHeader crumbs={[{ label: 'Projects', href: href.projects() }, { label: p.name }]}>
        {done ? (
          <button type="button" className="s-btn" disabled={busy} onClick={() => setStatus('in-progress')}>Reopen project</button>
        ) : (
          <>
            <button type="button" className="s-btn s-btn--ghost pulse-hide-sm" onClick={() => setConfirming(true)}>Close project</button>
            <a href={href.editProject(p.id)} className="s-btn">
              <Icon name="pencil" />
              Edit project
            </a>
            <a href={href.newReport(p.id)} className="s-btn s-btn--primary">
              <Icon name="file-plus" />
              New report
            </a>
          </>
        )}
      </AppHeader>

      <main className="pulse-main">
        <ReportHead
          chips={(
            <>
              <LabelChip label="Report Date" value={last ? dayMonthYear(last.date as string) : 'None yet'} />
              <LabelChip label="Next Report" value={done ? '—' : dayMonthYear(due)} tone={!done && daysBetween(now, due) < 0 ? 'overdue' : undefined} />
              {done && <span className="pulse-done-tag">Closed</span>}
            </>
          )}
          title={p.name}
          sub={[p.team, p.customer].filter(Boolean).join(' · ')}
          week={last ? String(isoWeek(last.date as string)) : '—'}
          status={status}
        />

        {status && status !== 'on-track' && last && last.reason && !isRichEmpty(last.reason) && (
          <WhyBanner status={status}><Rich html={last.reason} sep="" /></WhyBanner>
        )}

        <StatStrip
          project={p}
          date={now}
          current={currentList(p, done ? [] : periodsAt(p, now), now)}
          actions={actions}
          history={history}
          onOpen={(h) => h.json && go(href.report(p.id, h.json))}
        />

        <TimelineCard project={p} date={done ? null : now} showRange />

        <div className="pulse-pair">
          <InkCard title="Project Objectives">
            {p.goals.length ? <NumberedRich items={p.goals} sep=" — " /> : <span className="pulse-empty">No objectives yet. Add them in the project setup.</span>}
          </InkCard>

          <InkCard
            title={`Reports · ${p.reports.length}`}
            meta={last && !done ? (
              <a href={href.newReport(p.id, last.json)} className="pulse-ink__btn">
                <Icon name="copy" size={14} />
                {`Start from ${dayMonth(last.date as string)} report`}
              </a>
            ) : undefined}
          >
            {p.reports.length > 0 && (
              <div className="pulse-table__head pulse-reports">
                <span>Report Date</span>
                <span>Week</span>
                <span>Status</span>
                <span>Stakeholder Action</span>
                <span style={{ textAlign: 'right' }}>Files</span>
              </div>
            )}
            {shown.map((r) => {
              const n = actionTotal(r.actions);
              const open = r.draft ? href.editReport(p.id, r.json) : href.report(p.id, r.json);
              return (
                <a
                  key={r.json}
                  href={open}
                  className="pulse-table__row pulse-reports"
                  title={r.date ? (r.draft ? `Continue editing the ${dayMonth(r.date)} draft` : `Open the ${dayMonth(r.date)} report`) : 'Open the report'}
                >
                  <span className="pulse-reports__date">
                    <span className="pulse-mono">{r.date ? dayMonthYear(r.date) : r.json}</span>
                    {r.draft && <span className="pulse-draft-tag">Draft</span>}
                    {r.locked && (
                      <span className="pulse-draft-tag" title="Presented: no more edits">
                        <Icon name="lock" size={10} />
                        Locked
                      </span>
                    )}
                  </span>
                  <span className="pulse-mono pulse-muted">{r.date ? `W${isoWeek(r.date)}` : '—'}</span>
                  <StatusChip status={r.status} />
                  <span className="pulse-muted">{n ? `${n} item${n === 1 ? '' : 's'}` : '—'}</span>
                  <span className="pulse-reports__files">
                    {r.draft ? <span className="pulse-continue">Continue</span> : r.pdf ? (
                      <span
                        role="link"
                        tabIndex={0}
                        className="pulse-pdf-link"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open(reportUrl(p.id, r.pdf as string), '_blank', 'noopener');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(reportUrl(p.id, r.pdf as string), '_blank', 'noopener');
                          }
                        }}
                      >
                        PDF
                      </span>
                    ) : <span className="pulse-muted">—</span>}
                    <Icon name="chevron-right" />
                  </span>
                </a>
              );
            })}
            {pages > 1 && (
              <div className="pulse-pager">
                <span className="pulse-dateline" style={{ fontSize: 12 }}>{`${pg * PER_PAGE + 1}–${Math.min(p.reports.length, (pg + 1) * PER_PAGE)} of ${p.reports.length}`}</span>
                <div className="pulse-pager__pages">
                  <button type="button" className="s-btn s-btn--ghost s-btn--icon s-btn--sm" aria-label="Newer reports" disabled={pg === 0} onClick={() => setPage(pg - 1)}><Icon name="chevron-left" /></button>
                  {Array.from({ length: pages }, (_, i) => (
                    <button key={i} type="button" className="pulse-pager__page" aria-current={i === pg ? 'page' : undefined} onClick={() => setPage(i)}>{i + 1}</button>
                  ))}
                  <button type="button" className="s-btn s-btn--ghost s-btn--icon s-btn--sm" aria-label="Older reports" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}><Icon name="chevron-right" /></button>
                </div>
              </div>
            )}
            {!p.reports.length && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '20px 16px' }}>
                <span className="pulse-sub">No reports yet. Weekly reports for this project appear here.</span>
                {!done && <a href={href.newReport(p.id)} className="s-btn s-btn--primary">New report</a>}
              </div>
            )}
          </InkCard>
        </div>
      </main>

      {confirming && (
        <ConfirmDialog
          title={`Close '${p.name}'?`}
          body="It moves to Closed and drops out of the active list. Reports stay where they are, and you can reopen it later."
          confirmLabel="Close project"
          busy={busy}
          onConfirm={() => setStatus('completed')}
          onCancel={closeConfirm}
        />
      )}
    </>
  );
};

export default ProjectScreen;
