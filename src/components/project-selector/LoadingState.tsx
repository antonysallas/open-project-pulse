import React from 'react';
import { Spinner } from '@patternfly/react-core';

interface LoadingStateProps {
  message?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading projects...' }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Spinner size="md" />
      <span>{message}</span>
    </div>
  );
};

export default LoadingState;
