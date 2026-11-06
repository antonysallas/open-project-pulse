import React from 'react';
import { ItemType, Project, ReportItem, ReportStatus } from '../types/ReportTypes';
import { dayMonthYear } from '../utils/dates';
import { CurrentPeriod, elapsed } from '../utils/project';
import { ACTION_ORDER, HistoryPoint, TYPES } from '../utils/report';
import Gantt from './Gantt';
import { gantt } from '../utils/project';
import { InkCard, LabelChip, PhaseBadge, Rich, StatusBoxes, StatusGraph, TypeTag } from './ui';

// The pieces of a report as the project page, the report view and the editor
// draw them (the PDF has its own, in pdf/ReportPdf.tsx).

// Dates, title and status across the top.
interface ReportHeadProps {
  chips: React.ReactNode;
  title: string;
  sub: string;
  week: string;
  status: ReportStatus | null;
  onStatus?: (s: ReportStatus) => void;
}

export const ReportHead: React.FC<ReportHeadProps> = ({ chips, title, sub, week, status, onStatus }): JSX.Element => (
  <section className="pulse-headrow">
    <div className="pulse-headrow__main">
      <div className="pulse-chips">{chips}</div>
      <h1 className="pulse-h1" style={{ fontSize: onStatus ? 28 : 30 }}>{title}</h1>
      <span className="pulse-sub">{sub}</span>
    </div>
    <div className="pulse-statusblock">
      <div className="pulse-statusblock__week"><LabelChip label="Week" value={week} /></div>
      <span className="pulse-label">Project Status</span>
      <StatusBoxes status={status} onChange={onStatus} />
    </div>
  </section>
);

export const CurrentRows: React.FC<{ list: CurrentPeriod[] }> = ({ list }): JSX.Element => (
  <>
    {list.map((c) => (
      <div key={`${c.n}-${c.name}`} className="pulse-current__row">
        <PhaseBadge n={c.n} state={c.state} big />
        <span className="pulse-current__name">{c.name}</span>
      </div>
    ))}
  </>
);

// Current periods, elapsed, days remaining, stakeholder actions and (on the
// project page) the last eight weeks.
interface StatStripProps {
  project: Project;
  date: string;
  current: CurrentPeriod[];
  actions: { type: ItemType; n: number }[];
  history?: HistoryPoint[];
  onOpen?: (h: HistoryPoint) => void; // a point in the history opens its report
  viewing?: string; // the report on screen: its point isn't a link
}

export const StatStrip: React.FC<StatStripProps> = ({ project: p, date, current, actions, history, onOpen, viewing }): JSX.Element => {
  const e = elapsed(p, date);
  const total = actions.reduce((s, a) => s + a.n, 0);
  return (
    <div className={`pulse-stats${history ? '' : ' pulse-stats--four'}`}>
      <div className="pulse-stat">
        <span className="pulse-label">{p.model === 'milestone' ? 'Current Phase(s)' : 'Current Sprint'}</span>
        <div className="pulse-current"><CurrentRows list={current} /></div>
      </div>
      <div className="pulse-stat">
        <span className="pulse-stat__value">{`${e.pct}%`}</span>
        <span className="pulse-stat__label">Elapsed</span>
        <div className="pulse-stat__foot">
          <span className="pulse-stat__bar"><span style={{ width: `${e.pct}%` }} /></span>
          <span className="pulse-stat__sub">{`${e.days} of ${e.total} days`}</span>
        </div>
      </div>
      <div className="pulse-stat">
        <span className="pulse-stat__value">{e.left}</span>
        <span className="pulse-stat__label">Days Remaining</span>
        {p.start && p.end && (
          <div className="pulse-stat__foot pulse-stat__dates">
            <LabelChip label="Start" value={dayMonthYear(p.start)} small />
            <LabelChip label="End" value={dayMonthYear(p.end)} small />
          </div>
        )}
      </div>
      <div className="pulse-stat">
        <span className="pulse-stat__value">{total}</span>
        <span className="pulse-stat__label">Needs Stakeholder Action</span>
        <div className="pulse-stat__tags">
          {actions.length ? actions.map((a) => <TypeTag key={a.type} type={a.type} count={a.n} small />) : <span className="pulse-stat__sub">None</span>}
        </div>
      </div>
      {history && (
        <div className="pulse-stat pulse-stat--graph">
          <span className="pulse-label">Status · Last 8 Weeks</span>
          {history.length ? <StatusGraph history={history} slots={8} onOpen={onOpen} viewing={viewing} /> : <span className="pulse-stat__sub">No reports yet</span>}
        </div>
      )}
    </div>
  );
};

export const TimelineCard: React.FC<{ project: Project; date: string | null; showRange?: boolean; current?: number[] }> = ({
  project: p, date, showRange, current,
}): JSX.Element | null => {
  const g = gantt(p.periods, date, p.model === 'sprint' ? 5 : undefined);
  return (
    <InkCard title="Timeline" meta={showRange && g ? <span className="pulse-ink__meta">{`${dayMonthYear(g.first)} – ${dayMonthYear(g.last)}`}</span> : undefined}>
      {g ? <Gantt gantt={g} phased={p.model === 'milestone'} marker progress current={current} /> : <span className="pulse-empty">No phases or sprints set. Add them in the project setup.</span>}
    </InkCard>
  );
};

// A numbered list of rich text. `sep` bolds a plain-text lead (": " for
// items, " — " for objectives).
export const NumberedRich: React.FC<{ items: string[]; sep?: string; flush?: boolean; start?: number }> = ({ items, sep, flush, start = 1 }): JSX.Element => (
  <ol className={`pulse-list${flush ? ' pulse-list--flush' : ''}`}>
    {items.map((html, i) => (
      // eslint-disable-next-line react/no-array-index-key
      <li key={i}>
        <span className="pulse-list__n">{`${start + i}.`}</span>
        <Rich html={html} sep={sep} />
      </li>
    ))}
  </ol>
);

// People and Process or Technology, its items grouped by type, most urgent first.
export const ActionGroups: React.FC<{ title: string; items: ReportItem[] }> = ({ title, items }): JSX.Element => {
  const groups = ACTION_ORDER.map((type) => ({ type, items: items.filter((x) => x.type === type) })).filter((g) => g.items.length);
  return (
    <InkCard title={title}>
      <div className="pulse-groups">
        {!groups.length && <span className="pulse-sub" style={{ fontSize: 13.5 }}>Nothing to report this week.</span>}
        {groups.map((g) => (
          <div key={g.type} className="pulse-group">
            <TypeTag type={g.type} />
            <NumberedRich items={g.items.map((x) => x.text)} flush />
          </div>
        ))}
      </div>
    </InkCard>
  );
};

export const Legend: React.FC = (): JSX.Element => (
  <div className="pulse-legend">
    <span className="pulse-legend__title">Legend</span>
    {ACTION_ORDER.map((t) => (
      <div key={t} className="pulse-legend__item">
        <TypeTag type={t} />
        <span>{TYPES[t].desc}</span>
      </div>
    ))}
  </div>
);
