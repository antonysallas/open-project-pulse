import React from 'react';
import dayjs from 'dayjs';
import { ReportData } from '../../types/ReportTypes';

interface TimelineSectionProps {
  reportData: ReportData;
}

const TimelineSection: React.FC<TimelineSectionProps> = ({ reportData }) => {
  // Calculate position as percentage for timeline marker and progress bar.
  // Each date label is centered in its equal-width column, so the position
  // for date[i] is at the center of column i: (i + 0.5) / N * 100%.
  // We interpolate linearly between column centers based on elapsed days.
  const calculatePosition = (): number => {
    const dates = reportData.timelineDates;
    if (dates.length < 2) return 0;

    const reportDate = dayjs(reportData.reportDate);
    const reportTime = reportDate.valueOf();
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

    // Interpolate by days within the segment
    const segmentStart = dayjs(dates[segmentStartIndex].date);
    const segmentEnd = dayjs(dates[segmentEndIndex].date);
    const segmentDuration = segmentEnd.diff(segmentStart, 'day');
    const daysIntoSegment = reportDate.diff(segmentStart, 'day');
    const fraction = segmentDuration > 0 ? (daysIntoSegment / segmentDuration) : 0;

    const finalPosition = startCenter + fraction * (endCenter - startCenter);

    return Math.min(Math.max(finalPosition, 0), 100);
  };

  const positionPercentage = calculatePosition();

  return (
    <div className="section-group-full">
      <div className="section">
        <div className="section-header">TIMELINE</div>
        <div className="section-content">
          <div className="timeline">
            <div className="timeline-year">{new Date().getFullYear()}</div>

            {/* Current date marker */}
            <div
              className="timeline-marker"
              style={{
                left: `${positionPercentage}%`,
                top: 40,
                height: 'calc(100% - 80px)'
              }}
            />

            {/* Current date indicator triangle */}
            <div
              className="timeline-marker-triangle"
              style={{
                left: `${positionPercentage}%`,
                top: 35
              }}
            />

            <div className="timeline-header">
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    {reportData.timelineDates.map((weekItem, index) => (
                      <td key={index} style={{
                        width: `${100 / reportData.timelineDates.length}%`,
                        borderRight: `1px solid var(--border-light)`
                      }}>
                        <div className="timeline-date">{weekItem.label}</div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="sprint-bars">
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    {Array.from(new Set(reportData.timelineDates.map(week => week.sprintNumber))).map(sprintNumber => {
                      const weeksInSprint = reportData.timelineDates.filter(week => week.sprintNumber === sprintNumber).length;
                      const sprintWidthPercentage = (weeksInSprint / reportData.timelineDates.length) * 100;
                      const isActiveSprint = sprintNumber === reportData.currentSprint;
                      const isPreEngagement = sprintNumber <= 0;

                      return (
                        <td
                          key={sprintNumber}
                          colSpan={weeksInSprint}
                          style={{
                            width: `${sprintWidthPercentage}%`,
                            borderRight: `1px solid var(--border-light)`
                          }}
                        >
                          <div className={`sprint-bar ${isPreEngagement ? 'pre-engagement' : (isActiveSprint ? 'active' : 'inactive')}`}>
                            {isPreEngagement ? 'PREP' : `SPRINT ${sprintNumber}`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Progress bar */}
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${positionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineSection;