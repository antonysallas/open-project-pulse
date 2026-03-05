import React from 'react';
import { Typography, Alert } from '@mui/material';

interface ErrorStateProps {
  message: string;
}

/**
 * Component to display error messages
 */
const ErrorState: React.FC<ErrorStateProps> = ({ message }) => {
  return (
    <Alert severity="error">
      <Typography>{message}</Typography>
    </Alert>
  );
};

export default ErrorState;
