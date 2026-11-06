import { useEffect, useState } from 'react';

// Tells the server this form is open, every little while, and hears whether it
// is open anywhere else too. A failed call just
// means no alert, so nothing here gets in the way of the form.
const BEAT = 20000;

const call = (key: string, tab: string, leaving: boolean): Promise<{ others?: number } | null> =>
  fetch(`/api/editing/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab, leaving }),
    keepalive: leaving,
    redirect: 'manual',
  }).then((res) => (res.ok ? res.json() : null)).catch(() => null);

// True while the form with this key is open somewhere else. No key: not tracked.
export function useOtherEditors(key: string | null): boolean {
  const [others, setOthers] = useState(false);
  useEffect(() => {
    if (!key) return undefined;
    const tab = Math.random().toString(36).slice(2);
    let live = true;
    const beat = (): void => {
      call(key, tab, false).then((r) => {
        if (live && r) setOthers((r.others || 0) > 0);
      });
    };
    const leave = (): void => {
      call(key, tab, true);
    };
    const onShow = (): void => {
      if (document.visibilityState === 'visible') beat();
    };
    beat();
    const timer = window.setInterval(beat, BEAT);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pagehide', leave);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [key]);
  return others;
}
