import { WeeklyReport, ReportData, ProjectInfo, ReportItem, TimelineWeek, SerializedTimelineWeek } from '../types/ReportTypes';
import { loadWeeklyReport } from './projectService';
import { getReportFilename, getCurrentSprintNumber } from './projectUtils';

/**
 * Create a template for a new report
 * @param projectInfo The project information
 * @param date The report date (defaults to today)
 * @returns A template ReportData object
 */
export function createReportTemplate(projectInfo: ProjectInfo, date: Date = new Date()): ReportData {
  // Calculate next report date (1 week later)
  const nextReportDate = new Date(date);
  nextReportDate.setDate(date.getDate() + 7);
  
  // Calculate current sprint
  const currentSprint = getCurrentSprintNumber(projectInfo.sprints, date);
  
  // Default report data
  return {
    projectTitle: projectInfo.name,
    projectStartDate: new Date(projectInfo.startDate),
    projectEndDate: new Date(projectInfo.endDate),
    reportDate: date,
    nextReportDate: nextReportDate,
    currentSprint: currentSprint,
    sprintDuration: projectInfo.sprintDuration || 1,
    sprintStart: 1,
    status: 'on-track',
    timelineDates: [],
    accomplishments: [],
    upcomingGoals: [],
    peopleAndProcess: [],
    technology: [],
    teamName: projectInfo.teamName || '',
    projectGoals: projectInfo.projectGoals || [],
    projectSprints: projectInfo.sprints || [],
    completionPercentage: 0,
    daysRemaining: 0,
    currentTimelinePosition: 0,
  };
}

/**
 * Parse a report filename to get the date
 * Expected format: YYYYMMDD_projectid_report.json
 */
export function parseReportFilename(filename: string): { date: Date, projectId: string } | null {
  try {
    const dateMatch = filename.match(/^(\d{8})_([^_]+)_report\.json$/);
    if (!dateMatch) return null;
    
    const dateStr = dateMatch[1];
    const projectId = dateMatch[2];
    
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
    const day = parseInt(dateStr.substring(6, 8));
    
    return {
      date: new Date(year, month, day),
      projectId
    };
  } catch (error) {
    console.error('Error parsing report filename:', error);
    return null;
  }
}

/**
 * Format a filename into a human-readable date string
 */
