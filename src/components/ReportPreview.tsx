import React from 'react';
import { Card, CardBody, Title } from '@patternfly/react-core';
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

const ReportPreview: React.FC<ReportPreviewProps> = ({ reportData, onBackToContent }) => {
  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '16px' }}>
        <Title headingLevel="h2" style={{ color: 'var(--primary-blue)' }}>
          Report Preview
        </Title>
      </div>

      <p style={{ marginBottom: '16px', color: '#6a6e73' }}>
        This is a preview of how your report will look. You can generate a PDF from this view.
      </p>

      <Card isPlain style={{ border: '1px solid #d9d9d9', overflow: 'hidden' }}>
        <CardBody style={{ padding: 0 }}>
          <div id="report-preview" className="report-container">
            <ReportHeader reportData={reportData} />
            <TimelineSection reportData={reportData} />
            <ProjectObjectivesSection reportData={reportData} />
            <GoalsSection reportData={reportData} />
            <ProcessTechnologySection reportData={reportData} />
            <LegendSection />
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default ReportPreview;
