import React from 'react';
import { SessionEnd } from '../utils/session';

interface SessionEndedProps {
  reason: SessionEnd;
  idleMinutes: number | null;
  signInHref: string;
}

// Covers the app once the sign-in has ended. The screen underneath stays as it
// was; its form is kept as a draft and comes back after signing in.
const SessionEnded: React.FC<SessionEndedProps> = ({ reason, idleMinutes, signInHref }): JSX.Element => (
  <div className="pulse-ended" role="dialog" aria-modal="true" aria-labelledby="pulse-ended-title">
    <div className="s-card pulse-ended__card">
      <div className="pulse-ended__brand">Pulse</div>
      <h1 id="pulse-ended-title" className="pulse-h1" style={{ margin: 0 }}>Your session has ended</h1>
      <p style={{ margin: 0 }}>
        {reason === 'idle' && idleMinutes
          ? `You were signed out after ${idleMinutes} minutes without activity.`
          : 'Your sign-in expired.'}
        {' '}
        Anything you were typing is saved as a draft.
      </p>
      <a className="s-btn s-btn--primary" href={signInHref} style={{ alignSelf: 'flex-start' }}>Sign in again</a>
      <span className="s-help">You'll come back to this page with your draft.</span>
    </div>
  </div>
);

export default SessionEnded;
