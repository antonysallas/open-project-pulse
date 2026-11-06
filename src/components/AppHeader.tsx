import React from 'react';
import { href } from '../utils/route';

export interface Crumb {
  label: string;
  href?: string; // absent on the current page
}

interface AppHeaderProps {
  crumbs: Crumb[];
  children?: React.ReactNode; // actions, right-aligned
}

// The bar across the top: Pulse, where you are, and this screen's actions.
const AppHeader: React.FC<AppHeaderProps> = ({ crumbs, children }): JSX.Element => (
  <header className="pulse-bar">
    <a href={href.projects()} className="pulse-bar__brand" title="Home · all projects">Pulse</a>
    <span className="pulse-bar__sep" />
    <ol className="pulse-bar__crumbs">
      {crumbs.map((c, i) => (
        <li key={`${i}-${c.label}`}>
          {i > 0 && <span className="pulse-bar__slash">/</span>}
          {c.href && i < crumbs.length - 1 ? <a href={c.href}>{c.label}</a> : <span aria-current="page">{c.label}</span>}
        </li>
      ))}
    </ol>
    {children && <div className="pulse-bar__actions">{children}</div>}
  </header>
);

export default AppHeader;
