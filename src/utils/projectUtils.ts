import { Sprint } from '../types/ReportTypes';

/**
 * Determines the current sprint based on the current date and sprint definitions
 * @param sprints List of predefined sprints
 * @param currentDate Current date to check (defaults to today)
 * @returns The number of the current sprint, or 1 if no match is found
 */
export const getCurrentSprintNumber = (sprints: Sprint[] | undefined, currentDate: Date = new Date()): number => {
  if (!sprints || sprints.length === 0) {
    return 1; // Default to sprint 1 if no sprints are defined
  }

  // Find the sprint where the current date falls between start and end dates
  const currentSprint = sprints.find(sprint => {
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    
    // Adjust end date to include the entire day
    endDate.setHours(23, 59, 59, 999);
    
    return currentDate >= startDate && currentDate <= endDate;
  });
  
  // If a sprint is found, return its number
  if (currentSprint) {
    return currentSprint.number;
  }
  
  // If current date is before the first sprint, return the first sprint number
  if (currentDate < new Date(sprints[0].startDate)) {
    return sprints[0].number;
  }
  
  // If current date is after the last sprint, return the last sprint number
  if (currentDate > new Date(sprints[sprints.length - 1].endDate)) {
    return sprints[sprints.length - 1].number;
  }
  
  // Default to the first sprint if no match is found (should not happen with the above checks)
  return 1;
};

/**
 * Get the formatted filename for a report
 * @param projectId The project ID
 * @param date The report date
 * @returns Formatted filename in YYYYMMDD_projectid_report.json format
 */
export function getReportFilename(projectId: string, date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}${month}${day}_${projectId}_report.json`;
}

/**
 * Parse a report filename into a readable date string
 * @param filename The filename to parse (YYYYMMDD_projectid_report.json)
 * @returns A human-readable date string
 */
export function parseReportFilename(filename: string): string {
  // Extract the date portion (YYYYMMDD)
  const match = filename.match(/^(\d{4})(\d{2})(\d{2})_/);
  if (!match) return filename;
  
  const [, year, month, day] = match;
  
  // Create a date object and format it
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}