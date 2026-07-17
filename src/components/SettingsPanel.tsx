'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Bot, Edit3, Eye, EyeOff, FolderOpen, FolderPlus, Layers, Link, Loader2, Plus, RefreshCw, Save, ServerCog, Trash, Upload, UsersRound, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { AISettingsCard } from '@/components/AISettingsCard';
import { ProjectKnowledgeCard } from '@/components/ProjectKnowledgeCard';
import { SystemReadinessCard } from '@/components/SystemReadinessCard';
import { WorkspaceMembersCard } from '@/components/WorkspaceMembersCard';

interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface SettingsPanelProps {
  projects: Project[];
  modules: Module[];
  selectedProject: string;
  setSelectedProject: (value: string) => void;
  onCreateProject: () => void;
  onCreateModule: () => void;
  onDeleteProject: (id: string) => void;
  onDeleteModule: (id: string) => void;
}

interface ProjectKnowledge {
  id: string;
  projectId: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const EMPTY_KNOWLEDGE_FORM = { id: '', type: 'QA_RULES', title: '', content: '' };

export function SettingsPanel({
  projects,
  modules,
  selectedProject,
  setSelectedProject,
  onCreateProject,
  onCreateModule,
  onDeleteProject,
  onDeleteModule,
}: SettingsPanelProps) {
  const [knowledgeItems, setKnowledgeItems] = useState<ProjectKnowledge[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [knowledgeUploading, setKnowledgeUploading] = useState(false);
  const [knowledgeFile, setKnowledgeFile] = useState<File | null>(null);
  const [knowledgeForm, setKnowledgeForm] = useState(EMPTY_KNOWLEDGE_FORM);
  const [knowledgeMessage, setKnowledgeMessage] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaDepth, setFigmaDepth] = useState('3');
  const [figmaSyncing, setFigmaSyncing] = useState(false);
  const [figmaSyncMessage, setFigmaSyncMessage] = useState('');
  const [aiProvider, setAiProvider] = useState('auto');
  const [groqStatus, setGroqStatus] = useState('Not configured');
  const [geminiStatus, setGeminiStatus] = useState('Not configured');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('');
  const [aiMessage, setAiMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings/ai')
      .then(response => response.json())
      .then(data => {
        setAiProvider(data.provider || 'auto');
        setGroqStatus(data.groq || 'Not configured');
        setGeminiStatus(data.gemini || 'Not configured');
        setOllamaBaseUrl(data.ollamaBaseUrl || '');
        setAiMessage(data.ollamaError || '');
      })
      .catch(() => setAiMessage('Gagal membaca konfigurasi AI.'));
  }, []);

