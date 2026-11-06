import { useCallback, useEffect, useRef, useState } from 'react';
import { dropDraft, fetchDraft, putDraft } from './api';

// While a form is edited its state is kept as a draft: in a file in the data
// folder (data/drafts/<key>.json, written a moment after typing stops) and in
// this browser (straight away, so it survives the server stopping). Opening the
// form again, after closing the tab or restarting Pulse, puts the newest copy back.

export interface Draft<T> {
  savedAt: number; // ms
  state: T;
}

export interface DraftControl<T> {
  restoredAt: number | null; // when the draft put back into the form was saved
  savedAt: number | null; // when the server copy was last written
  discard: (next: T) => void; // forget the draft; the screen puts `next` in the form
  clear: () => void; // the form was saved for real, or left
  changed: () => boolean; // the form differs from how it opened (a draft put back counts)
}

const LOCAL_DELAY = 400;
const SERVER_DELAY = 2000;
const localKey = (key: string): string => `pulse-draft:${key}`;
// A state as text, without the keys forms give their list rows.
const plain = (s: unknown): string => JSON.stringify(s, (k, v) => (k === 'key' ? undefined : v));

function readLocal<T>(key: string): Draft<T> | null {
  try {
    const d = JSON.parse(localStorage.getItem(localKey(key)) || 'null');
    return d && typeof d.savedAt === 'number' && d.state ? d : null;
  } catch {
    return null;
  }
}

function writeLocal<T>(key: string, d: Draft<T> | null): void {
  try {
    if (d) localStorage.setItem(localKey(key), JSON.stringify(d));
    else localStorage.removeItem(localKey(key));
  } catch {
    // storage full or blocked: the server copy still counts
  }
}

// "15:57" today, "Thu 15 May, 15:57" on another day.
export function savedTime(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

// `state` is null until the form has its starting state (a saved report still
// loading); the stored draft is looked up after that and handed to `restore`.
// Nothing is kept until the state differs from the one the form started with.
export function useDraft<T>(key: string, state: T | null, restore: (state: T) => void): DraftControl<T> {
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const baseline = useRef<string | null>(null);
  const opened = useRef<string | null>(null); // before any draft is put back
  const latest = useRef(state);
  latest.current = state;
  const dirty = useRef(false);
  const pending = useRef<Draft<T> | null>(null);
  const localTimer = useRef<number>();
  const serverTimer = useRef<number>();
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const looking = useRef(false);
  // Server writes go one at a time, so a late save can't bring back a dropped draft.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const queue = useCallback((write: () => Promise<unknown>): Promise<unknown> => {
    chain.current = chain.current.then(write).catch(() => undefined);
    return chain.current;
  }, []);

  const flushLocal = useCallback((): void => {
    window.clearTimeout(localTimer.current);
    if (pending.current) writeLocal(key, pending.current);
  }, [key]);

  const flushServer = useCallback((): void => {
    window.clearTimeout(serverTimer.current);
    const d = pending.current;
    if (!d) return;
    pending.current = null;
    queue(() => putDraft(key, d).then(() => setSavedAt(d.savedAt)));
  }, [key, queue]);

  useEffect(() => {
    if (state === null || looking.current) return;
    looking.current = true;
    opened.current = plain(state);
    const local = readLocal<T>(key);
    fetchDraft<Draft<T>>(key).catch(() => null).then((server) => {
      const valid = server && typeof server.savedAt === 'number' && server.state ? server : null;
      const newest = [valid, local].reduce<Draft<T> | null>((a, b) => (b && (!a || b.savedAt > a.savedAt) ? b : a), null);
      if (newest) {
        restoreRef.current(newest.state);
        setRestoredAt(newest.savedAt);
        // Only this browser had the latest: the server copy catches up.
        if (!valid || newest.savedAt > valid.savedAt) queue(() => putDraft(key, newest));
      }
      setReady(true);
    });
  }, [key, state, queue]);

  useEffect(() => {
    if (!ready || state === null) return;
    const json = JSON.stringify(state);
    if (baseline.current === null) {
      baseline.current = json; // as loaded, or as restored
      return;
    }
    if (!dirty.current && json === baseline.current) return;
    dirty.current = true;
    pending.current = { savedAt: Date.now(), state };
    window.clearTimeout(localTimer.current);
    localTimer.current = window.setTimeout(flushLocal, LOCAL_DELAY);
    window.clearTimeout(serverTimer.current);
    serverTimer.current = window.setTimeout(flushServer, SERVER_DELAY);
  }, [ready, state, flushLocal, flushServer]);

  // Leaving the screen or the page: keep what is still waiting.
  useEffect(() => {
    const onHide = (): void => flushLocal();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      flushLocal();
      flushServer();
    };
  }, [flushLocal, flushServer]);

  const forget = useCallback((): void => {
    window.clearTimeout(localTimer.current);
    window.clearTimeout(serverTimer.current);
    pending.current = null;
    dirty.current = false;
    writeLocal(key, null);
    queue(() => dropDraft(key));
    setRestoredAt(null);
    setSavedAt(null);
  }, [key, queue]);

  const discard = useCallback((next: T): void => {
    forget();
    baseline.current = JSON.stringify(next);
    opened.current = plain(next);
  }, [forget]);

  const changed = useCallback((): boolean => opened.current !== null && plain(latest.current) !== opened.current, []);

  return { restoredAt, savedAt, discard, clear: forget, changed };
}
