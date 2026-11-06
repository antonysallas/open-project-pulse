import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Project } from './types/ReportTypes';
import { ScreenProps, ToastTone } from './types/ScreenTypes';
import AppHeader from './components/AppHeader';
import SessionEnded from './components/SessionEnded';
import ProjectsScreen from './screens/ProjectsScreen';
import ProjectScreen from './screens/ProjectScreen';
import ProjectFormScreen from './screens/ProjectFormScreen';
import ReportScreen from './screens/ReportScreen';
import ReportViewScreen from './screens/ReportViewScreen';
import { fetchProjects } from './utils/api';
import { useRoute } from './utils/route';
import { useSession } from './utils/session';

const App: React.FC = (): JSX.Element => {
  const route = useRoute();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const session = useSession();
  const toastTimer = useRef<number>();

  const reload = useCallback(async (): Promise<void> => {
    try {
      setProjects(await fetchProjects());
      setLoadError('');
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = 'success'): void => {
    setToast({ message, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), tone === 'danger' ? 6000 : 3200);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // The design is light only.
  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
  }, []);

  const renderScreen = (): JSX.Element => {
    if (!projects) {
      return (
        <>
          <AppHeader crumbs={[{ label: 'Projects' }]} />
          <main className="pulse-main">
            {loadError ? (
              <div className="s-alert s-alert--danger">
                <div>
                  <p className="s-alert__title">Couldn't load projects</p>
                  <span>{loadError}</span>
                </div>
                <button type="button" className="s-btn s-btn--sm" style={{ marginLeft: 'auto' }} onClick={reload}>Try again</button>
              </div>
            ) : (
              <div className="s-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-busy="true">
                <div className="s-skeleton" style={{ height: 16, width: '40%' }} />
                <div className="s-skeleton" style={{ height: 16, width: '70%' }} />
                <div className="s-skeleton" style={{ height: 16, width: '55%' }} />
              </div>
            )}
          </main>
        </>
      );
    }
    const props: ScreenProps = { projects, reload, notify };
    switch (route.name) {
      case 'projects':
        return <ProjectsScreen {...props} filter={route.filter} />;
      case 'new-project':
        return <ProjectFormScreen {...props} id={null} />;
      case 'edit-project':
        return <ProjectFormScreen {...props} id={route.id} key={route.id} />;
      case 'project':
        return <ProjectScreen {...props} id={route.id} key={route.id} />;
      case 'view':
        return <ReportViewScreen {...props} id={route.id} file={route.file} key={`${route.id}/${route.file}`} />;
      case 'report':
        return <ReportScreen {...props} id={route.id} file={route.file} copy={route.copy} key={`${route.id}/${route.file}/${route.copy}`} />;
      default:
        return <ProjectsScreen {...props} filter="active" />;
    }
  };

  return (
    <div className="pulse-app">
      {renderScreen()}

      {(toast || session.warning) && (
        <div className="s-toaster" role="status" aria-live="polite">
          {session.warning && (
            <div className="s-toast">
              <span className="s-dot s-dot--warning" />
              <span>No activity for a while: you'll be signed out in a minute. Your work is kept as a draft.</span>
            </div>
          )}
          {toast && (
            <div className="s-toast">
              <span className={`s-dot s-dot--${toast.tone}`} />
              <span>{toast.message}</span>
            </div>
          )}
        </div>
      )}

      {session.ended && <SessionEnded reason={session.ended} idleMinutes={session.idleMinutes} signInHref={session.signInHref} />}
    </div>
  );
};

export default App;
