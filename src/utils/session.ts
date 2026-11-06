import { useCallback, useEffect, useRef, useState } from 'react';
import { onSignedOut, pingSession, SessionInfo } from './api';

// Sign-in is optional and off by default (docs/sign-in.md). With it on, the
// server says so through /api/session, and the sign-in ends after that many idle
// minutes without a key press, click, scroll or mouse move in any Pulse tab, or
// when a call finds it lapsed (the sign-in proxy answers 401). Either way the app
// signs out of the proxy and shows "Your session has ended"; forms are kept as
// drafts (utils/drafts.ts). While someone is active, a call every few minutes
// keeps the sign-in from lapsing first. With it off, none of this applies.
const DEFAULT_SIGN_IN = '/oauth2/start';
const DEFAULT_SIGN_OUT = '/oauth2/sign_out';
const PING = 4 * 60000;
const TICK = 15000;
const ACTIVITY_KEY = 'pulse-activity'; // the latest activity in any tab
const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];

export type SessionEnd = 'idle' | 'expired';

export interface SessionState {
  ended: SessionEnd | null;
  warning: boolean; // signed out in a minute unless there is activity
  idleMinutes: number | null; // null: no idle limit
  signInHref: string; // sign in again and come back to the same screen
}

function sharedActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function useSession(): SessionState {
  const [ended, setEnded] = useState<SessionEnd | null>(null);
  const [warning, setWarning] = useState(false);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const endedRef = useRef(false);
  const infoRef = useRef<SessionInfo | null>(null);
  infoRef.current = info;

  const end = useCallback((why: SessionEnd): void => {
    if (endedRef.current) return;
    endedRef.current = true;
    setWarning(false);
    setEnded(why);
    const out = (infoRef.current && infoRef.current.signOutUrl) || DEFAULT_SIGN_OUT;
    fetch(out, { redirect: 'manual', credentials: 'same-origin' }).catch(() => undefined);
  }, []);

  useEffect(() => onSignedOut((value) => value && end('expired')), [end]);

  useEffect(() => {
    let live = true;
    pingSession().then((next) => live && setInfo(next)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const idleMinutes = info && info.auth && info.user ? info.idleMinutes || 25 : null;

  // Only a signed-in session has an idle limit.
  useEffect(() => {
    if (!idleMinutes) return undefined;
    const IDLE = idleMinutes * 60000;
    const WARN = IDLE - 60000;
    let last = Date.now();
    let lastShared = 0;
    let lastPing = last;
    let warned = false;

    const idleFor = (now: number): number => now - Math.max(last, sharedActivity());

    const active = (): void => {
      if (endedRef.current) return;
      const now = Date.now();
      // Back after a long break (a sleeping laptop): the first move must not count.
      if (idleFor(now) >= IDLE) {
        end('idle');
        return;
      }
      last = now;
      if (warned) {
        warned = false;
        setWarning(false);
      }
      if (now - lastShared > TICK) {
        lastShared = now;
        try {
          localStorage.setItem(ACTIVITY_KEY, String(now));
        } catch {
          // this tab still counts its own activity
        }
      }
    };

    const tick = (): void => {
      if (endedRef.current) return;
      const now = Date.now();
      const idle = idleFor(now);
      if (idle >= IDLE) {
        end('idle');
      } else if (idle >= WARN) {
        if (!warned) {
          warned = true;
          setWarning(true);
        }
      } else if (idle < PING && now - lastPing >= PING) {
        lastPing = now;
        pingSession().catch(() => undefined);
      }
    };

    EVENTS.forEach((e) => window.addEventListener(e, active, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', tick);
    const timer = window.setInterval(tick, TICK);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, active, { capture: true }));
      document.removeEventListener('visibilitychange', tick);
      window.clearInterval(timer);
    };
  }, [idleMinutes, end]);

  const signIn = (info && info.signInUrl) || DEFAULT_SIGN_IN;
  return { ended, warning, idleMinutes, signInHref: `${signIn}?rd=${encodeURIComponent(`/${window.location.hash}`)}` };
}