  const loadKnowledge = async () => {
    if (!selectedProject) {
      setKnowledgeItems([]);
      return;
    }
    setKnowledgeLoading(true);
    try {
      const response = await fetch(`/api/project-knowledge?projectId=${encodeURIComponent(selectedProject)}`);
      const data = await response.json();
      setKnowledgeItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setKnowledgeItems([]);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadKnowledge();
      setKnowledgeForm(EMPTY_KNOWLEDGE_FORM);
      setFigmaSyncMessage('');
    }, 0);
  return () => window.clearTimeout(timer);
  }, [selectedProject]);

  const saveKnowledge = async () => {
    if (!selectedProject || !knowledgeForm.title.trim() || !knowledgeForm.content.trim()) return;
    setKnowledgeSaving(true);
    setKnowledgeMessage('');
    try {
      const response = await fetch('/api/project-knowledge', {
        method: knowledgeForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: knowledgeForm.id || undefined,
          projectId: selectedProject,
          type: knowledgeForm.type,
          title: knowledgeForm.title,
          content: knowledgeForm.content,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal menyimpan knowledge.');
      setKnowledgeForm(EMPTY_KNOWLEDGE_FORM);
      setKnowledgeMessage('Knowledge berhasil disimpan.');
      loadKnowledge();
    } catch (error) {
      setKnowledgeMessage(error instanceof Error ? error.message : 'Gagal menyimpan knowledge.');
    } finally {
      setKnowledgeSaving(false);
    }
  };

  const deleteKnowledge = async (id: string) => {
    setKnowledgeMessage('');
    try {
      const response = await fetch(`/api/project-knowledge?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus knowledge.');
      if (knowledgeForm.id === id) setKnowledgeForm(EMPTY_KNOWLEDGE_FORM);
      setKnowledgeMessage('Knowledge berhasil dihapus.');
      loadKnowledge();
    } catch (error) {
      setKnowledgeMessage(error instanceof Error ? error.message : 'Gagal menghapus knowledge.');
    }
  };

  const uploadKnowledgeFile = async () => {
    if (!selectedProject || !knowledgeFile) return;
    setKnowledgeUploading(true);
    setKnowledgeMessage('');
    try {
      const formData = new FormData();
      formData.append('projectId', selectedProject);
      formData.append('type', knowledgeForm.type);
      formData.append('title', knowledgeForm.title.trim() || knowledgeFile.name);
      formData.append('file', knowledgeFile);

      const response = await fetch('/api/project-knowledge/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal mengunggah file knowledge.');
      setKnowledgeFile(null);
      setKnowledgeForm(EMPTY_KNOWLEDGE_FORM);
      setKnowledgeMessage('File knowledge berhasil diunggah.');
      loadKnowledge();
    } catch (error) {
      setKnowledgeMessage(error instanceof Error ? error.message : 'Gagal mengunggah file knowledge.');
    } finally {
      setKnowledgeUploading(false);
    }
  };

  const syncFigmaKnowledge = async () => {
    if (!selectedProject || !figmaUrl.trim()) return;
    setFigmaSyncing(true);
    setFigmaSyncMessage('');
    try {
      const response = await fetch('/api/project-knowledge/figma-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          figmaUrl: figmaUrl.trim(),
          depth: Number(figmaDepth) || 3,
          title: knowledgeForm.title.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Gagal menyinkronkan file Figma.');

      setFigmaUrl('');
      setKnowledgeForm(EMPTY_KNOWLEDGE_FORM);
      setFigmaSyncMessage(`Figma knowledge tersimpan: ${data.title || 'Feature Map'}`);
      loadKnowledge();
    } catch (error) {
      setFigmaSyncMessage(error instanceof Error ? error.message : 'Gagal sync Figma knowledge.');
    } finally {
      setFigmaSyncing(false);
    }
  };

  const knowledgeCardProps = {
    selectedProject, setKnowledgeForm, knowledgeForm, knowledgeItems, knowledgeLoading,
    setKnowledgeFile, knowledgeFile, uploadKnowledgeFile, knowledgeUploading,
    figmaUrl, setFigmaUrl, figmaDepth, setFigmaDepth, syncFigmaKnowledge,
    figmaSyncing, figmaSyncMessage, saveKnowledge, knowledgeSaving, deleteKnowledge, knowledgeMessage,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-8"
    >
      <Tabs defaultValue="system" className="gap-5">
      <div className="w-full overflow-x-auto rounded-xl scrollbar-thin scrollbar-thumb-border/40">
        <TabsList className="h-auto w-max min-w-full justify-start gap-1 border border-border/60 bg-secondary/35 p-1">
          <TabsTrigger value="system" className="min-w-max flex-none"><ServerCog className="size-4" />System</TabsTrigger>
          <TabsTrigger value="team" className="min-w-max flex-none"><UsersRound className="size-4" />Team</TabsTrigger>
          <TabsTrigger value="ai" className="min-w-max flex-none"><Bot className="size-4" />AI</TabsTrigger>
          <TabsTrigger value="projects" className="min-w-max flex-none"><FolderOpen className="size-4" />Projects</TabsTrigger>
          <TabsTrigger value="knowledge" className="min-w-max flex-none"><BookOpen className="size-4" />Knowledge</TabsTrigger>
          <TabsTrigger value="integrations" className="min-w-max flex-none"><Link className="size-4" />Integrations</TabsTrigger>
          <TabsTrigger value="modules" className="min-w-max flex-none"><Layers className="size-4" />Modules</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="system" className="mt-0">
        <SystemReadinessCard />
      </TabsContent>
      <TabsContent value="team" className="mt-0">
        <WorkspaceMembersCard />
      </TabsContent>
      <TabsContent value="ai" className="mt-0">
      <AISettingsCard
        projectId={selectedProject}
        provider={aiProvider}
        ollamaBaseUrl={ollamaBaseUrl}
        groqStatus={groqStatus}
        geminiStatus={geminiStatus}
        message={aiMessage}
      />
      </TabsContent>

      {/* Projects Card */}
      <TabsContent value="projects" className="mt-0">
      <Card variant="majestic">
        <CardHeader className="pb-3 border-b border-border/40 mb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold tracking-tight">Projects</CardTitle>
            <Button onClick={onCreateProject} size="sm" variant="majestic" className="gap-1.5 rounded-xl bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-medium shadow-md hover:shadow-cyan-500/10 transition duration-200 text-[11px] uppercase">
              <FolderPlus className="w-3.5 h-3.5" /> Project Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!Array.isArray(projects) || projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-medium">Belum ada project. Buat project baru untuk memulai.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                  className={`flex flex-col items-stretch justify-between gap-3 rounded-xl border p-4 transition duration-200 sm:flex-row sm:items-center ${
                    selectedProject === project.id
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/60 bg-secondary/30 hover:bg-secondary/60 hover:border-border'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`rounded-xl p-2.5 ${selectedProject === project.id ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{project.name}</p>
                      {project.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="bg-secondary/50 border-border/60 text-muted-foreground text-[9px] font-medium uppercase rounded-lg">
                          {project._count?.testCases || 0} Test Cases
                        </Badge>
                        <Badge variant="outline" className="bg-secondary/50 border-border/60 text-muted-foreground text-[9px] font-medium uppercase rounded-lg">
                          {project._count?.modules || 0} Modules
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant={selectedProject === project.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedProject(project.id)}
                      className="h-8 px-4 font-semibold text-[10px] uppercase tracking-wide rounded-xl"
                    >
                      {selectedProject === project.id ? 'Aktif' : 'Pilih'}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10">
                          <Trash className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-border/60 bg-card text-foreground elevation-3 rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground">Hapus Project?</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            Semua test case dan module dalam project &quot;{project.name}&quot; akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="border-t border-border/40 pt-4">
                          <AlertDialogCancel className="rounded-xl border-border/60 bg-secondary/30 text-foreground hover:bg-secondary/50 transition duration-200">Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => onDeleteProject(project.id)} className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs">
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="knowledge" className="mt-0">
      <ProjectKnowledgeCard {...knowledgeCardProps} mode="knowledge" />
      </TabsContent>

      <TabsContent value="integrations" className="mt-0">
      <ProjectKnowledgeCard {...knowledgeCardProps} mode="integrations" />
      </TabsContent>

      {/* Modules Card */}
      <TabsContent value="modules" className="mt-0">
      <Card variant="majestic" className="overflow-hidden border-border/40 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">Modules</CardTitle>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                Kelompokkan test case berdasarkan area fungsi.
              </p>
            </div>
            <Button
              onClick={onCreateModule}
              size="sm"
              disabled={!selectedProject}
              className="gap-1.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 text-foreground font-bold text-[10px] uppercase border border-border/50 shadow-sm transition duration-200"
            >
              <FolderPlus className="w-3.5 h-3.5 text-primary" /> Module Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!selectedProject ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-secondary/50 p-4 mb-4">
                <Layers className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground font-semibold">Pilih project terlebih dahulu untuk mengelola module.</p>
            </div>
          ) : modules.length === 0 ? (
            <div className="py-10 text-center rounded-2xl border border-dashed border-border/40 bg-secondary/10">
              <p className="text-sm text-muted-foreground font-semibold">Belum ada module. Buat module untuk mengorganisir test case.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {modules.map((module, index) => (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 pl-4 pr-2 py-2.5 hover:bg-secondary/50 hover:border-primary/30 transition duration-200 group/mod"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/50 text-muted-foreground group-hover/mod:text-primary transition-colors">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{module.name}</p>
                      <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase">{module._count?.testCases || 0} Cases</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 opacity-100 sm:opacity-0 sm:group-hover/mod:opacity-100 transition"
                    onClick={() => onDeleteModule(module.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </TabsContent>
      </Tabs>
    </motion.div>
  );
}
