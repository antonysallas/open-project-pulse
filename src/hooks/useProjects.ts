import { useState, useEffect } from 'react';
import { ProjectInfo } from '../types/ReportTypes';
import { getProjects, getProjectInfo } from '../utils/projectService';

export interface UseProjectsResult {
  projects: ProjectInfo[];
  selectedProjectId: string;
  selectedProject: ProjectInfo | null;
  loading: boolean;
  error: string | null;
  setSelectedProjectId: (id: string) => Promise<void>;
}

/**
 * Custom hook to manage project loading and selection
 */
export const useProjects = (onSelectProject?: (project: ProjectInfo) => void): UseProjectsResult => {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load available projects on hook initialization
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectsData = await getProjects();
        setProjects(projectsData);

        // If we have projects, select the first one by default
        if (projectsData.length > 0) {
          setSelectedProjectId(projectsData[0].id);
          // Get full project info for the selected project
          const projectInfo = await getProjectInfo(projectsData[0].id);
          if (projectInfo) {
            setSelectedProject(projectInfo);
            onSelectProject?.(projectInfo);
          }
        }

        setError(null);
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError('Failed to load projects. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to handle project selection change
  const handleProjectChange = async (projectId: string) => {
    try {
      const projectInfo = await getProjectInfo(projectId);
      if (projectInfo) {
        setSelectedProject(projectInfo);
        onSelectProject?.(projectInfo);
      }
    } catch (err) {
      console.error(`Failed to load project info for ${projectId}:`, err);
      setError(`Failed to load project information for the selected project.`);
    }
  };

  // Wrapper for setSelectedProjectId that also loads project data
  const selectProject = async (projectId: string) => {
    setSelectedProjectId(projectId);
    await handleProjectChange(projectId);
  };

  return {
    projects,
    selectedProjectId,
    selectedProject,
    loading,
    error,
    setSelectedProjectId: selectProject
  };
};
