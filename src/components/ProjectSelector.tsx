import React from 'react';
import { Paper, Typography, Grid } from '@mui/material';
import { ProjectInfo } from '../types/ReportTypes';
import { useProjects } from '../hooks/useProjects';
import { ProjectList, LoadingState, ErrorState } from './project-selector';

interface ProjectSelectorProps {
  onSelectProject: (project: ProjectInfo) => void;
}

/**
 * Component that allows users to select from available projects.
 * This component is responsible for:
 * 1. Loading the list of available projects
 * 2. Displaying a dropdown for project selection
 * 3. Loading selected project data
 * 4. Passing the selected project to the parent component
 */
const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onSelectProject }) => {
  // Use the custom hook to manage project loading and selection
  const { 
    projects, 
    selectedProjectId, 
    loading, 
    error, 
    setSelectedProjectId 
  } = useProjects(onSelectProject);

  return (
    <Paper sx={{ p: 3, mb: 3 }} elevation={2}>
      <Typography variant="h6" gutterBottom>
        Select a Project
      </Typography>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <ProjectList
              projects={projects}
              selectedProjectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
            />
          </Grid>
        </Grid>
      )}
    </Paper>
  );
};

export default ProjectSelector;