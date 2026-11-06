import { Project } from './ReportTypes';

export type ToastTone = 'success' | 'danger';

// What every screen gets from the app shell.
export interface ScreenProps {
  projects: Project[];
  reload: () => Promise<void>;
  notify: (message: string, tone?: ToastTone) => void;
}
