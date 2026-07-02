'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Edit3, FolderOpen, FolderPlus, Layers, Link, Loader2, Plus, RefreshCw, Save, Trash, Upload, X } from 'lucide-react';
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
  { value: 'AI_PROFILE', label: 'AI Profile' },
  { value: 'QA_PREFERENCE', label: 'QA Preference' },
  { value: 'PROJECT_RULE', label: 'Project Rule' },
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
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaDepth, setFigmaDepth] = useState('3');
  const [figmaSyncing, setFigmaSyncing] = useState(false);
  const [figmaSyncMessage, setFigmaSyncMessage] = useState('');

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
      if (!response.ok) throw new Error(data.error || 'Failed to sync Figma file');

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-8"
    >
      {/* Projects Card */}
      <Card variant="majestic">
        <CardHeader className="pb-3 border-b border-border/40 mb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">Project</CardTitle>
            <Button onClick={onCreateProject} size="sm" variant="majestic" className="gap-1.5 rounded-xl bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-medium shadow-md hover:shadow-cyan-500/10 transition-all duration-200 text-[11px] uppercase">
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
                      <AlertDialogContent className="border-border/60 bg-card/95 backdrop-blur-md text-foreground elevation-3 rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-foreground">Hapus Project?</AlertDialogTitle>
                          <AlertDialogDescription className="text-muted-foreground">
                            Semua test case dan module dalam project &quot;{project.name}&quot; akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="border-t border-border/40 pt-4">
                          <AlertDialogCancel className="rounded-xl border-border/60 bg-secondary/30 text-foreground hover:bg-secondary/50 transition-all duration-200">Batal</AlertDialogCancel>
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

      <Card variant="majestic" className="overflow-hidden border-border/40 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/10 bg-gradient-to-r from-primary/5 via-indigo-500/5 to-cyan-500/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">Project Knowledge</CardTitle>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                Context for QA Copilot intelligence.
              </p>
            </div>
            <Button
              onClick={() => setKnowledgeForm(EMPTY_KNOWLEDGE_FORM)}
              size="sm"
              disabled={!selectedProject}
              className="gap-1.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 text-foreground font-bold text-[10px] uppercase border border-border/50 shadow-sm transition-all duration-200"
            >
              <Plus className="h-3.5 w-3.5 text-primary" /> Tambah Baru
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {!selectedProject ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-secondary/50 p-4 mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground font-semibold">Pilih project terlebih dahulu untuk mengelola knowledge.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Kategori Tipe</Label>
                  <Select
                    value={knowledgeForm.type}
                    onValueChange={(value) => setKnowledgeForm(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus:ring-primary/20 focus:border-primary transition-all duration-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border/60 bg-card/95 backdrop-blur-xl rounded-xl shadow-2xl">
                      {KNOWLEDGE_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value} className="rounded-lg py-2">{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Judul Knowledge</Label>
                  <Input
                    value={knowledgeForm.title}
                    onChange={(event) => setKnowledgeForm(prev => ({ ...prev, title: event.target.value }))}
                    placeholder="contoh: POS Session API, QA Rules Servios"
                    className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Isi Knowledge (Context)</Label>
                <Textarea
                  value={knowledgeForm.content}
                  onChange={(event) => setKnowledgeForm(prev => ({ ...prev, content: event.target.value }))}
                  placeholder="Paste API docs, feature map, aturan QA, atau catatan testing..."
                  className="h-40 max-h-[480px] overflow-y-auto rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200 resize-y [field-sizing:fixed] scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent p-4"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 shadow-inner">
                  <div className="flex flex-col gap-4">
                    <div className="min-w-0">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Manual Upload</Label>
                      <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                        Dukung format JSON, TXT, MD, CSV, DOCX, dan PDF.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        type="file"
                        accept=".json,.txt,.md,.markdown,.csv,.docx,.pdf,.log,.yaml,.yml"
                        className="h-9 rounded-xl border-border/60 bg-secondary/40 text-[11px] font-medium text-muted-foreground file:mr-3 file:bg-primary file:rounded-lg file:border-0 file:px-3 file:py-1 file:text-[9px] file:font-black file:uppercase file:text-white transition-all duration-200"
                        onChange={(event) => setKnowledgeFile(event.target.files?.[0] || null)}
                      />
                      <Button
                        type="button"
                        onClick={uploadKnowledgeFile}
                        disabled={!knowledgeFile || knowledgeUploading}
                        className="h-9 gap-1.5 rounded-xl bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-bold shadow-md hover:shadow-cyan-500/20 transition-all duration-200 text-[10px] uppercase px-4"
                      >
                        {knowledgeUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Upload
                      </Button>
                    </div>
                    {knowledgeFile && (
                      <p className="truncate text-[10px] font-black text-primary uppercase tracking-tight bg-primary/10 px-2 py-1 rounded-md w-fit">
                        Selected: {knowledgeFile.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 shadow-inner">
                  <div className="flex flex-col gap-4">
                    <div className="min-w-0 space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Figma Synchronization</Label>
                      <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                        Fetch frames & text menjadi Feature Map knowledge otomatis.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={figmaUrl}
                        onChange={(event) => setFigmaUrl(event.target.value)}
                        placeholder="Paste Figma file URL atau key"
                        className="h-9 rounded-xl border-border/60 bg-secondary/40 text-[11px] font-medium text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
                      />
                      <div className="w-[80px] shrink-0">
                        <Select value={figmaDepth} onValueChange={setFigmaDepth}>
                          <SelectTrigger className="h-9 rounded-xl border-border/60 bg-secondary/40 text-[11px] font-bold focus:ring-primary/20 transition-all duration-200"><SelectValue /></SelectTrigger>
                          <SelectContent className="border-border/60 bg-card rounded-xl shadow-xl">
                            {['1', '2', '3', '4', '5', '6'].map(depth => (
                              <SelectItem key={depth} value={depth} className="text-xs">{depth}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        onClick={syncFigmaKnowledge}
                        disabled={!figmaUrl.trim() || figmaSyncing}
                        className="h-9 gap-1.5 rounded-xl bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-bold shadow-md hover:shadow-cyan-500/20 transition-all duration-200 text-[10px] uppercase px-4"
                      >
                        {figmaSyncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                        Sync
                      </Button>
                    </div>
                    {figmaSyncMessage && (
                      <p className="text-[10px] font-bold text-primary animate-pulse">{figmaSyncMessage}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={saveKnowledge}
                  disabled={knowledgeSaving || !knowledgeForm.title.trim() || !knowledgeForm.content.trim()}
                  className="h-11 gap-2 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-cyan-600 hover:from-primary/90 hover:via-indigo-600/90 hover:to-cyan-600/90 text-white font-bold shadow-lg hover:shadow-primary/20 transition-all duration-300 text-[11px] uppercase px-6"
                >
                  <Save className="h-4 w-4" />
                  {knowledgeForm.id ? 'Update Project Knowledge' : 'Simpan Knowledge'}
                </Button>
                {knowledgeForm.id && (
                  <Button variant="outline" onClick={() => setKnowledgeForm(EMPTY_KNOWLEDGE_FORM)} className="h-11 rounded-xl border-border/60 text-muted-foreground font-bold hover:text-foreground hover:bg-secondary/80 transition-all duration-200 px-6">
                    Batal
                  </Button>
                )}
              </div>

              <div className="border-t border-border/10 pt-8 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stored Knowledge Base</p>
                </div>
                {knowledgeLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : knowledgeItems.length === 0 ? (
                  <div className="py-10 text-center rounded-2xl border border-dashed border-border/40 bg-secondary/10">
                    <p className="text-xs font-semibold text-muted-foreground">Belum ada project knowledge yang tersimpan.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {knowledgeItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                        className="rounded-2xl border border-border/50 bg-secondary/20 p-5 hover:border-primary/30 hover:bg-secondary/40 hover:shadow-md transition-all duration-300 group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-start justify-between gap-4 relative z-10">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
                              <Badge variant="outline" className="rounded-lg bg-background/50 border-border/40 text-primary text-[9px] font-black uppercase tracking-tight py-0.5">
                                {KNOWLEDGE_TYPE_OPTIONS.find(option => option.value === item.type)?.label || item.type}
                              </Badge>
                              <p className="font-bold text-foreground text-sm truncate">{item.title}</p>
                            </div>
                            <p className="line-clamp-3 text-[11px] text-muted-foreground font-medium leading-relaxed group-hover:text-foreground/80 transition-colors">{item.content}</p>
                            <p className="mt-3 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter">
                              Last updated: {new Date(item.updatedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-xl border-border/60 bg-background/80 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 shadow-sm"
                              onClick={() => setKnowledgeForm({
                                id: item.id,
                                type: item.type,
                                title: item.title,
                                content: item.content,
                              })}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-xl border-border/60 bg-background/80 text-muted-foreground hover:text-red-600 hover:border-red-500/40 hover:bg-red-50 shadow-sm"
                              onClick={() => deleteKnowledge(item.id)}
                            >
                              <Trash className="h-4 w-4" />
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
      <Card variant="majestic" className="overflow-hidden border-border/40 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/10 bg-gradient-to-r from-primary/5 via-indigo-500/5 to-cyan-500/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">Project Modules</CardTitle>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                Organize your test cases into functional areas.
              </p>
            </div>
            <Button
              onClick={onCreateModule}
              size="sm"
              disabled={!selectedProject}
              className="gap-1.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 text-foreground font-bold text-[10px] uppercase border border-border/50 shadow-sm transition-all duration-200"
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
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/30 pl-4 pr-2 py-2.5 hover:bg-secondary/50 hover:border-primary/30 transition-all duration-200 group/mod"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background/50 text-muted-foreground group-hover/mod:text-primary transition-colors">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{module.name}</p>
                      <p className="text-[9px] font-black text-muted-foreground/60 uppercase">{module._count?.testCases || 0} Cases</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground/40 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 opacity-0 group-hover/mod:opacity-100 transition-all"
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
    </motion.div>
  );
}
