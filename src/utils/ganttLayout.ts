import { BlockState, Gantt } from './project';

// Where each bar of a timeline goes, in pixels, and where its label goes.
// Bars keep the rows gantt() gave them (overlapping periods on separate rows).
// A name that fits sits inside its bar. One that doesn't goes beside the bar,
// in the free space on its row; when its row has no room, the bar and its
// label move to a row that has, or to a new one. Shared by the timeline on
// screen (components/Gantt.tsx) and on the PDF (pdf/ReportPdf.tsx).

export interface LayoutStyle {
  nameFont: string; // CSS font of a bar's name, for measuring
  dateFont: string;
  nameLine: number; // px per line of name
  dateLine: number;
  padX: number; // inside a bar, right padding
  badge: number; // inside a bar, left padding (room for the number badge)
  padY: number; // inside a bar, top + bottom padding
  minLane: number; // lowest row height
  maxLabel: number; // widest label beside a bar
  gap: number; // between a bar and its label, and between neighbours
  maxLines?: number; // most lines of name inside a bar (3)
}

export interface PlacedBar {
  i: number;
  name: string;
  dates: string;
  state: BlockState;
  left: number; // px from the track's left
  width: number;
  inside: boolean;
  side: 'right' | 'left'; // where an outside label goes
  labelWidth: number; // outside label's box width
  lines: number; // lines of name
  dateLines: number; // 1, or 2 when the dates wrap at the dash
}

export interface PlacedLane {
  bars: PlacedBar[];
  height: number;
}

export type Measure = (text: string, font: string) => number;

let canvas: HTMLCanvasElement | null = null;

// Text width in the real font; a rough estimate where there is no canvas
// (tests).
export const measureText: Measure = (text, font) => {
  try {
    canvas = canvas || document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = font;
      return ctx.measureText(text).width;
    }
  } catch {
    // fall through
  }
  const px = parseFloat((font.match(/([\d.]+)px/) || [])[1] || '12');
  return text.length * px * 0.55;
};

// Lines a text takes at a width, wrapping between words as the browser does
// (erring towards one more line: a row a little too tall beats a clipped
// label); null when a single word is wider than the line.
function wrapLines(text: string, width: number, font: string, measure: Measure): number | null {
  const words = text.split(/\s+/).filter(Boolean);
  const space = measure(' ', font);
  let lines = 1;
  let used = 0;
  for (const w of words) {
    const ww = measure(w, font);
    if (ww > width - 0.5) return null;
    if (used && used + space + ww > width - 0.5) {
      lines += 1;
      used = ww;
    } else used += (used ? space : 0) + ww;
  }
  return lines;
}

// Dates ("1 Mar – 12 Mar") on one line, or two (broken at the dash).
function dateLines(dates: string, width: number, font: string, measure: Measure): number | null {
  if (measure(dates, font) <= width - 0.5) return 1;
  const parts = dates.split(' – ');
  return parts.every((p) => measure(`${p} –`, font) <= width - 0.5) ? 2 : null;
}

interface Span {
  from: number;
  to: number;
}

const clear = (spans: Span[], s: Span, gap: number): boolean => spans.every((o) => s.to + gap <= o.from + 1 || s.from + 1 >= o.to + gap);

