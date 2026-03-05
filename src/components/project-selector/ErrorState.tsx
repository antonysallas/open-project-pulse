import React from 'react';
import { Alert } from '@patternfly/react-core';

interface ErrorStateProps {
  message: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({ message }) => {
  return (
    <Alert variant="danger" title="Error" isInline>
      {message}
    </Alert>
  );
};

export default ErrorState;
