export type ItemType = 'ASK' | 'APPROVAL' | 'DIRECTIVE' | 'FYI';

export interface ListItem {
  text: string;
  type?: ItemType;
  subItems?: string[];
}

export interface TimelineDate {
  date: Date;
  label: string;
}

export interface Sprint {
  number: number;
  startDate: string;
  endDate: string;
  name: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  sprintDuration?: number;
  projectGoals: string[];
  status: 'completed' | 'in-progress';
  teamName: string;
  sprints?: Sprint[];
  detailsFile?: string;
  preEngagementStartDate?: string; // Optional pre-engagement start date
}

export interface ReportItem {
  text: string;
  type: ItemType;
}

export interface SerializedTimelineWeek {
  date: string; // ISO string for date serialization
  label: string;
  sprintNumber: number;
  isSprintStart: boolean;
}

export interface WeeklyReport {
  reportDate: string;
  nextReportDate: string;
  currentSprint: number;
  completionPercentage: number;
  daysRemaining: number;
  status: 'on-track' | 'at-risk' | 'delayed';
  accomplishments: ReportItem[];
  upcomingGoals: ReportItem[];
  peopleAndProcess: ReportItem[];
  technology: ReportItem[];
  timelineDates: SerializedTimelineWeek[];
  currentTimelinePosition: number;
}

export interface TimelineWeek {
  date: Date;
  label: string;
  sprintNumber: number;
  isSprintStart: boolean;
}

export interface ReportData {
  projectTitle: string;
  projectStartDate: Date;
  projectEndDate: Date;
  reportDate: Date;
  nextReportDate: Date;
  currentSprint: number;
  sprintDuration: number;
  sprintStart: number; // 0 for Sprint 0, 1 for Sprint 1
  status: 'on-track' | 'at-risk' | 'delayed';
  projectPhase?: 'pre-engagement' | 'active'; // New field for project phase
  timelineDates: TimelineWeek[];
  accomplishments: ReportItem[];
  upcomingGoals: ReportItem[];
  peopleAndProcess: ReportItem[];
  technology: ReportItem[];
  teamName: string;
  projectGoals: string[]; // Project outcomes/goals read from projects.json
  projectSprints?: Sprint[]; // Predefined sprint dates from project details

  // These will be calculated dynamically
  completionPercentage: number;
  daysRemaining: number;
  currentTimelinePosition: number;
}