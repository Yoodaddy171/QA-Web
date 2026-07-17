import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  createModule,
  createProject,
  deleteModule,
  deleteProject,
  fetchModules,
  fetchProjects,
} from '@/lib/client/api/projects-client';
import type { Module, Project } from '@/lib/client/api/types';

const LAST_PROJECT_STORAGE_KEY = 'web-qa:last-project-id';

export function useProjects() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const data = await fetchProjects();
      setProjects(data);
      if (data.length > 0) {
        const lastProjectId = window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY);
        const restoredProject = lastProjectId
          ? data.find((project) => project.id === lastProjectId)
          : null;
        setSelectedProject(current => {
          const selectedStillExists = current
            ? data.some((project) => project.id === current)
            : false;
          return selectedStillExists ? current : restoredProject?.id || data[0].id;
        });
      } else {
        setSelectedProject('');
      }
    } catch (error: any) {
      console.error('Failed to load projects:', error);
      setProjects([]);
      toast({
        title: error?.data?.error ? 'Database Error' : 'Error',
        description: error?.data?.error || 'Failed to load projects',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingProjects(false);
    }
  }, [toast]);

  const loadModules = useCallback(async (projId: string) => {
    if (!projId) return;
    try {
      setModules(await fetchModules(projId));
    } catch {
      toast({ title: 'Error', description: 'Failed to load modules', variant: 'destructive' });
    }
  }, [toast]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return false;
    try {
      await createProject({ name: newProjectName.trim(), description: newProjectDesc.trim() });
      toast({ variant: 'success', title: 'Berhasil', description: 'Project berhasil dibuat' });
      setNewProjectName('');
      setNewProjectDesc('');
      loadProjects();
      return true;
    } catch (error: any) {
      toast({ title: 'Gagal membuat project', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [loadProjects, newProjectDesc, newProjectName, toast]);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      toast({ variant: 'success', title: 'Berhasil', description: 'Project berhasil dihapus' });
      setSelectedProject(current => {
        if (current === id) {
          window.localStorage.removeItem(LAST_PROJECT_STORAGE_KEY);
          return '';
        }
        return current;
      });
      loadProjects();
    } catch (error: any) {
      toast({ title: 'Gagal menghapus project', description: error.message, variant: 'destructive' });
    }
  }, [loadProjects, toast]);

  const handleCreateModule = useCallback(async () => {
    if (!newModuleName.trim() || !selectedProject) return false;
    try {
      await createModule({ name: newModuleName.trim(), projectId: selectedProject });
      toast({ variant: 'success', title: 'Berhasil', description: 'Module berhasil dibuat' });
      setNewModuleName('');
      loadModules(selectedProject);
      return true;
    } catch (error: any) {
      toast({ title: 'Gagal membuat module', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [loadModules, newModuleName, selectedProject, toast]);

  const handleDeleteModule = useCallback(async (id: string) => {
    try {
      await deleteModule(id);
      toast({ variant: 'success', title: 'Berhasil', description: 'Module berhasil dihapus' });
      loadModules(selectedProject);
    } catch (error: any) {
      toast({ title: 'Gagal menghapus module', description: error.message, variant: 'destructive' });
    }
  }, [loadModules, selectedProject, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadProjects(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProjects]);

  useEffect(() => {
    if (selectedProject) {
      window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, selectedProject);
    }
  }, [selectedProject]);

  return {
    projects,
    isLoadingProjects,
    modules,
    selectedProject,
    newProjectName,
    newProjectDesc,
    newModuleName,
    setSelectedProject,
    setNewProjectName,
    setNewProjectDesc,
    setNewModuleName,
    loadProjects,
    loadModules,
    handleCreateProject,
    handleDeleteProject,
    handleCreateModule,
    handleDeleteModule,
  };
}
