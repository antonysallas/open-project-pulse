import React, { useEffect } from 'react';
import { ReportData } from '../../types/ReportTypes';
import ReportPreview from '../../components/ReportPreview';

interface ReviewFormProps {
  reportData: ReportData;
  onPrevStep: () => void;
  onDataChange?: (data: Partial<ReportData>) => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ reportData, onPrevStep, onDataChange }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div>
      <ReportPreview reportData={reportData} />
    </div>
  );
};

export default ReviewForm;
