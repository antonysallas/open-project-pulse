import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import { ReportData } from '../../types/ReportTypes';
import ReportPreview from '../../components/ReportPreview';

interface ReviewFormProps {
  reportData: ReportData;
  onPrevStep: () => void;
  onDataChange?: (data: Partial<ReportData>) => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ reportData, onPrevStep, onDataChange }) => {
  // Ensure we're at the top of the page when the component mounts
  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, []);
  
  return (
    <Box>
      <ReportPreview reportData={reportData} />
    </Box>
  );
};

export default ReviewForm;