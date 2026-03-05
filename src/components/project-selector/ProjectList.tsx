import React from 'react';
import { FormGroup, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { ProjectInfo } from '../../types/ReportTypes';

interface ProjectListProps {
  projects: ProjectInfo[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  selectedProjectId,
  onProjectChange
}) => {
  const handleChange = (_event: React.FormEvent<HTMLSelectElement>, value: string) => {
    onProjectChange(value);
  };

  return (
    <FormGroup label="Project" fieldId="project-select">
      <FormSelect
        id="project-select"
        value={selectedProjectId}
        onChange={handleChange}
        aria-label="Select a project"
      >
        <FormSelectOption key="" value="" label="Select a project..." isPlaceholder />
        {projects.map((project) => (
          <FormSelectOption key={project.id} value={project.id} label={project.name} />
        ))}
      </FormSelect>
    </FormGroup>
  );
};

export default ProjectList;
