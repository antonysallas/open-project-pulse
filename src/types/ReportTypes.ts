export type ItemType = 'ASK' | 'APPROVAL' | 'DIRECTIVE' | 'FYI';
export type ReportStatus = 'on-track' | 'at-risk' | 'delayed';
export type ProjectStatus = 'in-progress' | 'completed';
export type DeliveryModel = 'sprint' | 'milestone';

// A sprint or a phase. Dates are YYYY-MM-DD.
export interface Period {
  name: string;
  start: string;
  end: string;
  goal?: string; // sprints: what the sprint is for, up to 50 characters
  tentative?: boolean; // the goal is a plan, set in the week before the sprint
}

// One saved report as GET /api/projects lists it.
export interface ReportSummary {
  json: string;
  pdf: string | null;
  date: string | null;
  status: string | null;
  draft: boolean;
  locked?: boolean; // presented: no more edits until unlocked
  reason?: string; // why at risk or delayed (rich text)
  actions?: Partial<Record<ItemType, number>>; // stakeholder items by type
}

// A project as the screens use it (see normalizeProject).
export interface Project {
  id: string;
  name: string;
  description: string;
  customer: string;
  team: string;
  start: string;
  end: string;
  model: DeliveryModel;
  sprintWeeks: number;
  periods: Period[];
  goals: string[];
  status: ProjectStatus;
  hasLogo: boolean;
  reports: ReportSummary[];
}

// A project as stored in projects/<id>.json.
export interface StoredPeriod {
  number?: number;
  name?: string;
  startDate: string;
  endDate: string;
  goal?: string;
  tentative?: boolean;
}

export interface StoredProject {
  id: string;
  name?: string;
  description?: string;
  customer?: string;
  teamName?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  deliveryModel?: string;
  sprintDuration?: number;
  sprints?: StoredPeriod[];
  phases?: StoredPeriod[];
  projectGoals?: string[];
  logo?: string;
  logoName?: string;
  hasLogo?: boolean;
  reports?: ReportSummary[];
}

export interface ReportItem {
  text: string;
  type: ItemType;
}

// A report as stored in reports/<id>/YYYYMMDD_<id>_report.json. For phased
// projects, upcomingGoals holds the ongoing and outstanding tasks. Item text
// and the reason are rich text (utils/rich.ts). currentPeriods is there only
// when the phases were picked by hand.
export interface StoredReport {
  reportDate: string;
  nextReportDate?: string;
  currentPeriods?: number[];
  sprintGoal?: string; // sprints: the goals as typed in this report (the
  nextSprintGoal?: string; // project keeps them once it is submitted)
  status?: string;
  statusReason?: string;
  locked?: boolean; // set only by the lock call (server/api.js)
  lockedAt?: string; // ISO time
  lockedBy?: string; // who locked it, when sign-in is on
  accomplishments?: ReportItem[];
  upcomingGoals?: ReportItem[];
  peopleAndProcess?: ReportItem[];
  technology?: ReportItem[];
  draft?: boolean;
}

// An item while it is being edited (text is rich); key keeps React rows and
// focus stable.
export interface EditItem {
  key: string;
  text: string;
  type: ItemType;
}

export type ListKey = 'done' | 'upcoming' | 'people' | 'tech';

// The report editor's state.
export interface ReportDraft {
  date: string;
  nextDate: string;
  periods: number[] | null; // null: the periods running on the report date
  goalCur?: string | null; // sprints: the covered sprint's goal as edited (null: as the project has it)
  goalNext?: string | null; // and the next sprint's, tentative
  status: ReportStatus;
  reason: string; // rich text
  done: EditItem[];
  upcoming: EditItem[];
  people: EditItem[];
  tech: EditItem[];
  copiedFrom: string | null; // date of the report this one started from
}
