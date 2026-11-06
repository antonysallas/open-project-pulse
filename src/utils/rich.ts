// Report items, the status reason and project objectives are rich text: a
// small HTML subset (bold, italic, lists, line breaks) kept as a string. Every
// string is cleaned with richHtml() before it is stored or shown, so only
// these tags, with no attributes, ever reach the page or the PDF.

const KEEP: Record<string, string> = { STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', UL: 'ul', OL: 'ol', LI: 'li', BR: 'br', DIV: 'div', P: 'div' };
const DROP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'NOSCRIPT']);

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function clean(node: Node): string {
  let out = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += escapeHtml(child.textContent || '');
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const name = (child as Element).tagName.toUpperCase();
    if (DROP.has(name)) return;
    const tag = KEEP[name];
    if (tag === 'br') out += '<br>';
    else if (tag) out += `<${tag}>${clean(child)}</${tag}>`;
    else out += clean(child); // any other element: keep its text, lose the tag
  });
  return out;
}

// "Lead: the rest" with the lead in bold, as plain-text items are shown.
// `sep` is ': ' for report items and ' — ' for objectives.
export function leadHtml(s: string, sep = ': '): string {
  const i = s.indexOf(sep);
  if (i <= 1 || i >= 70) return escapeHtml(s);
  const colon = sep.trim() === ':';
  return `<strong>${escapeHtml(s.slice(0, i))}${colon ? ':' : ''}</strong>${colon ? ' ' : ' — '}${escapeHtml(s.slice(i + sep.length))}`;
}

const looksLikeHtml = (s: string): boolean => /<\/?[a-z][^>]*>|&[a-z#0-9]+;/i.test(s);

// Any stored text as safe rich HTML: HTML is cleaned, plain text is escaped
// (with its lead in bold).
export function richHtml(s: unknown, sep = ': '): string {
  if (typeof s !== 'string' || !s.trim()) return '';
  if (!looksLikeHtml(s)) return leadHtml(s.trim(), sep);
  const doc = new DOMParser().parseFromString(`<body>${s}</body>`, 'text/html');
  return tidy(clean(doc.body));
}

// Trailing breaks and empty blocks an editor leaves behind.
const tidy = (html: string): string =>
  html.replace(/(<div>(<br>)?<\/div>|<br>)+$/g, '').replace(/^(<div>(<br>)?<\/div>|<br>)+/g, '').trim();

// The words only: for counting non-empty items and for titles.
export function richPlain(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html.replace(/<(br|\/div|\/li)>/g, ' $&')}</body>`, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export const isRichEmpty = (html: string): boolean => !richPlain(html);
