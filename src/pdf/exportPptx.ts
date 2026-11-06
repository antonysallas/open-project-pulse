// Loaded on demand: the report pages (drawn at 16:9, ReportPdf `wide`) as a
// PowerPoint file. Each box, line, image and run of text the browser laid out
// becomes a native shape or text box at the same place, so the slides match the
// PDF and stay editable.
import PptxGenJS from 'pptxgenjs';
import { fitPage } from './fit';

type Slide = ReturnType<PptxGenJS['addSlide']>;
// A run of text and, for fitting, the CSS font the browser drew it in.
type TextRun = { text: string; options: Record<string, unknown>; font: string; spacing: number };

const PX = 1 / 96; // inches per CSS px
const PT = 0.75; // points per CSS px

interface Colour {
  hex: string;
  transparency: number; // 0 opaque … 100 clear
}

function colour(css: string): Colour | null {
  const m = css.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)/);
  if (!m) return null;
  let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  if (Number.isNaN(a)) a = 1;
  if (a <= 0.02) return null;
  const hex = [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return { hex, transparency: Math.round((1 - a) * 100) };
}

const fill = (c: Colour): Record<string, unknown> => ({ color: c.hex, transparency: c.transparency });

async function imagesLoaded(root: HTMLElement): Promise<void> {
  await Promise.all(Array.from(root.querySelectorAll('img')).map((img) => (img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  }))));
}

// An <img> (SVG logos included) as a PNG at 4× its size on the page.
function pngOf(img: HTMLImageElement, w: number, h: number): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * 4));
    canvas.height = Math.max(1, Math.round(h * 4));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

const isInline = (el: Element): boolean => getComputedStyle(el).display === 'inline';

// The text runs of a block: its own text and that of inline children
// (bold and italic spans), with <br> as a line break.
function runsOf(block: Element): TextRun[] {
  const runs: TextRun[] = [];
  const walk = (node: Node, style: CSSStyleDeclaration): void => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        let text = (child.textContent || '').replace(/\s+/g, ' ');
        if (!text.trim() && (!runs.length || /\s$/.test(runs[runs.length - 1].text))) return;
        if (style.textTransform === 'uppercase') text = text.toUpperCase();
        const c = colour(style.color);
        const spacing = parseFloat(style.letterSpacing) || 0; // px; 'normal' is 0
        runs.push({
          text,
          options: {
            fontFace: style.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
            fontSize: Math.round(parseFloat(style.fontSize) * PT * 100) / 100,
            bold: Number(style.fontWeight) >= 600,
            italic: style.fontStyle === 'italic',
            color: c ? c.hex : '241E1A',
            ...(spacing ? { charSpacing: Math.round(spacing * PT * 100) / 100 } : {}),
          },
          font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
          spacing,
        });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        if (el.tagName === 'BR') {
          if (runs.length) runs[runs.length - 1].options.breakLine = true;
        } else if (isInline(el)) {
          walk(el, getComputedStyle(el));
        }
      }
    });
  };
  walk(block, getComputedStyle(block));
  // Trim the ends.
  while (runs.length && !runs[0].text.trim()) runs.shift();
  while (runs.length && !runs[runs.length - 1].text.trim()) runs.pop();
  if (runs.length) {
    runs[0].text = runs[0].text.replace(/^\s+/, '');
    runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
  }
  return runs;
}

let canvas: HTMLCanvasElement | null = null;
const measure = (text: string, font: string): number => {
  canvas = canvas || document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
};

// Slides know regular and bold only, so semibold (600) text goes out bold,
// which is wider. Scale each block's runs so the line keeps the width the
// browser gave it (within 15%); it would otherwise run past its card.
function fitRuns(runs: TextRun[]): void {
  let drawn = 0;
  let exported = 0;
  runs.forEach((r) => {
    const o = r.options as { fontFace: string; fontSize: number; bold: boolean; italic: boolean };
    drawn += measure(r.text, r.font);
    exported += measure(r.text, `${o.italic ? 'italic ' : ''}${o.bold ? 700 : 400} ${o.fontSize / PT}px '${o.fontFace}'`);
  });
  if (!drawn || !exported || exported <= drawn * 1.002) return;
  const k = Math.max(0.85, drawn / exported);
  runs.forEach((r) => {
    const o = r.options as { fontSize: number };
    o.fontSize = Math.floor(o.fontSize * k * 100) / 100;
  });
}

