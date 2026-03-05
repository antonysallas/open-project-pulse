import React from 'react';
import { ReportData } from '../../types/ReportTypes';

interface GoalsSectionProps {
  reportData: ReportData;
}

interface ProcessedItem {
  html: string;
  plainText: string;
}

const GoalsSection: React.FC<GoalsSectionProps> = ({ reportData }) => {
  /**
   * Processes text input to create an array of individual items for display
   * while preserving formatting (bold, italic, etc.)
   */
  const processTextToItems = (text: string): ProcessedItem[] => {
    // Empty check
    if (!text || text.trim() === '') return [];

    // ReactQuill creates <p> tags, so we need to extract each paragraph
    const div = document.createElement('div');
    div.innerHTML = text;

    // Extract each paragraph with its formatting
    const items: ProcessedItem[] = [];
    div.querySelectorAll('p').forEach(p => {
      // Get both the HTML (for formatting) and plain text (for filtering empty paragraphs)
      const html = p.innerHTML;
      const plainText = p.textContent?.trim() || '';

      if (plainText.length > 0) {
        items.push({
          html: html,
          plainText: plainText
        });
      }
    });

    // If no paragraphs found, handle plain text with line breaks
    if (items.length === 0) {
      return text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => ({
          html: line,
          plainText: line
        }));
    }

    return items;
  };

  // Process accomplishments text
  const accomplishmentItems: ProcessedItem[] = reportData.accomplishments.length > 0
    ? processTextToItems(reportData.accomplishments[0].text)
    : [];

  // Process upcoming goals text
  const upcomingGoalItems: ProcessedItem[] = reportData.upcomingGoals.length > 0
    ? processTextToItems(reportData.upcomingGoals[0].text)
    : [];

  return (
    <div className="section-group">
      <div className="section">
        <div className="section-header">ACCOMPLISHMENTS</div>
        <div className="section-content">
          <div className="subsection-title">
            <strong>Current Sprint Goals and Accomplishments</strong>
            {/* <strong>Current Sprint Goals and Accomplishments (Sprint {reportData.currentSprint})</strong> */}
          </div>
          <div style={{ paddingLeft: '20px', marginTop: '10px' }}>
            {accomplishmentItems.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '10px', listStyleType: 'none' }}>
                {accomplishmentItems.map((item, index) => (
                  <li key={index} style={{ marginBottom: '8px', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{
                      color: '#1976d2',
                      fontSize: '14px',
                      marginRight: '8px',
                      minWidth: '20px',
                      fontWeight: 'bold'
                    }}>
                      {index + 1}.
                    </span>
                    <span
                      style={{ fontSize: '14px' }}
                      dangerouslySetInnerHTML={{ __html: item.html }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div>No accomplishments listed</div>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">UPCOMING GOALS</div>
        <div className="section-content">
          <div className="subsection-title">
            <strong>Upcoming Sprint Goals</strong>
            {/* <strong>Goals for Upcoming Sprint (Sprint {reportData.currentSprint + 1})</strong>             */}
          </div>
          <div style={{ paddingLeft: '20px', marginTop: '10px' }}>
            {upcomingGoalItems.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '10px', listStyleType: 'none' }}>
                {upcomingGoalItems.map((item, index) => (
                  <li key={index} style={{ marginBottom: '8px', display: 'flex', alignItems: 'flex-start' }}>
                    <span style={{
                      color: '#1976d2',
                      fontSize: '14px',
                      marginRight: '8px',
                      minWidth: '20px',
                      fontWeight: 'bold'
                    }}>
                      {index + 1}.
                    </span>
                    <span
                      style={{ fontSize: '14px' }}
                      dangerouslySetInnerHTML={{ __html: item.html }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div>No upcoming goals listed</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalsSection;