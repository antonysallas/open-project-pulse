import React from 'react';
import { EditItem, Project, ReportDraft } from '../types/ReportTypes';
import { LabelChip, PhaseBadge, Rich, StatusBoxes, StatusGraph, TypeTag } from '../components/ui';
import { dayMonthYear, dayNumMonth, daysBetween, isoWeek } from '../utils/dates';
import { barDates, barLabel, keyState } from '../components/Gantt';
import { layoutGantt, LayoutStyle } from '../utils/ganttLayout';
import { BlockState, currentList, elapsed, gantt } from '../utils/project';
import { ACTION_ORDER, actionCounts, HistoryPoint, reportPeriods, STATUS, TYPES, upcomingTitle } from '../utils/report';
import { isRichEmpty } from '../utils/rich';

// The two A4 landscape pages of the PDF, drawn at
// 297 × 210 mm and captured page by page (exportPdf). With `wide`, the same
// pages at 16:9 (1280 × 720 px, 13.33 × 7.5 in) for slides (exportPptx). Item text scales with
// --fit, and the objectives with --fit-goals, which fitPage lowers until every
// [data-fit-box] stops overflowing.

interface ReportPdfProps {
  project: Project;
  draft: ReportDraft;
  logo: string;
  orgLogo: string;
  history: HistoryPoint[];
  wide?: boolean;
}

const fit = (px: number, v = '--fit'): string => `calc(${px}px * var(${v}, 1))`;

const pageStyle = (wide: boolean): React.CSSProperties => ({
  width: wide ? 1280 : '297mm', height: wide ? 720 : '210mm', boxSizing: 'border-box', overflow: 'hidden', padding: wide ? '24px 40px 16px' : '8mm 11mm 5mm',
  display: 'flex', flexDirection: 'column', gap: wide ? 8 : '2.5mm', background: '#ffffff', color: 'var(--text)', fontFamily: 'var(--font-sans)',
});
// Outlines are borders, not inset shadows: html2canvas fills an inset shadow
// across the whole box.
const outline = '1px solid var(--border-strong)';
const card: React.CSSProperties = { display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: outline, boxSizing: 'border-box', minWidth: 0, minHeight: 0 };
const cardHead: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '4px 12px', margin: '-1px -1px 0', background: 'var(--text)', color: 'var(--surface)', flex: 'none' };
const cardTitle: React.CSSProperties = { fontFamily: 'var(--font-display)', margin: 0, fontSize: 14, fontWeight: 600 };
const listStyle: React.CSSProperties = { margin: 0, padding: '8px 12px', listStyle: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 };
const numStyle: React.CSSProperties = { fontWeight: 700, color: 'var(--text-secondary)' };
const muted: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' };

const texts = (items: EditItem[]): string[] => items.map((x) => x.text).filter((t) => !isRichEmpty(t));

// Rich text items as a numbered list at a fitted size.
interface ItemsProps {
  items: string[];
  size: number;
  sep?: string; // a plain-text lead before this is bold
  v?: string; // the scale it follows
  gap?: number;
  indent?: number;
  flush?: boolean;
}

const Items: React.FC<ItemsProps> = ({ items, size, sep, v = '--fit', gap = 6, indent = 20, flush }): JSX.Element => (
  <ol style={{ ...listStyle, ...(flush ? { padding: '0 0 0 4px' } : {}), gap: fit(gap, v) }}>
    {items.map((html, i) => (
      // eslint-disable-next-line react/no-array-index-key
      <li key={i} style={{ display: 'grid', gridTemplateColumns: `${indent}px minmax(0, 1fr)`, gap: indent < 20 ? 4 : 6, fontSize: fit(size, v), lineHeight: 1.4 }}>
        <span style={numStyle}>{`${i + 1}.`}</span>
        <Rich html={html} sep={sep} />
      </li>
    ))}
  </ol>
);

const PDF_BARS: LayoutStyle = {
  nameFont: "600 12px 'Red Hat Text'",
  dateFont: "400 10px 'Red Hat Mono'",
  nameLine: 15.6,
  dateLine: 13,
  padX: 6,
  badge: 24,
  padY: 7,
  minLane: 38,
  maxLabel: 240,
  gap: 6,
  maxLines: 1,
};

