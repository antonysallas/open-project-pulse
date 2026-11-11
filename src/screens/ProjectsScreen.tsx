import React, { useState } from 'react';
import { ScreenProps } from '../types/ScreenTypes';
import AppHeader from '../components/AppHeader';
import Icon from '../components/Icon';
import ImportDialog from '../components/ImportDialog';
import { PhaseBadge, StatusChip, StatusGraph } from '../components/ui';
import { addDays, dayMonth, dayMonthYear, daysBetween, isoWeek, today, weekdayDate } from '../utils/dates';
import { currentList, elapsed, periodsAt } from '../utils/project';
import { recentHistory, submitted } from '../utils/report';
import { go, href } from '../utils/route';

interface ProjectsScreenProps extends ScreenProps {
  filter: 'active' | 'completed';
}

const ProjectsScreen: React.FC<ProjectsScreenProps> = ({ projects, filter, reload, notify }): JSX.Element => {
  const [importing, setImporting] = useState(false);
  const now = today();
  const active = projects.filter((p) => p.status !== 'completed');
  const completed = projects.filter((p) => p.status === 'completed');
  const list = filter === 'completed' ? completed : active;

  return (
    <>
      <AppHeader crumbs={[{ label: filter === 'completed' ? 'Closed projects' : 'Projects' }]}>
        <button type="button" className="s-btn" onClick={() => setImporting(true)}>
          <Icon name="upload" />
          Import
        </button>
        <a href={href.newProject()} className="s-btn s-btn--primary">
          <Icon name="plus" />
          New project
        </a>
      </AppHeader>
      <main className="pulse-main" style={{ gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 className="pulse-h1">Projects</h1>
            <span className="pulse-dateline">{`Week ${isoWeek(now)} · ${dayMonthYear(now)}`}</span>
          </div>
          <div className="s-segmented" role="group" aria-label="Filter">
            <button type="button" aria-pressed={filter === 'active'} onClick={() => go(href.projects())}>{`Active · ${active.length}`}</button>
            <button type="button" aria-pressed={filter === 'completed'} onClick={() => go(href.completed())}>{`Closed · ${completed.length}`}</button>
          </div>
        </div>

        <section className="pulse-table">
          <div className="pulse-table__head pulse-projects">
            <span>Project</span>
            <span>Current Phase(s)</span>
            <span>Elapsed</span>
            <span>Status</span>
            <span>Last 8 Weeks</span>
            <span>Next Report</span>
          </div>
          {list.map((p) => {
            const reports = submitted(p);
            const last = reports[0];
            const done = p.status === 'completed';
            const due = last ? addDays(last.date as string, 7) : now;
            const diff = daysBetween(now, due);
            const e = elapsed(p, now);
            const history = recentHistory(p);
            // A row, not a link: the status graph inside opens single reports.
            return (
              <div
                key={p.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ${p.name}`}
                className="pulse-table__row pulse-projects"
                onClick={() => go(href.project(p.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target === e.currentTarget) go(href.project(p.id));
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span className="pulse-projects__name">{p.name}</span>
                  <span className="pulse-projects__sub">
                    {[p.customer, p.start && p.end ? `${dayMonth(p.start)} – ${dayMonthYear(p.end)}` : ''].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div className="pulse-current pulse-current--sm">
                  {currentList(p, done ? [] : periodsAt(p, now), now).map((c) => (
                    <div key={`${c.n}-${c.name}`} className="pulse-current__row">
                      <PhaseBadge n={c.n} state={c.state} />
                      <span className="pulse-current__name">{c.name}</span>
                    </div>
                  ))}
                </div>
                <div className="pulse-elapsed">
                  <div className="pulse-elapsed__bar"><span style={{ width: `${e.pct}%` }} /></div>
                  <span className="pulse-dateline" style={{ fontSize: 12 }}>{`${e.pct}% · ${done ? 'closed' : `${e.left} days left`}`}</span>
                </div>
                <StatusChip status={last ? last.status : null} />
                {history.length
                  ? <StatusGraph history={history} slots={8} onOpen={(h) => h.json && go(href.report(p.id, h.json))} />
                  : <span className="pulse-dateline" style={{ fontSize: 12 }}>No reports yet</span>}
                <span className="pulse-due" data-due={done ? undefined : diff < 0 ? 'overdue' : diff === 0 ? 'today' : undefined}>
                  {done ? '—' : diff < 0 ? `Overdue · ${weekdayDate(due)}` : diff === 0 ? 'Due today' : weekdayDate(due)}
                </span>
              </div>
            );
          })}
          {!list.length && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: '32px 16px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600 }}>{filter === 'completed' ? 'No closed projects' : 'No active projects'}</span>
              <span className="pulse-sub">{filter === 'completed' ? 'Projects you close appear here.' : 'Projects you create appear here with their weekly reports.'}</span>
              {filter === 'active' && <a href={href.newProject()} className="s-btn s-btn--primary">New project</a>}
            </div>
          )}
        </section>
      </main>
      {importing && <ImportDialog projects={projects} reload={reload} notify={notify} onClose={() => setImporting(false)} />}
    </>
  );
};

export default ProjectsScreen;
