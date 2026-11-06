import React, { useEffect, useRef } from 'react';
import { isRichEmpty, richHtml } from '../utils/rich';
import Icon from './Icon';

interface RichEditorProps {
  html: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label: string; // for screen readers
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  focusKey?: string; // data-focus, so a new item can be focused once drawn
  className?: string;
}

// A small rich-text box (bold, italic, bullet lists through RichTools). The
// box owns its text while it is edited: `html` is read when it is first drawn,
// so a parent that replaces the text gives the box a new React key. Pasted text
// keeps only what the report can show.
const RichEditor: React.FC<RichEditorProps> = ({ html, onChange, placeholder, label, onKeyDown, focusKey, className }): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);
  const empty = useRef(isRichEmpty(html));

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = richHtml(html);
    // Drawn once per key: see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = (): void => {
    const el = ref.current;
    if (!el) return;
    const isEmpty = isRichEmpty(el.innerHTML);
    if (isEmpty !== empty.current) {
      empty.current = isEmpty;
      el.dataset.empty = String(isEmpty);
    }
    onChange(isEmpty ? '' : el.innerHTML);
  };

  const paste = (e: React.ClipboardEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const clean = html ? richHtml(html) : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>');
    document.execCommand('insertHTML', false, clean);
  };

  return (
    <div
      ref={ref}
      className={`pulse-editable${className ? ` ${className}` : ''}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      data-placeholder={placeholder}
      data-empty={String(empty.current)}
      data-focus={focusKey}
      onInput={changed}
      onBlur={changed}
      onPaste={paste}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'b' || e.key === 'i')) {
          e.preventDefault();
          document.execCommand(e.key === 'b' ? 'bold' : 'italic');
          changed();
          return;
        }
        if (onKeyDown) onKeyDown(e);
      }}
    />
  );
};

// Bold, italic and bullet list for whichever rich box has the cursor.
export const RichTools: React.FC<{ list?: boolean }> = ({ list = true }): JSX.Element => {
  const run = (cmd: string) => (e: React.MouseEvent): void => {
    e.preventDefault(); // keep the cursor in the box
    const box = document.activeElement;
    if (!(box instanceof HTMLElement) || !box.isContentEditable) return;
    document.execCommand(cmd, false);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  };
  return (
    <div className="pulse-tools" role="toolbar" aria-label="Text format">
      <button type="button" aria-label="Bold" title="Bold (Ctrl+B)" onMouseDown={run('bold')}><Icon name="bold" /></button>
      <button type="button" aria-label="Italic" title="Italic (Ctrl+I)" onMouseDown={run('italic')}><Icon name="italic" /></button>
      {list && <button type="button" aria-label="Bulleted list" title="Bulleted list" onMouseDown={run('insertUnorderedList')}><Icon name="list" /></button>}
    </div>
  );
};

export default RichEditor;