// The timeline on the page: bars sized by date ("Phase 2", or the sprint's
// name), overlapping ones on their own row, a label too long for its bar
// beside it (utils/ganttLayout.ts); then a card per period with its state and
// full name, or a sprint's goal. Sprint projects show five sprints around the
// current one. `trackWidth` is the timeline's width on the page in px.
interface PdfTimelineProps {
  project: Project;
  date: string;
  fill: string;
  trackWidth: number;
  current: number[];
}

const PdfTimeline: React.FC<PdfTimelineProps> = ({ project: p, date, fill, trackWidth, current }): JSX.Element => {
  const ms = p.model === 'milestone';
  const g = gantt(p.periods, date, ms ? undefined : 5);
  if (!g) return <span style={muted}>No phases or sprints set.</span>;
  const all = g.lanes.flat().sort((a, b) => a.i - b.i);
  const stateOf = (i: number, byDate: BlockState): BlockState => (current.includes(i) ? 'current' : byDate);
  const lanes = layoutGantt(g, trackWidth, PDF_BARS, (i) => {
    const b = all.find((x) => x.i === i);
    return { name: b ? barLabel(b, ms) : `${ms ? 'Phase' : 'Sprint'} ${i + 1}`, dates: b ? barDates(b.start, b.end, ms) : '' };
  }, stateOf, false);
  const inset = ms ? 1 : 2;
  const today = g.todayPct;
  const colours = (st: BlockState): React.CSSProperties => (st === 'current' ? { background: 'var(--info-soft)', color: 'var(--info-text)' }
    : st === 'past' ? { background: 'var(--success-soft)', color: 'var(--success-text)' } : { background: 'var(--surface-hover)', color: 'var(--text-secondary)' });
  const fg = (st: BlockState): string => (st === 'current' ? 'var(--info-text)' : st === 'past' ? 'var(--success-text)' : 'var(--text-secondary)');
  return (
    <div style={{ padding: '4px 12px 8px' }}>
      {/* The arrow alone: the date is the Report Date at the top. */}
      <div style={{ position: 'relative', height: 8 }}>
        {today !== null && (
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${today}%`, width: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: -5, width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid var(--accent)' }} />
          </div>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'relative', height: 18, borderBottom: '1px solid var(--border-strong)' }}>
          {g.ticks.filter((t) => t.pct <= 93).map((t) => (
            <div key={t.label} style={{ position: 'absolute', top: 0, bottom: 0, left: `${t.pct}%`, display: 'flex', alignItems: 'center', paddingLeft: 4, borderLeft: '1px solid var(--border-strong)' }}>
              <span style={{ font: '11px var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.label}</span>
            </div>
          ))}
        </div>
        {today !== null && <span style={{ position: 'absolute', top: 0, bottom: 3, left: `${today}%`, width: 0, marginLeft: -1, borderLeft: '2px dotted var(--accent)', zIndex: 0 }} />}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
          {lanes.map((lane, l) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={l} style={{ position: 'relative', height: lane.height }}>
              {lane.bars.map((b) => (
                <React.Fragment key={b.i}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: b.left + inset, width: Math.max(2, b.width - inset * 2), borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', overflow: 'hidden', ...colours(b.state) }}>
                    {b.inside && (
                      <div style={{ padding: `3px ${PDF_BARS.padX}px`, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{b.name}</span>
                        <span style={{ font: '10px/1.3 var(--font-mono)' }}>{b.dates}</span>
                      </div>
                    )}
                  </div>
                  {!b.inside && (
                    <div
                      style={{
                        position: 'absolute', top: 0, bottom: 0, width: b.labelWidth, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1,
                        ...(b.side === 'right' ? { left: b.left + b.width + PDF_BARS.gap, textAlign: 'left' } : { left: b.left - PDF_BARS.gap - b.labelWidth, textAlign: 'right' }),
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{b.name}</span>
                      <span style={{ font: '10px/1.3 var(--font-mono)', color: 'var(--text-secondary)' }}>{b.dates}</span>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', height: 6, marginTop: 8, borderRadius: 'var(--radius-full)', background: 'var(--surface-hover)' }}>
          <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${g.progressPct}%`, background: fill, borderRadius: 'var(--radius-full)' }} />
          {today !== null && <span style={{ position: 'absolute', top: '50%', left: `${today}%`, width: 10, height: 10, margin: '-5px 0 0 -5px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 2px #ffffff' }} />}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(5, all.length))}, minmax(0, 1fr))`, gap: 4, marginTop: 8 }}>
        {all.map((b) => {
          const st = stateOf(b.i, b.state);
          const unset = !ms && !b.goal;
          return (
            <div key={b.i} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, padding: '5px 8px', borderRadius: 'var(--radius-sm)', ...colours(st), ...(st === 'current' ? { border: '1.5px solid var(--info-text)', padding: '3.5px 6.5px' } : {}) }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, font: '700 10px var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', color: fg(st) }}>
                <span>{ms ? `Phase ${b.i + 1}` : `Sprint ${b.i + 1}`}</span>
                <span style={{ fontWeight: 600, letterSpacing: 0, textTransform: 'none' }}>{keyState(b, st, ms)}</span>
              </span>
              <span
                style={{
                  fontSize: 11.5, fontWeight: unset ? 500 : 600, lineHeight: 1.3, overflowWrap: 'break-word',
                  color: unset ? 'var(--text-muted)' : !ms && b.tentative ? 'var(--text-secondary)' : 'var(--text)', fontStyle: unset || (!ms && b.tentative) ? 'italic' : 'normal',
                }}
              >
                {ms ? b.name || `Phase ${b.i + 1}` : b.goal || 'Goal not set yet'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// The current sprint: "Sprint 4 of 6", a cell per day filled up to today,
// and its dates. Before the first sprint or after the last, says so.
const SprintNow: React.FC<{ project: Project; date: string; index: number | undefined }> = ({ project: p, date, index }): JSX.Element => {
  const b = index === undefined ? undefined : p.periods[index];
  if (!b) {
    const first = p.periods.reduce((m, x) => (x.start < m ? x.start : m), p.periods.length ? p.periods[0].start : date);
    return <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.15 }}>{date < first ? 'Yet to start' : 'Past end date'}</span>;
  }
  const len = daysBetween(b.start, b.end) + 1;
  const day = Math.max(0, Math.min(len, daysBetween(b.start, date) + 1));
  const left = Math.max(0, daysBetween(date, b.end));
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{b.name}</span>
        <span style={{ font: '12px var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{`of ${p.periods.length}`}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${len}, minmax(0, 1fr))`, gap: 2, marginTop: 'auto', paddingTop: 3 }}>
        {Array.from({ length: len }, (_, k) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={k} style={{ height: 6, borderRadius: 2, background: k < day ? 'var(--info-text)' : 'var(--surface-hover)' }} />
        ))}
      </div>
      {/* Wraps between its parts, never inside one. */}
      <span style={{ font: '11px/1.35 var(--font-mono)', color: 'var(--text-secondary)' }}>
        {`${dayNumMonth(b.start)} – ${dayNumMonth(b.end)} · day ${day} of ${len} · ${left} day${left === 1 ? '' : 's'} left`.split(' · ').map((part) => part.replace(/ /g, '\u00a0')).join(' · ')}
      </span>
    </>
  );
};

