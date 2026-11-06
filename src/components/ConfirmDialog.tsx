import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, body, confirmLabel, cancelLabel = 'Cancel', busy = false, onConfirm, onCancel }): JSX.Element => {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={onCancel}
    >
      <div className="s-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" style={{ position: 'static', display: 'block' }} onClick={(e) => e.stopPropagation()}>
        <div className="s-dialog__body">
          <h2 id="confirm-title" className="s-dialog__title">{title}</h2>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{body}</span>
        </div>
        <div className="s-dialog__footer">
          <button type="button" className="s-btn s-btn--ghost" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" ref={confirmRef} className="s-btn s-btn--primary" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
