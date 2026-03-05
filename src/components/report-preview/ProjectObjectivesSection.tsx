import React from 'react';
import { ReportData } from '../../types/ReportTypes';

interface ProjectObjectivesSectionProps {
  reportData: ReportData;
}

const ProjectObjectivesSection: React.FC<ProjectObjectivesSectionProps> = ({ reportData }) => {
  return (
    <div className="section-group-full">
      <div className="section">
        <div className="section-header">PROJECT OBJECTIVES</div>
        <div className="section-content">
          <div className="subsection-title">
            <strong>Overall Project Goals and Objectives</strong>
          </div>
          <div style={{ paddingLeft: '20px', marginTop: '10px' }}>
            {reportData.projectGoals && reportData.projectGoals.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '10px', listStyleType: 'none' }}>
                {reportData.projectGoals.map((goal, index) => (
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
                    <span style={{ fontSize: '14px' }}>{goal}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div>No project goals defined</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectObjectivesSection;