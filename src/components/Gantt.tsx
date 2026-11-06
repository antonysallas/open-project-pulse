import React, { useLayoutEffect, useRef, useState } from 'react';
import { dayMonth, dayNumMonth } from '../utils/dates';
import { measureText } from '../utils/ganttLayout';
import { BlockState, Gantt as GanttData, GanttBar } from '../utils/project';

interface GanttProps {
  gantt: GanttData;
  phased: boolean; // phases are labelled "Phase 2"; sprints by their names
  marker?: boolean; // the date as a dotted line with an arrow over it
  progress?: boolean; // the bar under the rows, filled up to the date
  current?: number[]; // periods a report covers: shown as current whatever their dates
}

// "1 Mar – 12 Mar" (phases) or "07/04 – 20/04" (sprints). A narrow bar
// breaks it at the dash only.
export const barDates = (start: string, end: string, phased: boolean): string =>
  (phased ? `${dayMonth(start)} – ${dayMonth(end)}` : `${dayNumMonth(start)} – ${dayNumMonth(end)}`).replace(/(\w) (\w)/g, '$1 $2');

export const barLabel = (b: Pick<GanttBar, 'i' | 'name'>, phased: boolean): string => (phased ? `Phase ${b.i + 1}` : b.name || `Sprint ${b.i + 1}`);

const STATE_WORD: Record<BlockState, string> = { past: 'Done', current: 'In progress', future: 'Not started' };

// A key card's state: a future sprint whose goal is only planned says so.
export const keyState = (b: GanttBar, state: BlockState, phased: boolean): string =>
  (!phased && state === 'future' && b.goal && b.tentative ? 'Tentative' : STATE_WORD[state]);

const NAME_FONT = "600 12.5px 'Red Hat Text'";

// Periods on a calendar: month ticks above, the report date as a dotted line,
// progress below, then a key card per period with its state and its full name
// (a sprint's goal). A bar shows "Phase 2" or the sprint's name and dates, or
// just its number when that doesn't fit.
const Gantt: React.FC<GanttProps> = ({ gantt: g, phased, marker, progress, current }): JSX.Element => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const measure = (): void => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stateOf = (b: GanttBar): BlockState => (current && current.includes(b.i) ? 'current' : b.state);
  // Name and dates inside when the name takes at most two lines.
  const full = (b: GanttBar): boolean => {
    const px = (b.span / g.days) * width;
    return px >= 72 && measureText(barLabel(b, phased), NAME_FONT) / Math.max(1, px - 18) <= 2;
  };
  const bars = g.lanes.flat().sort((a, b) => a.i - b.i);
  const today = marker && g.todayPct !== null ? g.todayPct : null;
  return (
    <div className="pulse-gantt">
      {marker && (
        <div className="pulse-gantt__marker-row">
          {today !== null && (
            <div className="pulse-gantt__marker" style={{ left: `${today}%` }}>
              <span className="pulse-gantt__marker-arrow" />
            </div>
          )}
        </div>
      )}
      <div ref={trackRef} style={{ position: 'relative' }}>
        <div className="pulse-gantt__ticks">
          {g.ticks.filter((t) => t.pct <= 93).map((t) => (
            <div key={t.label} className="pulse-gantt__tick" style={{ left: `${t.pct}%` }}><span>{t.label}</span></div>
          ))}
        </div>
        {today !== null && <span className="pulse-gantt__line" style={{ left: `${today}%` }} />}
        <div className="pulse-gantt__lanes">
          {g.lanes.map((lane, l) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={l} className="pulse-gantt__lane" style={{ gridTemplateColumns: `repeat(${g.days}, minmax(0, 1fr))` }}>
              {lane.map((b) => {
                const st = stateOf(b);
                const show = width > 0 && full(b);
                return (
                  <div
                    key={b.i}
                    className="pulse-gantt__bar"
                    data-state={st}
                    data-full={show ? 'true' : undefined}
                    style={{ gridColumn: `${b.col} / span ${b.span}` }}
                    title={`${barLabel(b, phased)}${phased && b.name ? ` · ${b.name}` : ''} · ${barDates(b.start, b.end, phased)}`}
                  >
                    {show ? (
                      <>
                        <span className="pulse-gantt__name">{barLabel(b, phased)}</span>
                        <span className="pulse-gantt__dates">{barDates(b.start, b.end, phased)}</span>
                      </>
                    ) : <span className="pulse-gantt__badge" data-state={st}>{b.i + 1}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {progress && (
          <div className="pulse-gantt__progress">
            <div className="pulse-gantt__progress-fill" style={{ width: `${g.progressPct}%` }} />
            {today !== null && <span className="pulse-gantt__knob" style={{ left: `${today}%` }} />}
          </div>
        )}
      </div>
      <div className="pulse-gantt__keys" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(5, bars.length))}, minmax(0, 1fr))` }}>
        {bars.map((b) => {
          const st = stateOf(b);
          const name = phased ? b.name || `Phase ${b.i + 1}` : b.goal || 'Goal not set yet';
          return (
            <div key={b.i} className="pulse-gantt__key" data-state={st}>
              <span className="pulse-gantt__key-head">
                <span>{phased ? `Phase ${b.i + 1}` : `Sprint ${b.i + 1}`}</span>
                <span className="pulse-gantt__key-state">{keyState(b, st, phased)}</span>
              </span>
              <span className="pulse-gantt__key-name" data-kind={!phased && !b.goal ? 'unset' : !phased && b.tentative ? 'tentative' : undefined}>{name}</span>
              <span className="pulse-gantt__key-dates">{barDates(b.start, b.end, phased)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Gantt;
