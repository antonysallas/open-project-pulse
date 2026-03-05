import React from 'react';
import { Card, CardBody, CardTitle, Title } from '@patternfly/react-core';
import { ProjectInfo } from '../types/ReportTypes';
import { useProjects } from '../hooks/useProjects';
import { ProjectList, LoadingState, ErrorState } from './project-selector';

interface ProjectSelectorProps {
  onSelectProject: (project: ProjectInfo) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onSelectProject }) => {
  const {
    projects,
    selectedProjectId,
    loading,
    error,
    setSelectedProjectId
  } = useProjects(onSelectProject);

  return (
    <Card isPlain>
      <CardTitle>
        <Title headingLevel="h3">Select a Project</Title>
      </CardTitle>
      <CardBody>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <ProjectList
            projects={projects}
            selectedProjectId={selectedProjectId}
            onProjectChange={setSelectedProjectId}
          />
        )}
      </CardBody>
    </Card>
  );
};

export default ProjectSelector;
