import React from 'react';
import { Box } from '@mui/material';
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

/**
 * Main ReportForm component that manages the wizard-like flow between different
 * sections of the report form. Each section is now a separate component.
 */
const ReportForm: React.FC<ReportFormProps> = ({ 
  currentStep, 
  reportData, 
  onDataChange, 
  onSubStepChange,
  selectedProject
}) => {
  // Navigation handlers
  const handleNextStep = () => {
    onSubStepChange && onSubStepChange(currentStep + 1);
  };

  const handlePrevStep = () => {
    onSubStepChange && onSubStepChange(currentStep - 1);
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Step 1: Basic Info */}
      {currentStep === 0 && (
        <BasicInfoForm 
          reportData={reportData} 
          onDataChange={onDataChange} 
          onNextStep={handleNextStep}
          selectedProject={selectedProject}
        />
      )}

      {/* Step 2: Sections & Content */}
      {currentStep === 1 && (
        <ContentForm 
          reportData={reportData} 
          onDataChange={onDataChange} 
          onPrevStep={handlePrevStep} 
          onNextStep={handleNextStep} 
        />
      )}

      {/* Step 3: Review & Preview */}
      {currentStep === 2 && (
        <ReviewForm 
          reportData={reportData} 
          onDataChange={onDataChange} 
          onPrevStep={handlePrevStep} 
        />
      )}
    </Box>
  );
};

export default ReportForm;