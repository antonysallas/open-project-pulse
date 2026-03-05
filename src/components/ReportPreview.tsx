import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { ReportData } from '../types/ReportTypes';
import {
  ReportHeader,
  TimelineSection,
  ProjectObjectivesSection,
  GoalsSection,
  ProcessTechnologySection,
  LegendSection
} from './report-preview';
import '../styles/main.css';
import '../report-styles.css';

interface ReportPreviewProps {
  reportData: ReportData;
  onBackToContent?: () => void;
}

/**
 * Main component that renders a preview of the report in a PDF-like format.
 * The report is split into logical sections, each handled by a separate component.
 */
const ReportPreview: React.FC<ReportPreviewProps> = ({ reportData, onBackToContent }) => {
  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" color="primary">
          Report Preview
        </Typography>
      </Box>
      
      <Typography variant="body2" paragraph>
        This is a preview of how your report will look. You can generate a PDF from this view.
      </Typography>

      <Paper elevation={0} sx={{ p: 0, border: '1px solid #d9d9d9', width: '100%', overflow: 'hidden' }}>
        <div id="report-preview" className="report-container">
          {/* Header Section with dates, title and status */}
          <ReportHeader reportData={reportData} />

          {/* Timeline Section */}
          <TimelineSection reportData={reportData} />

          {/* Project Objectives Section */}
          <ProjectObjectivesSection reportData={reportData} />

          {/* Goals Section (Accomplishments and Upcoming Goals) */}
          <GoalsSection reportData={reportData} />

          {/* Process & Technology Section */}
          <ProcessTechnologySection reportData={reportData} />

          {/* Legend Section */}
          <LegendSection />
        </div>
      </Paper>
    </Box>
  );
};

export default ReportPreview;