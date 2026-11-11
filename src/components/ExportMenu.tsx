import React, { useEffect, useRef, useState } from 'react';
import Icon, { IconName } from './Icon';

export type ExportFormat = 'pdf' | 'pptx';

export interface MenuChoice<K extends string> {
  key: K;
  label: string;
  desc: string;
  abbr: string; // in the square before the label
  tone: [string, string]; // its background and text colour
}

export const JSON_TONE: [string, string] = ['var(--surface-hover)', 'var(--text)'];

// PDF and PowerPoint, the choices a report has.
export const REPORT_FORMATS: MenuChoice<ExportFormat>[] = [
  { key: 'pdf', label: 'PDF', desc: 'A4 landscape · 2 pages', abbr: 'PDF', tone: ['var(--danger-soft)', 'var(--danger-text)'] },
  { key: 'pptx', label: 'PowerPoint (.pptx)', desc: 'Editable slides · 16:9', abbr: 'PPT', tone: ['var(--info-soft)', 'var(--info-text)'] },
];

interface ExportMenuProps<K extends string> {
  label: string; // "Export" or "Save and export"
  heading: string; // over the choices
  items: MenuChoice<K>[];
  onPick: (key: K) => void;
  footer?: string; // a line under the choices
  ghost?: boolean; // a quiet button instead of the primary one
  icon?: IconName; // before the label
  width?: number;
  disabled?: boolean;
  up?: boolean; // open above the button (at the foot of a page)
}

// An export button and its menu.
function ExportMenu<K extends string>({ label, heading, items, onPick, footer, ghost, icon, width, disabled, up }: ExportMenuProps<K>): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', key);
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div ref={ref} className="pulse-menu">
      <button type="button" className={`s-btn ${ghost ? 's-btn--ghost' : 's-btn--primary'}`} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
        {icon && <Icon name={icon} />}
        {label}
        <Icon name="chevron-down" />
      </button>
      {open && (
        <div role="menu" className={`pulse-menu__list${up ? ' pulse-menu__list--up' : ''}`} style={width ? { width } : undefined}>
          <span className="pulse-menu__heading">{heading}</span>
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              className="pulse-menu__item"
              onClick={() => {
                setOpen(false);
                onPick(it.key);
              }}
            >
              <span className="pulse-menu__icon" style={{ background: it.tone[0], color: it.tone[1], fontSize: it.abbr.length > 3 ? 9 : undefined }}>{it.abbr}</span>
              <span className="pulse-menu__text">
                <span className="pulse-menu__label">{it.label}</span>
                <span className="pulse-menu__desc">{it.desc}</span>
              </span>
            </button>
          ))}
          {footer && <span className="pulse-menu__foot">{footer}</span>}
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
