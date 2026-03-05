import React from 'react';
import { ReportData } from '../../types/ReportTypes';
import ItemsByTypeSection from './ItemsByTypeSection';

interface ProcessTechnologySectionProps {
  reportData: ReportData;
}

const ProcessTechnologySection: React.FC<ProcessTechnologySectionProps> = ({ reportData }) => {
  return (
    <div className="section-group">
      <ItemsByTypeSection 
        title="PEOPLE AND PROCESS" 
        items={reportData.peopleAndProcess} 
      />
      <ItemsByTypeSection 
        title="TECHNOLOGY" 
        items={reportData.technology} 
      />
    </div>
  );
};

export default ProcessTechnologySection;