export function formatReportFilenameForDisplay(filename: string): string {
  const parsed = parseReportFilename(filename);
  if (!parsed) return filename;
  
  return parsed.date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Convert a ReportData object to a WeeklyReport for saving to JSON
 */
export function convertReportDataToWeeklyReport(reportData: ReportData): WeeklyReport {
  return {
    reportDate: reportData.reportDate.toISOString().split('T')[0],
    nextReportDate: reportData.nextReportDate.toISOString().split('T')[0],
    currentSprint: reportData.currentSprint,
    completionPercentage: reportData.completionPercentage,
    daysRemaining: reportData.daysRemaining,
    status: reportData.status,
    accomplishments: reportData.accomplishments,
    upcomingGoals: reportData.upcomingGoals,
    peopleAndProcess: reportData.peopleAndProcess,
    technology: reportData.technology,
    timelineDates: reportData.timelineDates.map(
      (week): SerializedTimelineWeek => ({
        date: week.date.toISOString(),
        label: week.label,
        sprintNumber: week.sprintNumber,
        isSprintStart: week.isSprintStart,
      })
    ),
    currentTimelinePosition: reportData.currentTimelinePosition,
  };
}

/**
 * Load a report and convert it to ReportData format
 */
export async function loadReportIntoReportData(
  projectId: string, 
  reportFile: string, 
  projectInfo: ProjectInfo
): Promise<ReportData | null> {
  try {
    const report = await loadWeeklyReport(projectId, reportFile);
    if (!report) return null;
    
    // Calculate the timeline dates based on project sprints
    let timelineDates: TimelineWeek[] = [];
    
    if (projectInfo.sprints && projectInfo.sprints.length > 0) {
      // Generate timeline dates from sprints
      timelineDates = projectInfo.sprints.map(sprint => {
        const startDate = new Date(sprint.startDate);
        return {
          date: startDate,
          label: formatDateShort(startDate),
          sprintNumber: sprint.number,
          isSprintStart: true
        };
      });
    } else if (report.timelineDates && report.timelineDates.length > 0) {
      // Fall back to using timeline dates from the report if available
      timelineDates = report.timelineDates.map(item => {
        // Check if item is a string (old format)
        if (typeof item === 'string') {
          const dateStr = item as string;
          const date = new Date();
          const parts = dateStr.split('-');
          if (parts.length === 2) {
            const day = parts[0];
            const month = parts[1];
            const monthMap: { [key: string]: number } = {
              Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
              Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
            };
            date.setMonth(monthMap[month] || 0);
            date.setDate(parseInt(day) || 1);
          }
          return {
            date,
            label: dateStr,
            sprintNumber: 1,
            isSprintStart: false
          };
        } 
        // Check if item is an object with date property
        else if (item && typeof item === 'object' && 'date' in item) {
          const serializedItem = item as SerializedTimelineWeek;
          if (typeof serializedItem.date === 'string') {
            return {
              date: new Date(serializedItem.date),
              label: serializedItem.label,
              sprintNumber: serializedItem.sprintNumber,
              isSprintStart: serializedItem.isSprintStart
            };
          }
        }
        
        // Default fallback
        return {
          date: new Date(),
          label: 'Unknown',
          sprintNumber: 1,
          isSprintStart: false
        };
      });
    }
    
    // Make sure accomplishments, goals, etc. are in the correct format
    const standardizeReportItems = (items: any[] = []): ReportItem[] => {
      if (!items || !Array.isArray(items)) return [];
      
      return items.map(item => {
        if (typeof item === 'string') {
          return { text: item, type: 'FYI' as const };
        }
        return item as ReportItem;
      });
    };
    
    // Calculate completionPercentage and daysRemaining
    const reportDate = new Date(report.reportDate);
    const projectStartDate = new Date(projectInfo.startDate);
    const projectEndDate = new Date(projectInfo.endDate);
    
    // Calculate project completion percentage
    const totalDuration = projectEndDate.getTime() - projectStartDate.getTime();
    const elapsedDuration = reportDate.getTime() - projectStartDate.getTime();
    const completionPercentage = Math.min(Math.max(Math.round((elapsedDuration / totalDuration) * 100), 0), 100);
    
    // Calculate days remaining
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const daysRemaining = Math.round((projectEndDate.getTime() - reportDate.getTime()) / oneDay);
    
    // Find the current position in the timeline
    let currentTimelinePosition = 0;
    if (timelineDates.length > 0) {
      for (let i = 0; i < timelineDates.length; i++) {
        if (reportDate >= timelineDates[i].date) {
          currentTimelinePosition = i;
        } else {
          break;
        }
      }
    }
    
    // Create the ReportData object
    return {
      projectTitle: projectInfo.name,
      projectStartDate: projectStartDate,
      projectEndDate: projectEndDate,
      reportDate: reportDate,
      nextReportDate: new Date(report.nextReportDate),
      currentSprint: report.currentSprint,
      sprintDuration: projectInfo.sprintDuration || 1,
      sprintStart: 1,
      status: report.status,
      timelineDates: timelineDates,
      accomplishments: standardizeReportItems(report.accomplishments),
      upcomingGoals: standardizeReportItems(report.upcomingGoals),
      peopleAndProcess: standardizeReportItems(report.peopleAndProcess),
      technology: standardizeReportItems(report.technology),
      teamName: projectInfo.teamName || 'Project Team',
      projectGoals: projectInfo.projectGoals || [],
      projectSprints: projectInfo.sprints || [],
      completionPercentage: report.completionPercentage || completionPercentage,
      daysRemaining: report.daysRemaining || daysRemaining,
      currentTimelinePosition: report.currentTimelinePosition || currentTimelinePosition,
    };
  } catch (error) {
    console.error(`Error loading report ${reportFile} for project ${projectId}:`, error);
    return null;
  }
}

/**
 * Format a date to a short format like "11-Nov"
 */
function formatDateShort(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${day}-${month}`;
}