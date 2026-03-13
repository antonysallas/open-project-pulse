import { Sprint, TimelineWeek } from '../../types/ReportTypes';

/**
 * Formats a date as DD-MMM (e.g., 15-Nov)
 */
export const formatShortDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  return `${day}-${month}`;
};

/**
 * Generates timeline weeks from predefined sprints
 */
export const generateTimelineDatesFromSprints = (sprints: Sprint[]): TimelineWeek[] => {
  if (!sprints || sprints.length === 0) {
    return [];
  }

  const weeks: TimelineWeek[] = [];
  
  // For each sprint, only create entries for the start and end dates
  sprints.forEach(sprint => {
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    
    // Create a date for the start of the sprint
    const sprintStartWeek: TimelineWeek = {
      date: new Date(startDate),
      label: formatShortDate(startDate),
      sprintNumber: sprint.number,
      isSprintStart: true
    };
    weeks.push(sprintStartWeek);
    
    // Create a date for the end of the sprint if different from start
    if (endDate.getTime() !== startDate.getTime()) {
      const sprintEndWeek: TimelineWeek = {
        date: new Date(endDate),
        label: formatShortDate(endDate),
        sprintNumber: sprint.number,
        isSprintStart: false
      };
      weeks.push(sprintEndWeek);
    }
  });
  
  // Sort the weeks chronologically
  weeks.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  return weeks;
};

/**
 * Generates timeline weeks between start and end date with sprint associations
 */
export const generateTimelineDates = (
  startDate: Date, 
  endDate: Date, 
  sprintDuration: number = 2, 
  sprintStart?: number
): TimelineWeek[] => {
  const weeks: TimelineWeek[] = [];
  let currentDate = new Date(startDate);
  let weekCounter = 0;

  // Use the provided sprintStart or fallback to 1
  const startNumber = sprintStart !== undefined ? sprintStart : 1;

  while (currentDate <= endDate) {
    // Calculate which sprint this week falls into, taking into account sprintStart
    const sprintNumber = Math.floor(weekCounter / sprintDuration) + startNumber;
    // Check if this is the start of a new sprint
    const isSprintStart = weekCounter % sprintDuration === 0;

    weeks.push({
      date: new Date(currentDate),
      label: formatShortDate(currentDate),
      sprintNumber: sprintNumber,
      isSprintStart: isSprintStart
    });

    // Add 7 days for next week
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 7);
    weekCounter++;
  }

  return weeks;
};

/**
 * Find the closest past date in the timeline for current date
 */
export const findCurrentTimelinePosition = (weeks: TimelineWeek[], currentDate: Date = new Date()): number => {
  const currentTime = currentDate.getTime();
  let closestPastIndex = 0;

  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].date.getTime() <= currentTime) {
      closestPastIndex = i;
    } else {
      break;
    }
  }

  return closestPastIndex;
};

/**
 * Generates timeline for pre-engagement phase followed by regular sprints
 * Creates two entries for pre-engagement (pre-engagement start to Sprint 0 start), then adds all sprints
 */
export const generatePreEngagementWithSprintsTimeline = (
  sprints: Sprint[],
  preEngagementStartDate?: string,
  projectStartDate?: string
): TimelineWeek[] => {
  if (!sprints || sprints.length === 0) {
    return [];
  }

  const weeks: TimelineWeek[] = [];
  const today = new Date();
  const sprint0Start = new Date(sprints[0].startDate);

  // Use pre-engagement start date if provided, then project start date, then today as last resort
  const preEngagementStart = preEngagementStartDate
    ? new Date(preEngagementStartDate)
    : projectStartDate
    ? new Date(projectStartDate)
    : today;

  // Only add pre-engagement if Sprint 1 hasn't started yet
  if (today < sprint0Start) {
    // Calculate a midpoint date for the prep phase to give the PREP bar
    // a 2-column span. The prep phase runs from projectStart to sprint1Start.
    const prepStartMs = preEngagementStart.getTime();
    const sprint1StartMs = sprint0Start.getTime();
    const midpointMs = prepStartMs + Math.floor((sprint1StartMs - prepStartMs) / 2);
    const midpointDate = new Date(midpointMs);

    weeks.push({
      date: new Date(preEngagementStart),
      label: formatShortDate(preEngagementStart),
      sprintNumber: -1,
      isSprintStart: true
    });

    weeks.push({
      date: midpointDate,
      label: formatShortDate(midpointDate),
      sprintNumber: -1,
      isSprintStart: false
    });
  }

  // Add all regular sprints
  const sprintWeeks = generateTimelineDatesFromSprints(sprints);
  weeks.push(...sprintWeeks);
  
  return weeks;
};