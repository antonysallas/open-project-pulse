import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export type ExportFormat = 'pdf' | 'pptx';

interface ExportMenuProps {
  label: string; // "Export" or "Save and export"
  heading: string; // over the choices
  onPick: (format: ExportFormat) => void;
  disabled?: boolean;
  up?: boolean; // open above the button (at the foot of a page)
}

const ICON: Record<ExportFormat, [string, string, string]> = {
  pdf: ['PDF', 'var(--danger-soft)', 'var(--danger-text)'],
  pptx: ['PPT', 'var(--info-soft)', 'var(--info-text)'],
};

// The export button and its menu: PDF, PowerPoint.
const ExportMenu: React.FC<ExportMenuProps> = ({ label, heading, onPick, disabled, up }): JSX.Element => {
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

  const items: { format: ExportFormat; label: string; desc: string }[] = [
    { format: 'pdf', label: 'PDF', desc: 'A4 landscape · 2 pages' },
    { format: 'pptx', label: 'PowerPoint (.pptx)', desc: 'Editable slides · 16:9' },
  ];

  return (
    <div ref={ref} className="pulse-menu">
      <button type="button" className="s-btn s-btn--primary" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
        {label}
        <Icon name="chevron-down" />
      </button>
      {open && (
        <div role="menu" className={`pulse-menu__list${up ? ' pulse-menu__list--up' : ''}`}>
          <span className="pulse-menu__heading">{heading}</span>
          {items.map((it) => (
            <button
              key={it.format}
              type="button"
              role="menuitem"
              className="pulse-menu__item"
              onClick={() => {
                setOpen(false);
                onPick(it.format);
              }}
            >
              <span className="pulse-menu__icon" style={{ background: ICON[it.format][1], color: ICON[it.format][2] }}>{ICON[it.format][0]}</span>
              <span className="pulse-menu__text">
                <span className="pulse-menu__label">{it.label}</span>
                <span className="pulse-menu__desc">{it.desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
