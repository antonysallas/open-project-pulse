// Typst source generator
// Transforms ReportData (from the UI) into a complete .typ file
// that calls the #report() template function.

const { htmlToTypstContent, htmlToTypstContentArray, escapeTypst } = require('./htmlToTypst');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format ISO date string to "04-Mar-2026"
 */
function formatDateForTypst(isoString) {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format ISO date string to short form "04-Mar"
 */
function formatDateShort(isoString) {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  return `${day}-${month}`;
}

/**
 * Derive sprint bars from timelineDates + currentSprint.
 * Mirrors the logic in TimelineSection.tsx.
 *
 * Returns array of { label, span, active?, prep? }
 */
function generateSprintBars(reportData) {
  const dates = reportData.timelineDates || [];
  if (dates.length === 0) return [];

  // Get unique sprint numbers in order
  const seen = new Set();
  const sprintNumbers = [];
  for (const d of dates) {
    const sn = d.sprintNumber;
    if (!seen.has(sn)) {
      seen.add(sn);
      sprintNumbers.push(sn);
    }
  }

  return sprintNumbers.map((sprintNumber) => {
    const weeksInSprint = dates.filter((d) => d.sprintNumber === sprintNumber).length;
    const isActive = sprintNumber === reportData.currentSprint;
    const isPreEngagement = sprintNumber <= 0;

    const bar = {
      label: isPreEngagement ? 'Prep' : `Sprint ${sprintNumber}`,
      span: weeksInSprint,
    };

    if (isPreEngagement) bar.prep = true;
    else bar.active = isActive;

    return bar;
  });
}

/**
 * Calculate marker position as percentage of the timeline.
 * Mirrors calculatePosition() in TimelineSection.tsx.
 *
 * Each date label is centered in its equal-width column, so the position
 * for date[i] is at the center of column i: (i + 0.5) / N * 100%.
 * We interpolate linearly between column centers based on elapsed time.
 */
function calculateMarkerPosition(reportData) {
  const dates = reportData.timelineDates || [];
  if (dates.length < 2) return 0;

  const reportDate = new Date(reportData.reportDate);
  const reportTime = reportDate.getTime();
  const N = dates.length;
  const colWidth = 100 / N;

  // Find which segment (date[i] → date[i+1]) contains the report date
  let segmentStartIndex = 0;
  let segmentEndIndex = 1;

  for (let i = 0; i < N - 1; i++) {
    const currentDate = new Date(dates[i].date).getTime();
    const nextDate = new Date(dates[i + 1].date).getTime();
    if (reportTime >= currentDate && reportTime <= nextDate) {
      segmentStartIndex = i;
      segmentEndIndex = i + 1;
      break;
    }
    // If past the last segment, clamp to the last one
    if (i === N - 2 && reportTime > nextDate) {
      segmentStartIndex = i;
      segmentEndIndex = i + 1;
    }
  }

  // Column-center positions for the segment boundaries
  const startCenter = (segmentStartIndex + 0.5) * colWidth;
  const endCenter = (segmentEndIndex + 0.5) * colWidth;

  // Interpolate by time within the segment
  const segmentStart = new Date(dates[segmentStartIndex].date).getTime();
  const segmentEnd = new Date(dates[segmentEndIndex].date).getTime();
  const segmentDurationMs = segmentEnd - segmentStart;
  const msIntoSegment = reportTime - segmentStart;
  const fraction = segmentDurationMs > 0 ? msIntoSegment / segmentDurationMs : 0;

  const finalPosition = startCenter + fraction * (endCenter - startCenter);

  return Math.min(Math.max(Number(finalPosition.toFixed(1)), 0), 100);
}

/**
 * Escape a string for use as a Typst string literal (inside quotes).
 */
function typstString(str) {
  return `"${String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Format an array of items as a Typst array literal.
 * Always includes a trailing comma to ensure single-element arrays
 * are treated as arrays (Typst treats `(x)` as just `x`).
 */
function typstArray(items) {
  if (items.length === 0) return '()';
  return `(${items.join(', ')},)`;
}

/**
 * Build the #report(...) invocation string from reportData.
 */
function generateReportCall(reportData) {
  const lines = [];
  const indent = '  ';

  lines.push('#report(');

  // Simple string fields
  lines.push(`${indent}project-title: ${typstString(reportData.projectTitle)},`);
  lines.push(`${indent}report-date: ${typstString(formatDateForTypst(reportData.reportDate))},`);
  lines.push(`${indent}next-report-date: ${typstString(formatDateForTypst(reportData.nextReportDate))},`);
  lines.push(`${indent}status: ${typstString(reportData.status)},`);

  const year = String(new Date(reportData.reportDate).getFullYear());
  lines.push(`${indent}year: ${typstString(year)},`);

  // Timeline dates — array of short date strings
  const timelineDates = (reportData.timelineDates || []).map((d) =>
    typstString(d.label || formatDateShort(d.date))
  );
  lines.push(`${indent}timeline-dates: ${typstArray(timelineDates)},`);

  // Sprint bars
  const sprintBars = generateSprintBars(reportData);
  const barStrings = sprintBars.map((bar) => {
    const fields = [`label: ${typstString(bar.label)}`, `span: ${bar.span}`];
    if (bar.prep) fields.push('prep: true');
    else if (bar.active) fields.push('active: true');
    else fields.push('active: false');
    return `(${fields.join(', ')})`;
  });
  lines.push(`${indent}sprint-bars: ${typstArray(barStrings)},`);

  // Progress and marker
  const markerPos = calculateMarkerPosition(reportData);
  lines.push(`${indent}progress-percentage: ${markerPos},`);
  lines.push(`${indent}marker-position: ${markerPos},`);
  lines.push(`${indent}current-sprint: ${reportData.currentSprint},`);

  // Project goals — array of plain strings
  const goals = (reportData.projectGoals || []).map((g) => typstString(g));
  lines.push(`${indent}project-goals: ${typstArray(goals)},`);

  // Accomplishments — flat content array
  const accomplishments = formatSectionItems(reportData.accomplishments || []);
  lines.push(`${indent}accomplishments: ${typstArray(accomplishments)},`);

  // Upcoming goals
  const upcoming = formatSectionItems(reportData.upcomingGoals || []);
  lines.push(`${indent}upcoming-goals: ${typstArray(upcoming)},`);

  // People and process — typed items
  const pnp = formatTypedItems(reportData.peopleAndProcess || []);
  lines.push(`${indent}people-and-process: ${typstArray(pnp)},`);

  // Technology — typed items
  const tech = formatTypedItems(reportData.technology || []);
  lines.push(`${indent}technology: ${typstArray(tech)},`);

  lines.push(')');

  return lines.join('\n');
}

/**
 * Convert an array of { text } items into flat Typst content expressions.
 */
function formatSectionItems(items) {
  const result = [];
  for (const item of items) {
    const text = typeof item === 'string' ? item : item.text || '';
    const contents = htmlToTypstContentArray(text);
    for (const c of contents) {
      result.push(c);
    }
  }
  return result;
}

/**
 * Convert an array of { text, type } items into Typst dict expressions
 * with (text: [...], type: "TYPE") format.
 */
function formatTypedItems(items) {
  const result = [];
  for (const item of items) {
    const text = typeof item === 'string' ? item : item.text || '';
    const type = (typeof item === 'string' ? 'FYI' : item.type) || 'FYI';
    const contents = htmlToTypstContentArray(text);
    // Combine multiple paragraphs into a single content block
    const combined = contents.length > 0 ? contents.join(' + [ ] + ') : '[]';
    // Wrap in a Typst content block if we combined multiple
    const textContent = contents.length > 1 ? `{${combined}}` : combined;
    result.push(`(text: ${textContent}, type: ${typstString(type)})`);
  }
  return result;
}

/**
 * Generate complete Typst source from reportData and template source.
 * Strips example usage from template and appends the generated #report() call.
 */
function generateTypstSource(reportData, templateSource) {
  // Strip everything after the "// EXAMPLE USAGE" comment
  const marker = '// EXAMPLE USAGE';
  const markerIndex = templateSource.indexOf(marker);
  let templateDefs;
  if (markerIndex !== -1) {
    // Go back to the previous line boundary (strip the separator comment too)
    const beforeMarker = templateSource.substring(0, markerIndex);
    // Remove trailing separator lines (e.g. "// ====...")
    templateDefs = beforeMarker.replace(/\/\/\s*=+\s*\n*$/, '').trimEnd();
  } else {
    templateDefs = templateSource.trimEnd();
  }

  const reportCall = generateReportCall(reportData);

  return `${templateDefs}\n\n${reportCall}\n`;
}

module.exports = {
  generateTypstSource,
  generateReportCall,
  formatDateForTypst,
  formatDateShort,
  generateSprintBars,
  calculateMarkerPosition,
};
