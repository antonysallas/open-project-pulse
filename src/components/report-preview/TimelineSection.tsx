import React from 'react';
import dayjs from 'dayjs';
import { ReportData } from '../../types/ReportTypes';

interface TimelineSectionProps {
  reportData: ReportData;
}

const TimelineSection: React.FC<TimelineSectionProps> = ({ reportData }) => {
  // Calculate position as percentage for timeline marker and progress bar
  const calculatePosition = (): number => {
    const reportDate = dayjs(reportData.reportDate);
    const reportTime = reportDate.valueOf();
    
    // Find which segment contains the report date
    let segmentStartIndex = 0;
    let segmentEndIndex = 1;
    
    for (let i = 0; i < reportData.timelineDates.length - 1; i++) {
      const currentDate = new Date(reportData.timelineDates[i].date).getTime();
      const nextDate = new Date(reportData.timelineDates[i + 1].date).getTime();
      
      if (reportTime >= currentDate && reportTime <= nextDate) {
        segmentStartIndex = i;
        segmentEndIndex = i + 1;
        break;
      }
    }
    
    // Calculate position within the segment
    const segmentStart = dayjs(reportData.timelineDates[segmentStartIndex].date);
    const segmentEnd = dayjs(reportData.timelineDates[segmentEndIndex].date);
    const segmentDuration = segmentEnd.diff(segmentStart, 'day');
    const daysIntoSegment = reportDate.diff(segmentStart, 'day');
    
    // Calculate the segment width as percentage of total timeline
    const totalSegments = reportData.timelineDates.length;
    const segmentWidth = 100 / totalSegments;
    
    // Position within the segment
    const positionInSegment = segmentDuration > 0 ? (daysIntoSegment / segmentDuration) : 0;
    
    // Final position: segment start position + position within segment
    const segmentStartPosition = (segmentStartIndex / totalSegments) * 100;
    const finalPosition = segmentStartPosition + (positionInSegment * segmentWidth);
    
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
                      const isPreEngagement = sprintNumber === -1;

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