// A block holds text when one of its own child nodes is text, or an inline
// element with text.
function hasOwnText(el: Element): boolean {
  return Array.from(el.childNodes).some((n) => (n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim())
    || (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName !== 'BR' && isInline(n as Element) && ((n as Element).textContent || '').trim()));
}

// A filled box in the corners of a rounded parent that clips it (a card's
// ink header, a date chip's label) takes those rounded corners, as the
// browser draws it. Returns the shape for two corners on one side; null when
// it touches fewer than two.
function cornersInRoundedParent(el: Element, r: DOMRect): { shape: string; box: { x: number; y: number; w: number; h: number }; rotate: number } | null {
  let parent = el.parentElement;
  while (parent && getComputedStyle(parent).overflow === 'visible') parent = parent.parentElement;
  if (!parent || parent.matches('[data-pdf-page]')) return null;
  const ps = getComputedStyle(parent);
  if (!(parseFloat(ps.borderTopLeftRadius) > 0)) return null;
  const pr = parent.getBoundingClientRect();
  const slack = (parseFloat(ps.borderTopWidth) || 0) + 1.5;
  const atTop = r.top - pr.top <= slack;
  const atBottom = pr.bottom - r.bottom <= slack;
  const atLeft = r.left - pr.left <= slack;
  const atRight = pr.right - r.right <= slack;
  const page = el.closest('[data-pdf-page]');
  const origin = page ? page.getBoundingClientRect() : { left: 0, top: 0 };
  const x = (r.left - origin.left) * PX;
  const y = (r.top - origin.top) * PX;
  const w = r.width * PX;
  const h = r.height * PX;
  // round2SameRect rounds its top two corners; turn it for another side. A
  // turned shape keeps its unturned box, centred where the visible one is.
  const turned = (deg: number): { shape: string; box: { x: number; y: number; w: number; h: number }; rotate: number } => (
    deg % 180 === 0
      ? { shape: 'round2SameRect', box: { x, y, w, h }, rotate: deg }
      : { shape: 'round2SameRect', box: { x: x + w / 2 - h / 2, y: y + h / 2 - w / 2, w: h, h: w }, rotate: deg });
  if (atTop && atLeft && atRight && !atBottom) return turned(0);
  if (atBottom && atLeft && atRight && !atTop) return turned(180);
  if (atLeft && atTop && atBottom && !atRight) return turned(270);
  if (atRight && atTop && atBottom && !atLeft) return turned(90);
  return null;
}

