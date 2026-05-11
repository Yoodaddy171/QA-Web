'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Edit3, FolderOpen, FolderPlus, Layers, Save, Trash, Upload, X } from 'lucide-react';
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

const KNOWLEDGE_TYPE_OPTIONS = [
  { value: 'API_DOCS', label: 'API Docs' },
  { value: 'FEATURE_MAP', label: 'Feature Map' },
  { value: 'QA_RULES', label: 'QA Rules' },
  { value: 'DOMAIN_DICTIONARY', label: 'Domain Dictionary' },
  { value: 'TEST_STRATEGY', label: 'Test Strategy' },
  { value: 'CHANGELOG', label: 'Release Notes' },
  { value: 'KNOWN_ISSUE', label: 'Known Issues' },
  { value: 'ENV_NOTE', label: 'Env Notes' },
];

const EMPTY_KNOWLEDGE_FORM = {
  id: '',
  type: 'QA_RULES',
  title: '',
  content: '',
};

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
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedProject]);

  const saveKnowledge = async () => {
    if (!selectedProject || !knowledgeForm.title.trim() || !knowledgeForm.content.trim()) return;
    setKnowledgeSaving(true);
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
      if (!response.ok) throw new Error('Failed to save knowledge');
      setKnowledgeForm(EMPTY_KNOWLEDGE_FORM);
      loadKnowledge();
    } catch {
      // Keep the form content so the user can retry.
    } finally {
      setKnowledgeSaving(false);
    }
  };

  const deleteKnowledge = async (id: string) => {
    try {
      await fetch(`/api/project-knowledge?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (knowledgeForm.id === id) setKnowledgeForm(EMPTY_KNOWLEDGE_FORM);
      loadKnowledge();
    } catch {
      // Non-blocking in settings.
    }
  };

  const uploadKnowledgeFile = async () => {
    if (!selectedProject || !knowledgeFile) return;
    setKnowledgeUploading(true);
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
      if (!response.ok) throw new Error('Failed to upload knowledge file');
      setKnowledgeFile(null);
      setKnowledgeForm(EMPTY_KNOWLEDGE_FORM);
      loadKnowledge();
    } catch {
      // Keep selected file so the user can retry.
    } finally {
      setKnowledgeUploading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-8"
    >
      {/* Projects Card */}
      <Card variant="majestic">
        <CardHeader className="pb-3 border-b border-border/50 mb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</CardTitle>
            <Button onClick={onCreateProject} size="sm" className="gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[11px] uppercase elevation-1">
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
                  className={`flex items-center justify-between rounded-xl border p-4 transition-all duration-200 ${
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
                  <div className="flex items-center gap-2">
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
                      <AlertDialogContent className="bg-card border-border rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground">Hapus Project?</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            Semua test case dan module dalam project &quot;{project.name}&quot; akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl bg-secondary border-border text-foreground hover:bg-secondary/80">Batal</AlertDialogCancel>
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

      {/* Knowledge Card */}
      <Card variant="majestic">
        <CardHeader className="pb-3 border-b border-border/50 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project Knowledge</CardTitle>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Context for QA Copilot intelligence.
              </p>
            </div>
            <Button
              onClick={() => setKnowledgeForm(EMPTY_KNOWLEDGE_FORM)}
              size="sm"
              disabled={!selectedProject}
              className="gap-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-[11px] uppercase border border-border/60"
            >
              <BookOpen className="h-3.5 w-3.5 text-primary" /> Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedProject ? (
            <p className="py-6 text-center text-sm text-muted-foreground font-medium">Pilih project terlebih dahulu untuk mengelola knowledge.</p>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Tipe</Label>
                  <Select
                    value={knowledgeForm.type}
                    onValueChange={(value) => setKnowledgeForm(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="bg-secondary/50 border-border/60 text-foreground focus:ring-primary/30 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-border/60 rounded-xl elevation-3">
                      {KNOWLEDGE_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value} className="rounded-lg">{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Judul</Label>
                  <Input
                    value={knowledgeForm.title}
                    onChange={(event) => setKnowledgeForm(prev => ({ ...prev, title: event.target.value }))}
                    placeholder="contoh: POS Session API, QA Rules Servios"
                    className="bg-secondary/50 border-border/60 text-foreground placeholder:text-muted-foreground focus:ring-primary/30 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Isi Knowledge</Label>
                <Textarea
                  value={knowledgeForm.content}
                  onChange={(event) => setKnowledgeForm(prev => ({ ...prev, content: event.target.value }))}
                  placeholder="Paste API docs, feature map, aturan QA, atau catatan testing..."
                  className="min-h-36 bg-secondary/50 border-border/60 text-foreground placeholder:text-muted-foreground focus:ring-primary/30 resize-y rounded-xl"
                />
              </div>
              <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Upload File Knowledge</Label>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      JSON, TXT, MD, CSV, DOCX, and PDF supported.
                    </p>
                    {knowledgeFile && (
                      <p className="mt-2 truncate text-[10px] font-semibold text-primary uppercase">{knowledgeFile.name}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Input
                      type="file"
                      accept=".json,.txt,.md,.markdown,.csv,.docx,.pdf,.log,.yaml,.yml"
                      className="max-w-[240px] bg-secondary/50 border-border/60 text-xs text-muted-foreground file:text-primary file:font-semibold file:text-[9px] rounded-xl"
                      onChange={(event) => setKnowledgeFile(event.target.files?.[0] || null)}
                    />
                    <Button
                      type="button"
                      onClick={uploadKnowledgeFile}
                      disabled={!knowledgeFile || knowledgeUploading}
                      className="gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[10px] uppercase elevation-1"
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={saveKnowledge}
                  disabled={knowledgeSaving || !knowledgeForm.title.trim() || !knowledgeForm.content.trim()}
                  className="gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[11px] uppercase elevation-1"
                >
                  <Save className="h-3.5 w-3.5" />
                  {knowledgeForm.id ? 'Update Knowledge' : 'Simpan Knowledge'}
                </Button>
                {knowledgeForm.id && (
                  <Button variant="outline" onClick={() => setKnowledgeForm(EMPTY_KNOWLEDGE_FORM)} className="rounded-xl border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary">
                    Batal Edit
                  </Button>
                )}
              </div>

              <div className="border-t border-border/50 pt-6 mt-2">
                {knowledgeLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : knowledgeItems.length === 0 ? (
                  <p className="py-4 text-center text-[11px] font-medium text-muted-foreground">Belum ada project knowledge.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {knowledgeItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05, duration: 0.2 }}
                        className="rounded-xl border border-border/60 bg-secondary/30 p-4 hover:border-border hover:bg-secondary/60 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="rounded-lg bg-secondary/50 border-border/60 text-muted-foreground text-[9px] font-medium uppercase">
                                {KNOWLEDGE_TYPE_OPTIONS.find(option => option.value === item.type)?.label || item.type}
                              </Badge>
                              <p className="font-semibold text-foreground text-sm truncate">{item.title}</p>
                            </div>
                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground group-hover:text-foreground/70 transition-colors leading-relaxed">{item.content}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => setKnowledgeForm({
                                id: item.id,
                                type: item.type,
                                title: item.title,
                                content: item.content,
                              })}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                              onClick={() => deleteKnowledge(item.id)}
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modules Card */}
      <Card variant="majestic">
        <CardHeader className="pb-3 border-b border-border/50 mb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Module</CardTitle>
            <Button onClick={onCreateModule} size="sm" disabled={!selectedProject} className="gap-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-[11px] uppercase border border-border/60">
              <FolderPlus className="w-3.5 h-3.5 text-primary" /> Module Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedProject ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-medium">Pilih project terlebih dahulu untuk mengelola module.</p>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-medium">Belum ada module. Buat module untuk mengorganisir test case.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {modules.map((module) => (
                <div key={module.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/30 pl-3 pr-1 py-1.5 transition-all hover:border-border hover:bg-secondary/60 group/mod">
                  <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{module.name}</span>
                  <Badge variant="outline" className="rounded-lg bg-secondary/50 border-border/60 text-muted-foreground text-[9px] font-medium">{module._count?.testCases || 0}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 rounded-lg p-0 text-muted-foreground/50 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 opacity-0 group-hover/mod:opacity-100 transition-all"
                    onClick={() => onDeleteModule(module.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
