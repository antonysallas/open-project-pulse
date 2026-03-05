import React from 'react';
import { Typography, CircularProgress, Box } from '@mui/material';

interface LoadingStateProps {
  message?: string;
}

/**
 * Component to display during loading state
 */
const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading projects...' }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <CircularProgress size={20} />
      <Typography>{message}</Typography>
    </Box>
  );
};

export default LoadingState;