function addPage(pptx: PptxGenJS, slide: Slide, page: HTMLElement): void {
  const origin = page.getBoundingClientRect();
  const box = (r: { left: number; top: number; width: number; height: number }): { x: number; y: number; w: number; h: number } => ({
    x: (r.left - origin.left) * PX, y: (r.top - origin.top) * PX, w: r.width * PX, h: r.height * PX,
  });
  const S = pptx.ShapeType;

  const line = (x1: number, y1: number, x2: number, y2: number, c: Colour, widthPx: number, dash?: string): void => {
    slide.addShape(S.line, {
      x: Math.min(x1, x2) * PX, y: Math.min(y1, y2) * PX, w: Math.max(Math.abs(x2 - x1) * PX, 0.001), h: Math.max(Math.abs(y2 - y1) * PX, 0.001),
      flipV: (x2 - x1) * (y2 - y1) < 0,
      line: { color: c.hex, transparency: c.transparency, width: Math.max(0.25, widthPx * PT), ...(dash ? { dashType: dash } : {}) },
    } as never);
  };

  page.querySelectorAll<HTMLElement | SVGElement>('*').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    const left = r.left - origin.left;
    const top = r.top - origin.top;

    // SVG lines (the status graph): segments of each polyline.
    if (el.tagName.toLowerCase() === 'svg') {
      const vb = (el as SVGSVGElement).viewBox.baseVal;
      el.querySelectorAll('polyline').forEach((pl) => {
        const c = colour(getComputedStyle(pl).stroke) || { hex: '4D4641', transparency: 0 };
        const pts = (pl.getAttribute('points') || '').trim().split(/\s+/).map((pair) => pair.split(',').map(Number));
        const sx = vb && vb.width ? r.width / vb.width : 1;
        const sy = vb && vb.height ? r.height / vb.height : 1;
        for (let i = 1; i < pts.length; i++) {
          line(left + pts[i - 1][0] * sx, top + pts[i - 1][1] * sy, left + pts[i][0] * sx, top + pts[i][1] * sy, c, 1.5);
        }
      });
      return;
    }
    if (el instanceof SVGElement) return;

    // CSS triangles (status marker, date marker): a zero-size box with a
    // coloured top border.
    const bt = parseFloat(cs.borderTopWidth);
    const bl = parseFloat(cs.borderLeftWidth);
    const br = parseFloat(cs.borderRightWidth);
    if (r.width - bl - br < 0.5 && r.height - bt < 0.5 && bt > 0 && bl > 0) {
      const c = colour(cs.borderTopColor);
      if (c) slide.addShape(S.triangle, { x: left * PX, y: top * PX, w: (bl + br) * PX, h: bt * PX, flipV: true, fill: fill(c), line: { type: 'none' } } as never);
      return;
    }
    if (r.width < 0.5 && r.height < 0.5) return;

    // Box: background, rings drawn as box-shadow, borders.
    const radius = parseFloat(cs.borderTopLeftRadius) || 0;
    // A circle is an ellipse; a pill (fully rounded ends, e.g. a progress
    // bar) is a rounded rectangle, or PowerPoint draws it as a thin lens.
    const shapeFor = (rad: number, w: number, h: number): Record<string, unknown> => {
      if (rad > 0 && rad >= Math.min(w, h) / 2 - 0.5 && Math.abs(w - h) < 1) return { shape: S.ellipse };
      return rad > 0 ? { shape: S.roundRect, rectRadius: Math.min(rad, Math.min(w, h) / 2) * PX } : { shape: S.rect };
    };
    const shadows = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow.split(/,(?![^(]*\))/) : [];
    [...shadows].reverse().forEach((sh) => {
      if (/inset/.test(sh)) return;
      const c = colour(sh);
      const nums = (sh.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
      const spread = nums[3] || 0;
      if (!c || !spread || nums[0] || nums[1]) return;
      const sp = shapeFor(radius + spread, r.width + spread * 2, r.height + spread * 2);
      slide.addShape(sp.shape as never, {
        x: (left - spread) * PX, y: (top - spread) * PX, w: (r.width + spread * 2) * PX, h: (r.height + spread * 2) * PX, fill: fill(c), line: { type: 'none' },
        ...(sp.rectRadius ? { rectRadius: sp.rectRadius } : {}),
      } as never);
    });
    const bg = colour(cs.backgroundColor);
    const widths = [bt, br, parseFloat(cs.borderBottomWidth), bl];
    const colours = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor].map(colour);
    const styles = [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle];
    const allSides = widths.every((w) => w > 0 && Math.abs(w - widths[0]) < 0.1) && colours.every((c) => c && colours[0] && c.hex === colours[0].hex) && styles.every((s) => s === 'solid');
    if (allSides || (bg && !radius)) {
      // PowerPoint centres a line on the shape's edge; CSS draws a border
      // inside the box. Inset by half the border so it sits where CSS has it
      // and touches what is inside (no hairline gap).
      const inset = allSides ? widths[0] / 2 : 0;
      const sp = shapeFor(Math.max(0, radius - inset), r.width - inset * 2, r.height - inset * 2);
      const clipped = !allSides && bg ? cornersInRoundedParent(el, r) : null;
      slide.addShape((clipped ? clipped.shape : sp.shape) as never, {
        ...(clipped ? clipped.box : { x: (left + inset) * PX, y: (top + inset) * PX, w: (r.width - inset * 2) * PX, h: (r.height - inset * 2) * PX }),
        fill: bg ? fill(bg) : { type: 'none' },
        line: allSides && colours[0] ? { color: colours[0].hex, transparency: colours[0].transparency, width: widths[0] * PT } : { type: 'none' },
        ...(!clipped && sp.rectRadius ? { rectRadius: sp.rectRadius } : {}),
        ...(clipped && clipped.rotate ? { rotate: clipped.rotate } : {}),
      } as never);
    } else if (bg) {
      const sp = shapeFor(radius, r.width, r.height);
      slide.addShape(sp.shape as never, { ...box(r), fill: fill(bg), line: { type: 'none' }, ...(sp.rectRadius ? { rectRadius: sp.rectRadius } : {}) } as never);
    }
    if (!allSides) {
      // Each border on its own, drawn along the middle of the border's width.
      const h2 = (i: number): number => widths[i] / 2;
      const sides: [number, number, number, number][] = [
        [left, top + h2(0), left + r.width, top + h2(0)], [left + r.width - h2(1), top, left + r.width - h2(1), top + r.height],
        [left, top + r.height - h2(2), left + r.width, top + r.height - h2(2)], [left + h2(3), top, left + h2(3), top + r.height],
      ];
      sides.forEach((sd, i) => {
        const c = colours[i];
        if (widths[i] > 0 && c && styles[i] !== 'none') line(sd[0], sd[1], sd[2], sd[3], c, widths[i], styles[i] === 'dotted' ? 'sysDot' : styles[i] === 'dashed' ? 'dash' : undefined);
      });
    }

    // Images: the logos.
    if (el instanceof HTMLImageElement) {
      const data = pngOf(el, r.width, r.height);
      if (data) slide.addImage({ data, ...box(r) });
      return;
    }

    // Text.
    if (cs.display === 'inline' || !hasOwnText(el)) return;
    const runs = runsOf(el);
    if (!runs.length) return;
    fitRuns(runs);
    // Where the text itself is: the boxes of its text nodes, not of empty
    // siblings such as a colour swatch.
    const rects: DOMRect[] = [];
    const range = document.createRange();
    const collect = (node: Node): void => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE && (child.textContent || '').trim()) {
          range.selectNodeContents(child);
          rects.push(...Array.from(range.getClientRects()).filter((x) => x.width > 0 && x.height > 0));
        } else if (child.nodeType === Node.ELEMENT_NODE && isInline(child as Element)) {
          collect(child);
        }
      });
    };
    collect(el);
    if (!rects.length) return;
    const t = {
      left: Math.min(...rects.map((x) => x.left)), top: Math.min(...rects.map((x) => x.top)),
      right: Math.max(...rects.map((x) => x.right)), bottom: Math.max(...rects.map((x) => x.bottom)),
      width: 0, height: 0,
    };
    t.width = t.right - t.left;
    t.height = t.bottom - t.top;
    const single = rects.every((x) => Math.abs(x.top - rects[0].top) < 3);
    const lineHeight = parseFloat(cs.lineHeight);
    const align = cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' || cs.textAlign === 'end' ? 'right' : 'left';
    // A little slack: the viewer's font metrics may differ from the browser's.
    let x = t.left - origin.left;
    let w = t.width;
    if (single) {
      const slack = Math.max(4, t.width * 0.06);
      if (align === 'center') x -= slack / 2;
      else if (align === 'right') x -= slack;
      w += slack;
    } else {
      const padL = parseFloat(cs.paddingLeft) + bl;
      const padR = parseFloat(cs.paddingRight) + br;
      x = left + padL;
      w = r.width - padL - padR + Math.max(2, r.width * 0.02);
    }
    // One line: centred on the line, whatever the viewer's font metrics.
    // Several: top-aligned at the browser's line height.
    slide.addText(runs.map(({ text, options }) => ({ text, options })) as never, {
      x: x * PX, y: (t.top - origin.top) * PX, w: w * PX, h: t.height * PX,
      margin: 0, valign: single ? 'middle' : 'top', align, wrap: !single, fit: 'none',
      ...(!single && Number.isFinite(lineHeight) ? { lineSpacing: Math.round(lineHeight * PT * 10) / 10 } : {}),
    } as never);
  });
}

// Each [data-pdf-page] in `stage` becomes one 16:9 slide.
export async function exportPptx(stage: HTMLElement, title: string): Promise<Blob> {
  await document.fonts.ready;
  await imagesLoaded(stage);
  const pages = Array.from(stage.querySelectorAll<HTMLElement>('[data-pdf-page]'));
  if (!pages.length) throw new Error("Couldn't draw the report. Try again.");
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = title;
  pptx.company = '';
  for (let i = 0; i < pages.length; i++) {
    fitPage(pages[i]);
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    addPage(pptx, slide, pages[i]);
  }
  return (await pptx.write({ outputType: 'blob' })) as Blob;
}
