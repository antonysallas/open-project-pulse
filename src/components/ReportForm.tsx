import React from 'react';
import { ReportData, ProjectInfo } from '../types/ReportTypes';
import {
  BasicInfoForm,
  ContentForm,
  ReviewForm
} from './report-form';

interface ReportFormProps {
  currentStep: number;
  reportData: ReportData;
  onDataChange: (data: Partial<ReportData>) => void;
  onSubStepChange?: (step: number) => void;
  selectedProject: ProjectInfo;
}

const ReportForm: React.FC<ReportFormProps> = ({
  currentStep,
  reportData,
  onDataChange,
  onSubStepChange,
  selectedProject
}) => {
  const handleNextStep = () => {
    onSubStepChange && onSubStepChange(currentStep + 1);
  };

  const handlePrevStep = () => {
    onSubStepChange && onSubStepChange(currentStep - 1);
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {currentStep === 0 && (
        <BasicInfoForm
          reportData={reportData}
          onDataChange={onDataChange}
          onNextStep={handleNextStep}
          selectedProject={selectedProject}
        />
      )}

      {currentStep === 1 && (
        <ContentForm
          reportData={reportData}
          onDataChange={onDataChange}
          onPrevStep={handlePrevStep}
          onNextStep={handleNextStep}
        />
      )}

      {currentStep === 2 && (
        <ReviewForm
          reportData={reportData}
          onDataChange={onDataChange}
          onPrevStep={handlePrevStep}
        />
      )}
    </div>
  );
};

export default ReportForm;
