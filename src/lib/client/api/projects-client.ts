import type { Module, Project } from '@/lib/client/api/types';

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects');
  const data = await res.json();
  if (!Array.isArray(data)) {
    const error = new Error(data?.error || 'Projects API returned non-array data');
    Object.assign(error, { data });
    throw error;
  }
  return data;
}

export async function createProject(input: { name: string; description: string }) {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Project gagal dibuat');
  return data;
}

export async function deleteProject(id: string) {
  const res = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Project gagal dihapus');
  return data;
}

export async function fetchModules(projectId: string): Promise<Module[]> {
  const res = await fetch(`/api/modules?projectId=${projectId}`);
  return res.json();
}

export async function createModule(input: { name: string; projectId: string }) {
  const res = await fetch('/api/modules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Module gagal dibuat');
  return data;
}

export async function deleteModule(id: string) {
  const res = await fetch(`/api/modules?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Module gagal dihapus');
  return data;
}