export function layoutGantt(
  g: Gantt,
  trackWidth: number,
  style: LayoutStyle,
  label: (i: number) => { name: string; dates: string },
  stateOf: (i: number, byDate: BlockState) => BlockState,
  phased: boolean,
  measure: Measure = measureText,
): PlacedLane[] {
  const px = trackWidth / g.days;
  // Rows as gantt() made them; each row's taken spans start as its bars.
  const rows: { spans: Span[]; bars: PlacedBar[] }[] = g.lanes.map(() => ({ spans: [], bars: [] }));
  const outside: { bar: PlacedBar; row: number; nameW: number; datesW: number }[] = [];

  g.lanes.forEach((lane, r) => lane.forEach((b) => {
    const { name, dates } = label(b.i);
    const left = (b.col - 1) * px;
    const width = b.span * px;
    const room = width - (phased ? style.badge : style.padX) - style.padX;
    const lines = room >= 56 ? wrapLines(name, room, style.nameFont, measure) : null;
    const dl = room >= 56 ? dateLines(dates, room, style.dateFont, measure) : null;
    const bar: PlacedBar = {
      i: b.i, name, dates, state: stateOf(b.i, b.state), left, width, inside: lines !== null && lines <= (style.maxLines || 3) && dl !== null,
      side: 'right', labelWidth: 0, lines: lines || 1, dateLines: dl || 1,
    };
    rows[r].spans.push({ from: left, to: left + width });
    if (bar.inside) rows[r].bars.push(bar);
    else outside.push({ bar, row: r, nameW: measure(name, style.nameFont), datesW: measure(dates, style.dateFont) });
  }));

  // Labels beside bars, in date order.
  outside.sort((a, b) => a.bar.left - b.bar.left).forEach(({ bar, row, nameW, datesW }) => {
    const want = Math.min(style.maxLabel, Math.max(nameW, datesW) + 2);
    const self: Span = { from: bar.left, to: bar.left + bar.width };
    const fit = (spans: Span[]): { side: 'right' | 'left'; w: number } | null => {
      for (const side of ['right', 'left'] as const) {
        // The free space next to the bar on this row, up to `want`.
        const others = spans.filter((s) => s.from !== self.from || s.to !== self.to);
        // Neighbours by position, with a little slack: bar edges are sums of
        // fractional pixels, and the next phase can start a hair "before" this one ends.
        const edge = side === 'right'
          ? Math.min(trackWidth, ...others.filter((s) => s.from >= self.to - 1).map((s) => s.from - style.gap))
          : Math.max(0, ...others.filter((s) => s.to <= self.from + 1).map((s) => s.to + style.gap));
        const free = side === 'right' ? edge - self.to - style.gap : self.from - style.gap - edge;
        const w = Math.min(want, free);
        if (w >= Math.min(want, 90) && w >= 60) return { side, w };
      }
      return null;
    };
    const put = (r: number, f: { side: 'right' | 'left'; w: number }): void => {
      const lines = wrapLines(bar.name, f.w, style.nameFont, measure) || Math.ceil(nameW / f.w);
      const dl = dateLines(bar.dates, f.w, style.dateFont, measure) || 2;
      rows[r].bars.push({ ...bar, side: f.side, labelWidth: f.w, lines, dateLines: dl });
      rows[r].spans.push(f.side === 'right' ? { from: self.to, to: self.to + style.gap + f.w } : { from: self.from - style.gap - f.w, to: self.from });
    };
    const here = fit(rows[row].spans);
    if (here) {
      put(row, here);
      return;
    }
    // No room on its own row: take the bar to a row where it and its label fit.
    rows[row].spans = rows[row].spans.filter((s) => s.from !== self.from || s.to !== self.to);
    for (let r = 0; r < rows.length; r++) {
      if (r !== row && clear(rows[r].spans, self, style.gap)) {
        const f = fit([...rows[r].spans, self]);
        if (f) {
          rows[r].spans.push(self);
          put(r, f);
          return;
        }
      }
    }
    rows.push({ spans: [self], bars: [] });
    const r = rows.length - 1;
    const right = trackWidth - self.to - style.gap;
    const leftRoom = self.from - style.gap;
    put(r, fit(rows[r].spans) || (right >= leftRoom ? { side: 'right', w: Math.max(60, right) } : { side: 'left', w: Math.max(60, leftRoom) }));
  });

  return rows
    .filter((r) => r.bars.length)
    .map((r) => ({
      bars: r.bars.sort((a, b) => a.left - b.left),
      height: Math.max(style.minLane, ...r.bars.map((b) => style.padY + b.lines * style.nameLine + b.dateLines * style.dateLine)),
    }));
}
