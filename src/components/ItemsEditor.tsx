import React, { useEffect, useRef } from 'react';
import { EditItem, ItemType } from '../types/ReportTypes';
import { ACTION_ORDER, newItem, TYPES } from '../utils/report';
import { isRichEmpty } from '../utils/rich';
import Icon from './Icon';
import RichEditor, { RichTools } from './RichEditor';
import { InkCard, TypeTag } from './ui';

// Puts the cursor in the item just added, once it is drawn.
function useFocusNew(): React.MutableRefObject<string | null> {
  const pending = useRef<string | null>(null);
  useEffect(() => {
    if (!pending.current) return;
    const el = document.querySelector<HTMLElement>(`[data-focus="${pending.current}"]`);
    pending.current = null;
    if (el) el.focus();
  });
  return pending;
}

const countLabel = (items: EditItem[]): string => {
  const n = items.filter((x) => !isRichEmpty(x.text)).length;
  return `${n} item${n === 1 ? '' : 's'}`;
};

interface ListProps {
  title: string;
  items: EditItem[];
  onChange: (items: EditItem[]) => void;
  placeholder: string;
}

// A numbered list of rich-text items (Accomplishments, Ongoing and
// Outstanding Tasks, Project Objectives).
export const ItemList: React.FC<ListProps & { addLabel?: string; note?: string; noList?: boolean; tall?: boolean }> = ({
  title, items, onChange, placeholder, addLabel = 'Add item', note, noList, tall,
}): JSX.Element => {
  const focusNew = useFocusNew();
  const addAfter = (key: string | null): void => {
    const next = newItem();
    focusNew.current = next.key;
    const ix = key ? items.findIndex((x) => x.key === key) : items.length - 1;
    onChange([...items.slice(0, ix + 1), next, ...items.slice(ix + 1)]);
  };
  return (
    <InkCard
      title={title}
      className={tall ? 'pulse-items--tall' : undefined}
      meta={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <RichTools list={!noList} />
          {!note && <span className="pulse-ink__meta" style={{ marginLeft: 8, marginRight: 6 }}>{countLabel(items)}</span>}
        </div>
      )}
    >
      <div className="pulse-items">
        {note && <span className="pulse-help" style={{ padding: '0 4px 4px 28px' }}>{note}</span>}
        {items.map((it, n) => (
          <div key={it.key} className="pulse-item">
            <span className="pulse-item__n">{`${n + 1}.`}</span>
            <RichEditor
              html={it.text}
              label={placeholder}
              placeholder={placeholder}
              focusKey={it.key}
              onChange={(text) => onChange(items.map((x) => (x.key === it.key ? { ...x, text } : x)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  addAfter(it.key);
                }
              }}
            />
            <button type="button" className="s-btn s-btn--ghost s-btn--icon s-btn--sm pulse-item__x" aria-label="Remove item" onClick={() => onChange(items.filter((x) => x.key !== it.key))}>
              <Icon name="x" />
            </button>
          </div>
        ))}
        <div className="pulse-items__foot">
          <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={() => addAfter(null)}>
            <Icon name="plus" />
            {addLabel}
          </button>
          <span className="pulse-hint pulse-hide-sm">Ctrl/⌘ Enter adds the next item</span>
        </div>
      </div>
    </InkCard>
  );
};

// People and Process or Technology: items grouped by type, each with its
// type picker, and an add button per type.
export const TypedList: React.FC<ListProps> = ({ title, items, onChange, placeholder }): JSX.Element => {
  const focusNew = useFocusNew();
  const add = (type: ItemType, after: string | null = null): void => {
    const next = newItem('', type);
    focusNew.current = next.key;
    if (!after) {
      onChange([...items, next]);
      return;
    }
    const ix = items.findIndex((x) => x.key === after);
    onChange([...items.slice(0, ix + 1), next, ...items.slice(ix + 1)]);
  };
  const groups = ACTION_ORDER.map((type) => ({ type, items: items.filter((x) => x.type === type) })).filter((g) => g.items.length);
  return (
    <InkCard title={title} meta={<RichTools />}>
      <div className="pulse-items" style={{ flex: 1, gap: 14 }}>
        {!groups.length && <span className="pulse-sub" style={{ fontSize: 13.5, padding: '0 4px' }}>Nothing to report this week. Add an item below.</span>}
        {groups.map((g) => (
          <div key={g.type} className="pulse-group" style={{ gap: 8 }}>
            <TypeTag type={g.type} />
            {g.items.map((it, n) => (
              <div key={it.key} className="pulse-item pulse-item--typed">
                <span className="pulse-item__n">{`${n + 1}.`}</span>
                <RichEditor
                  html={it.text}
                  label={placeholder}
                  placeholder={placeholder}
                  focusKey={it.key}
                  onChange={(text) => onChange(items.map((x) => (x.key === it.key ? { ...x, text } : x)))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      add(it.type, it.key);
                    }
                  }}
                />
                <select
                  className="pulse-item__type"
                  aria-label="Item type"
                  value={it.type}
                  onChange={(e) => onChange(items.map((x) => (x.key === it.key ? { ...x, type: e.target.value as ItemType } : x)))}
                >
                  {ACTION_ORDER.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="button" className="s-btn s-btn--ghost s-btn--icon s-btn--sm pulse-item__x" aria-label="Remove item" onClick={() => onChange(items.filter((x) => x.key !== it.key))}>
                  <Icon name="x" />
                </button>
              </div>
            ))}
          </div>
        ))}
        <div className="pulse-adds">
          <span>Add</span>
          {ACTION_ORDER.map((t) => (
            <button key={t} type="button" onClick={() => add(t)}>
              <span className="pulse-adds__dot" style={{ background: TYPES[t].bg, boxShadow: t === 'FYI' ? 'inset 0 0 0 1px var(--border-strong)' : undefined }} />
              {t}
            </button>
          ))}
        </div>
      </div>
    </InkCard>
  );
};