// The page number on the left, the logos on the right.
const Footer: React.FC<{ logo: string; orgLogo: string; page: number }> = ({ logo, orgLogo, page }): JSX.Element => (
  <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingTop: '1.5mm', borderTop: '1px solid var(--border-strong)', minHeight: 26 }}>
    <span style={{ font: '600 12px var(--font-mono)', color: 'var(--text)' }}>{page}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      {/* html2canvas ignores object-fit: size the image box to the image itself. */}
      {orgLogo && <img src={orgLogo} alt="" style={{ width: 'auto', height: 'auto', maxHeight: 24, maxWidth: 110 }} />}
      {logo && orgLogo && <span style={{ width: 1, height: 20, background: 'var(--border-strong)' }} />}
      {logo && <img src={logo} alt="" style={{ width: 'auto', height: 'auto', maxHeight: 26, maxWidth: 96 }} />}
    </div>
  </footer>
);

const ReportPdf: React.FC<ReportPdfProps> = ({ project: p, draft: d, logo, orgLogo, history, wide = false }): JSX.Element => {
  const page = pageStyle(wide);
  const D = d.date;
  const S = STATUS[d.status];
  const week = isoWeek(D);
  const e = elapsed(p, D);
  const people = d.people.filter((x) => !isRichEmpty(x.text));
  const tech = d.tech.filter((x) => !isRichEmpty(x.text));
  const actions = actionCounts([...people, ...tech]);
  const actionCount = actions.reduce((s, a) => s + a.n, 0);
  const current = currentList(p, reportPeriods(d, p), D);
  const statLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, lineHeight: 1.25, color: 'var(--text-secondary)' };
  const statCell: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 2, padding: '7px 12px', minWidth: 0, borderLeft: '1px solid var(--border-strong)' };
  const statValue: React.CSSProperties = { fontSize: 20, fontWeight: 700, lineHeight: 1.15, whiteSpace: 'nowrap' };

  return (
    <>
      <section data-pdf-page="1" style={page}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <LabelChip label="Report Date" value={dayMonthYear(D)} />
              <LabelChip label="Next Report" value={dayMonthYear(d.nextDate || D)} />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{p.name}</h1>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{[p.team, p.customer].filter(Boolean).join(' · ')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 'none', width: 330 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><LabelChip label="Week" value={String(week)} /></div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Project Status</span>
            <StatusBoxes status={d.status} size="pdf" />
          </div>
        </header>

        {d.status !== 'on-track' && !isRichEmpty(d.reason) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '7px 12px', borderRadius: 'var(--radius-md)', background: S.soft }}>
            <span style={{ flex: 'none', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', background: S.fill, color: S.on, marginTop: 1 }}>{`Why ${S.label}`}</span>
            <Rich html={d.reason} sep="" style={{ fontSize: 13, lineHeight: 1.4 }} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) repeat(3, minmax(0, 0.95fr)) minmax(0, 1.6fr)', alignItems: 'stretch', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: outline }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '7px 12px', minWidth: 0 }}>
            <span style={statLabel}>{p.model === 'milestone' ? 'Current Phase(s)' : 'Current Sprint'}</span>
            {p.model === 'milestone' ? current.map((c) => (
              <div key={`${c.n}-${c.name}`} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: 8, alignItems: 'start', minWidth: 0 }}>
                <PhaseBadge n={c.n} state={c.state} />
                <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, minWidth: 0 }}>{c.name}</span>
              </div>
            )) : <SprintNow project={p} date={D} index={reportPeriods(d, p)[0]} />}
          </div>
          <div style={statCell}>
            <span style={statValue}>{`${e.pct}%`}</span>
            <span style={statLabel}>Elapsed</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 'auto', paddingTop: 3, minWidth: 0 }}>
              <span style={{ height: 4, borderRadius: 999, background: 'var(--surface-hover)', overflow: 'hidden', display: 'flex' }}><span style={{ width: `${e.pct}%`, background: 'var(--text)' }} /></span>
              <span style={{ font: '11px var(--font-mono)', color: 'var(--text-secondary)' }}>{`${e.days} of ${e.total} days`}</span>
            </div>
          </div>
          <div style={statCell}>
            <span style={statValue}>{e.left}</span>
            <span style={statLabel}>Days Remaining</span>
            {p.start && p.end && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignSelf: 'flex-start', marginTop: 'auto' }}>
                {[['Start', p.start], ['End', p.end]].map(([label, date]) => (
                  <div key={label} style={{ display: 'flex', border: '1px solid var(--text)', borderRadius: 4, overflow: 'hidden' }}>
                    <span style={{ width: 36, flex: 'none', textAlign: 'center', background: 'var(--text)', color: '#ffffff', fontSize: 10, fontWeight: 600, padding: '1px 0', whiteSpace: 'nowrap' }}>{label}</span>
                    <span style={{ padding: '1px 5px', font: '500 11px var(--font-mono)', whiteSpace: 'nowrap' }}>{dayMonthYear(date)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={statCell}>
            <span style={statValue}>{actionCount}</span>
            <span style={statLabel}>Needs Stakeholder Action</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'auto', paddingTop: 2 }}>
              {actions.length ? actions.map((a) => <TypeTag key={a.type} type={a.type} count={a.n} small />) : <span style={{ font: '11px var(--font-mono)', color: 'var(--text-secondary)' }}>None</span>}
            </div>
          </div>
          <div style={{ ...statCell, gap: 3 }}>
            <span style={statLabel}>Status · Last 8 Weeks</span>
            {/* Eight weeks from the left, as on screen: one report is one point at the left. */}
            <StatusGraph history={history} nowLabel="Now" slots={8} />
          </div>
        </div>

        <section style={card}>
          <div style={cardHead}><h2 style={cardTitle}>Timeline</h2></div>
          <PdfTimeline project={p} date={D} fill={S.fill} trackWidth={wide ? 1174 : 1013} current={reportPeriods(d, p)} />
        </section>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <section data-fit-box data-fit-var="--fit-goals" style={{ ...card, flex: 1 }}>
            <div style={cardHead}><h2 style={cardTitle}>Project Objectives</h2></div>
            {p.goals.length ? <Items items={p.goals} size={12.5} sep=" — " v="--fit-goals" indent={18} /> : <span style={muted}>No objectives set.</span>}
          </section>
        </div>

        <Footer logo={logo} orgLogo={orgLogo} page={1} />
      </section>

      <section data-pdf-page="2" style={page}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24, paddingBottom: '2.5mm', borderBottom: '1px solid var(--border-strong)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>{p.name}</span>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ font: '13px var(--font-mono)', color: 'var(--text-secondary)' }}>{`Week ${week} · ${dayMonthYear(D)}`}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700, background: S.fill, color: S.on }}>{S.label}</span>
          </div>
        </header>

        <div style={{ flex: '1 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {[{ title: 'Accomplishments', items: texts(d.done) }, { title: upcomingTitle(p), items: texts(d.upcoming) }].map((c) => (
            <section key={c.title} data-fit-box style={card}>
              <div style={cardHead}><h2 style={cardTitle}>{c.title}</h2></div>
              {c.items.length ? <Items items={c.items} size={13} /> : <span style={muted}>Nothing listed this week.</span>}
            </section>
          ))}
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 15, fontWeight: 700 }}>{`Needs Stakeholder Action · ${actionCount}`}</h2>

        <div style={{ flex: '1.15 1 0', minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {[{ title: 'People and Process', items: people }, { title: 'Technology', items: tech }].map((c) => {
            const groups = ACTION_ORDER.map((type) => ({ type, items: c.items.filter((x) => x.type === type).map((x) => x.text) })).filter((g) => g.items.length);
            return (
              <section key={c.title} data-fit-box style={card}>
                <div style={cardHead}><h2 style={cardTitle}>{c.title}</h2></div>
                <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: fit(10), minHeight: 0 }}>
                  {!groups.length && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nothing to report this week.</span>}
                  {groups.map((g) => (
                    <div key={g.type} style={{ display: 'flex', flexDirection: 'column', gap: fit(5) }}>
                      <TypeTag type={g.type} />
                      <Items items={g.items} size={13} gap={5} flush />
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(4, minmax(0, 1fr))', gap: 16, alignItems: 'start', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-sidebar)' }}>
          <span style={{ fontSize: 12, fontWeight: 700, lineHeight: '20px' }}>Legend</span>
          {ACTION_ORDER.map((t) => (
            <div key={t} style={{ display: 'grid', gridTemplateColumns: '80px minmax(0, 1fr)', gap: 8, alignItems: 'start', fontSize: 11.5, lineHeight: 1.3, minWidth: 0 }}>
              <TypeTag type={t} />
              <span>{TYPES[t].desc}</span>
            </div>
          ))}
        </div>

        <Footer logo={logo} orgLogo={orgLogo} page={2} />
      </section>
    </>
  );
};

export default ReportPdf;
