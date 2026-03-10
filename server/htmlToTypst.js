// HTML-to-Typst content converter
// Converts HTML rich text (from react-quill) into Typst content blocks.

/**
 * Escape Typst special characters in plain text.
 * Characters #, @, $ must be backslash-escaped.
 */
function escapeTypst(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/#/g, '\\#')
    .replace(/@/g, '\\@')
    .replace(/\$/g, '\\$');
}

/**
 * Convert a single HTML string to a Typst content block string.
 *
 * Handles: <strong>, <em>, HTML entities, Typst special chars.
 * Returns a Typst content expression wrapped in [...].
 */
function htmlToTypstContent(html) {
  if (!html || typeof html !== 'string') return '[]';

  let result = html;

  // Strip <p> wrappers (we handle them in htmlToTypstContentArray)
  result = result.replace(/<\/?p>/gi, '');

  // Convert <br> to Typst line break
  result = result.replace(/<br\s*\/?>/gi, ' \\ ');

  // Use sentinel tokens for bold/italic to protect them from escaping
  const BOLD_OPEN = '\x01BOLD_OPEN\x01';
  const BOLD_CLOSE = '\x01BOLD_CLOSE\x01';
  const ITALIC_OPEN = '\x01ITALIC_OPEN\x01';
  const ITALIC_CLOSE = '\x01ITALIC_CLOSE\x01';

  // Convert <strong>/<b> to sentinels
  result = result.replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)>/gi, (_, inner) => {
    return `${BOLD_OPEN}${inner}${BOLD_CLOSE}`;
  });

  // Convert <em>/<i> to sentinels
  result = result.replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)>/gi, (_, inner) => {
    return `${ITALIC_OPEN}${inner}${ITALIC_CLOSE}`;
  });

  // Strip any remaining HTML tags
  result = result.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  result = result.replace(/&amp;/g, '&');
  result = result.replace(/&lt;/g, '<');
  result = result.replace(/&gt;/g, '>');
  result = result.replace(/&quot;/g, '"');
  result = result.replace(/&#39;/g, "'");
  result = result.replace(/&nbsp;/g, ' ');

  // Escape Typst special chars in the text portions (not sentinels)
  // Split by sentinels, escape only non-sentinel parts
  const parts = result.split(/(\x01[A-Z_]+\x01)/);
  result = parts
    .map((part) => {
      if (part.startsWith('\x01') && part.endsWith('\x01')) return part;
      return escapeTypst(part);
    })
    .join('');

  // Replace sentinels with Typst markers
  result = result.replace(/\x01BOLD_OPEN\x01/g, '*');
  result = result.replace(/\x01BOLD_CLOSE\x01/g, '*');
  result = result.replace(/\x01ITALIC_OPEN\x01/g, '_');
  result = result.replace(/\x01ITALIC_CLOSE\x01/g, '_');

  return `[${result.trim()}]`;
}

/**
 * Split HTML into <p>...</p> blocks and convert each to a Typst content string.
 * Returns an array of Typst content expressions.
 */
function htmlToTypstContentArray(html) {
  if (!html || typeof html !== 'string') return [];

  // Split on paragraph boundaries
  const paragraphs = html
    .split(/<\/p>\s*<p>/i)
    .map((p) => p.replace(/^<p>/i, '').replace(/<\/p>$/i, ''))
    .filter((p) => p.trim().length > 0);

  if (paragraphs.length === 0) {
    // No <p> tags — treat the whole thing as one block
    const content = htmlToTypstContent(html);
    return content === '[]' ? [] : [content];
  }

  return paragraphs.map((p) => htmlToTypstContent(`<p>${p}</p>`));
}

module.exports = { escapeTypst, htmlToTypstContent, htmlToTypstContentArray };
