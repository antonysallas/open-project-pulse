import { ProjectInfo, ReportData, WeeklyReport } from '../types/ReportTypes';

// Function to get all available projects
export async function getProjects(): Promise<ProjectInfo[]> {
  try {
    const response = await fetch('/data/projects.json');
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    const data = await response.json();
    // Filter only in-progress projects
    return data.projects.filter((project: ProjectInfo) => project.status === 'in-progress');
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
}

// Function to get specific project info with details
export async function getProjectInfo(projectId: string): Promise<ProjectInfo | null> {
  try {
    // First, fetch the project summary from the main projects.json
    const response = await fetch('/data/projects.json');
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    const data = await response.json();
    const projectSummary = data.projects.find((p: ProjectInfo) => p.id === projectId);
    
    if (!projectSummary) {
      return null;
    }
    
    // If the project has a details file, load the full project details
    if (projectSummary.detailsFile) {
      const detailsResponse = await fetch(`/data/${projectSummary.detailsFile}`);
      if (detailsResponse.ok) {
        const projectDetails = await detailsResponse.json();
        return projectDetails;
      } else {
        console.error(`Failed to load project details from ${projectSummary.detailsFile}`);
        // Fall back to summary if details file can't be loaded
        return projectSummary;
      }
    }
    
    // Return the summary if no details file is specified
    return projectSummary;
  } catch (error) {
    console.error(`Error loading project info for ${projectId}:`, error);
    return null;
  }
}

// Function to get available report files for a project
export async function getAvailableReports(projectId: string): Promise<string[]> {
  try {
    // In a real production environment, this would be a proper API call
    // For demo purposes, we'll try to actually fetch the directory listing
    // from the server if available, or fall back to mock data

    try {
      // Try to fetch the listing from a simulated server endpoint
      const response = await fetch(`/api/projects/${projectId}/reports`);
      
      // If we have a proper API that returns the report listing
      if (response.ok) {
        const data = await response.json();
        return data.reports.sort().reverse();
      }
    } catch (e) {
      console.log("No API endpoint available, using mock data");
    }
    
    // For demo purposes, return empty mock data
    // In production, this would be replaced by a real API
    const mockReportFiles: string[] = [];
    
    // Sort files in descending order (newest first)
    return mockReportFiles.sort().reverse();
  } catch (error) {
    console.error(`Error getting available reports for ${projectId}:`, error);
    return [];
  }
}

// Function to get weekly reports for a project
export async function getWeeklyReports(projectId: string): Promise<WeeklyReport[]> {
  try {
    const reportFiles = await getAvailableReports(projectId);
    const results: WeeklyReport[] = [];

    for (const reportFile of reportFiles) {
      try {
        const response = await fetch(`/data/reports/${projectId}/${reportFile}`);
        if (response.ok) {
          const reportData = await response.json();
          results.push(reportData as WeeklyReport);
        } else {
          console.warn(`Report ${reportFile} not found for project ${projectId}`);
        }
      } catch (err) {
        console.warn(`Error loading report ${reportFile}:`, err);
        // Continue with the next report
      }
    }

    // Sort by reportDate descending (newest first)
    return results.sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
  } catch (error) {
    console.error(`Error loading weekly reports for ${projectId}:`, error);
    return [];
  }
}

// Function to load a specific report
export async function loadWeeklyReport(projectId: string, reportFile: string): Promise<WeeklyReport | null> {
  try {
    console.log(`Loading report: /data/${projectId}/${reportFile}`);
    const response = await fetch(`/data/reports/${projectId}/${reportFile}`);
    
    if (response.ok) {
      const reportData = await response.json();
      
      // If completionPercentage and daysRemaining are not in the report,
      // we'll calculate them later in reportUtils.ts
      return {
        ...reportData,
        // Ensure required fields are present even if file doesn't include them
        completionPercentage: reportData.completionPercentage ?? 0,
        daysRemaining: reportData.daysRemaining ?? 0,
        timelineDates: reportData.timelineDates ?? [],
      } as WeeklyReport;
    } else {
      console.error(`Report ${reportFile} not found for project ${projectId}`);
      return null;
    }
  } catch (error) {
    console.error(`Error loading report ${reportFile}:`, error);
    return null;
  }
}

// Generate PDF via server-side Typst compilation
export async function generateTypstPdf(
  projectId: string,
  reportData: ReportData
): Promise<{ blob: Blob; savedPath: string | null }> {
  // Serialize ReportData: Dates -> ISO strings, timelineDates -> serialized
  const serialized = {
    ...reportData,
    reportDate: reportData.reportDate.toISOString(),
    nextReportDate: reportData.nextReportDate.toISOString(),
    projectStartDate: reportData.projectStartDate.toISOString(),
    projectEndDate: reportData.projectEndDate.toISOString(),
    timelineDates: reportData.timelineDates.map((week) => ({
      date: week.date.toISOString(),
      label: week.label,
      sprintNumber: week.sprintNumber,
      isSprintStart: week.isSprintStart,
    })),
  };

  const response = await fetch(`/api/reports/${projectId}/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reportData: serialized }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.details || error.error || 'Failed to generate PDF');
  }

  const blob = await response.blob();
  const savedPath = response.headers.get('X-Saved-Path');

  return { blob, savedPath };
}