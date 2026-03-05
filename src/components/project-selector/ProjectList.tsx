import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import { ProjectInfo } from '../../types/ReportTypes';

interface ProjectListProps {
  projects: ProjectInfo[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}

/**
 * Component for displaying a list of selectable projects
 */
const ProjectList: React.FC<ProjectListProps> = ({ 
  projects, 
  selectedProjectId, 
  onProjectChange 
}) => {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onProjectChange(event.target.value);
  };

  return (
    <FormControl fullWidth>
      <InputLabel id="project-select-label">Project</InputLabel>
      <Select
        labelId="project-select-label"
        id="project-select"
        value={selectedProjectId}
        label="Project"
        onChange={handleChange}
      >
        {projects.map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ProjectList;
