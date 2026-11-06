import React from 'react';
import { ItemType, ReportStatus } from '../types/ReportTypes';
import { dayMonth, isoWeek } from '../utils/dates';
import { BlockState } from '../utils/project';
import { HistoryPoint, isStatus, STATUS, STATUS_ORDER, TYPES } from '../utils/report';
import { richHtml } from '../utils/rich';

// Small pieces of the design shared by the screens and the PDF.

// A section with a dark ink header bar.
interface InkCardProps {
  title: React.ReactNode;
  meta?: React.ReactNode; // right side of the header
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const InkCard: React.FC<InkCardProps> = ({ title, meta, className, style, children }): JSX.Element => (
  <section className={`pulse-ink${className ? ` ${className}` : ''}`} style={style}>
    <div className="pulse-ink__head">
      <h2 className="pulse-ink__title">{title}</h2>
      {meta}
    </div>
    {children}
  </section>
);

// "Report Date | Thu 15 May 2031": an ink label and its value.
export const LabelChip: React.FC<{ label: string; value: React.ReactNode; small?: boolean; tone?: 'overdue' }> = ({ label, value, small, tone }): JSX.Element => (
  <span className={`pulse-chip${small ? ' pulse-chip--sm' : ''}`} data-tone={tone}>
    <span className="pulse-chip__label">{label}</span>
    <span className="pulse-chip__value">{value}</span>
  </span>
);

// A period number on a coloured square: green done, blue current, grey to come.
export const PhaseBadge: React.FC<{ n: string | number; state: BlockState; big?: boolean }> = ({ n, state, big }): JSX.Element => (
  <span className={`pulse-badge${big ? ' pulse-badge--big' : ''}`} data-state={state}>{n}</span>
);

// The status as a small solid chip ("At Risk"), or "No report".
export const StatusChip: React.FC<{ status: string | null | undefined; small?: boolean }> = ({ status, small }): JSX.Element => {
  const s = isStatus(status) ? STATUS[status] : null;
  return (
    <span className={`pulse-status${small ? ' pulse-status--sm' : ''}`} style={s ? { background: s.fill, color: s.on } : undefined}>
      {s ? s.label : 'No report'}
    </span>
  );
};

// Delayed | At Risk | On Track, the current one solid with a marker above it.
interface StatusBoxesProps {
  status: ReportStatus | null;
  onChange?: (status: ReportStatus) => void;
  size?: 'md' | 'pdf';
}

export const StatusBoxes: React.FC<StatusBoxesProps> = ({ status, onChange, size = 'md' }): JSX.Element => (
  <div className={`pulse-rag pulse-rag--${size}`} role={onChange ? 'radiogroup' : undefined} aria-label="Project status">
    {STATUS_ORDER.map((key) => {
      const v = STATUS[key];
      const on = key === status;
      const style = on ? { background: v.fill, color: v.on } : { background: v.soft, color: 'var(--text-secondary)' };
      return (
        <div key={key} className="pulse-rag__cell">
          {on && <span className="pulse-rag__marker" />}
          {onChange ? (
            <button type="button" role="radio" aria-checked={on} className="pulse-rag__box" style={style} onClick={() => onChange(key)}>{v.label}</button>
          ) : (
            <div className="pulse-rag__box" style={style} aria-current={on ? 'true' : undefined}>{v.label}</div>
          )}
        </div>
      );
    })}
  </div>
);

// "Why At Risk": the status reason on the status's soft colour.
export const WhyBanner: React.FC<{ status: ReportStatus; children: React.ReactNode }> = ({ status, children }): JSX.Element => {
  const s = STATUS[status];
  return (
    <div className="pulse-why" style={{ background: s.soft }}>
      <span className="pulse-why__tag" style={{ background: s.fill, color: s.on }}>{`Why ${s.label}`}</span>
      <div className="pulse-why__body">{children}</div>
    </div>
  );
};

const ROW: Record<ReportStatus, number> = { 'on-track': 0, 'at-risk': 1, delayed: 2 };

// Status over the last weeks as a line across three rows (On Track, At Risk,
// Delayed). With `slots`, the points sit in that many columns from the left
// (eight weeks on screen); otherwise they spread across. `nowLabel` names the
// newest point ("Now" on the PDF). With `onOpen`, a point and its week number
// open that week's report, except the report on screen (`viewing`).
interface StatusGraphProps {
  history: HistoryPoint[];
  nowLabel?: string;
  slots?: number;
  onOpen?: (h: HistoryPoint) => void;
  viewing?: string; // json file of the report on screen
}

export const StatusGraph: React.FC<StatusGraphProps> = ({ history, nowLabel, slots, onOpen, viewing }): JSX.Element => {
  const hist = history.slice(-8);
  const n = Math.max(1, slots || hist.length);
  const title = (h: HistoryPoint): string => `Open the ${dayMonth(h.date)} report · ${STATUS[h.status].label}`;
  const open = (h: HistoryPoint) => (e: React.MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation(); // inside a clickable row
    if (onOpen) onOpen(h);
  };
  const can = (h: HistoryPoint): boolean => !!onOpen && !!h.json && h.json !== viewing;
  return (
    <div className="pulse-graph">
      <div className="pulse-graph__rows">
        {(['on-track', 'at-risk', 'delayed'] as ReportStatus[]).map((s) => (
          <span key={s} className="pulse-graph__row">
            <span className="pulse-graph__swatch" style={{ background: STATUS[s].fill }} />
            {STATUS[s].label}
          </span>
        ))}
      </div>
      <div className="pulse-graph__plot">
        {[7.5, 22.5, 37.5].map((top) => <span key={top} className="pulse-graph__rule" style={{ top }} />)}
        <svg viewBox={`0 0 ${n * 100} 45`} preserveAspectRatio="none" className="pulse-graph__line" aria-hidden="true">
          <polyline points={hist.map((h, i) => `${(i + 0.5) * 100},${ROW[h.status] * 15 + 7.5}`).join(' ')} fill="none" stroke="#4d4641" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
        {hist.map((h, i) => {
          const last = i === hist.length - 1;
          const size = last ? 10 : 7;
          const fill = STATUS[h.status].fill;
          return (
            <React.Fragment key={h.date}>
              {can(h) && <button type="button" className="pulse-graph__hit" style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }} aria-label={title(h)} title={title(h)} onClick={open(h)} />}
              <span
                className="pulse-graph__dot"
                style={{
                  left: `${((i + 0.5) / n) * 100}%`, top: ROW[h.status] * 15 + 7.5, width: size, height: size, margin: `-${size / 2}px 0 0 -${size / 2}px`,
                  background: fill, boxShadow: `0 0 0 1.5px #ffffff${last ? `, 0 0 0 3px ${fill}` : ''}`,
                }}
              />
            </React.Fragment>
          );
        })}
      </div>
      <span />
      <div className="pulse-graph__labels" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {hist.map((h, i) => {
          const label = i === hist.length - 1 && nowLabel ? nowLabel : String(isoWeek(h.date));
          const style = { gridColumn: i + 1, fontWeight: i === hist.length - 1 ? 700 : 500 };
          return can(h)
            ? <button key={h.date} type="button" className="pulse-graph__week" style={style} title={title(h)} onClick={open(h)}>{label}</button>
            : <span key={h.date} style={style}>{label}</span>;
        })}
      </div>
    </div>
  );
};

// ASK / APPROVAL / DIRECTIVE / FYI as a solid tag.
export const TypeTag: React.FC<{ type: ItemType; small?: boolean; count?: number }> = ({ type, small, count }): JSX.Element => (
  <span className={`pulse-type${small ? ' pulse-type--sm' : ''}`} style={{ background: TYPES[type].bg, color: TYPES[type].fg }}>
    {count === undefined ? type : `${count} ${type}`}
  </span>
);

// Rich text from a report or project, cleaned again on the way out.
export const Rich: React.FC<{ html: string; sep?: string; className?: string; style?: React.CSSProperties }> = ({ html, sep, className, style }): JSX.Element => (
  // eslint-disable-next-line react/no-danger
  <div className={`pulse-rich${className ? ` ${className}` : ''}`} style={style} dangerouslySetInnerHTML={{ __html: richHtml(html, sep) }} />
);
