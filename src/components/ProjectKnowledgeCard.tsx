'use client';

import { Edit3, FolderOpen, Layers, Link, Loader2, Plus, RefreshCw, Save, Trash, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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

const EMPTY_KNOWLEDGE_FORM = { id: '', type: 'QA_RULES', title: '', content: '' };

type ProjectKnowledgeCardProps = Record<string, any> & {
  mode?: 'knowledge' | 'integrations';
};

export function ProjectKnowledgeCard(props: ProjectKnowledgeCardProps) {
  const {
    selectedProject, setKnowledgeForm, knowledgeForm, knowledgeItems, knowledgeLoading,
    setKnowledgeFile, knowledgeFile, uploadKnowledgeFile, knowledgeUploading,
    figmaUrl, setFigmaUrl, figmaDepth, setFigmaDepth, syncFigmaKnowledge,
    figmaSyncing, figmaSyncMessage, saveKnowledge, knowledgeSaving, deleteKnowledge, knowledgeMessage,
    mode = 'knowledge',
  } = props;

  if (mode === 'integrations') {
    return (
      <Card variant="majestic" className="overflow-hidden border-border/40 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Integrations
          </CardTitle>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
            Hubungkan sumber eksternal untuk memperkaya konteks QA project.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {!selectedProject ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 rounded-full bg-secondary/50 p-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold text-muted-foreground">Pilih project terlebih dahulu untuk mengatur integrasi.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 shadow-inner">
              <div className="flex flex-col gap-4">
                <div className="min-w-0 space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Figma Synchronization</Label>
                  <p className="text-[10px] font-medium leading-relaxed text-muted-foreground">
                    Ambil frame dan teks sebagai Feature Map knowledge secara otomatis.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_80px_auto]">
                  <Input
                    value={figmaUrl}
                    onChange={(event) => setFigmaUrl(event.target.value)}
                    placeholder="Tempel URL atau key file Figma"
                    className="h-9 rounded-xl border-border/60 bg-secondary/40 text-[11px] font-medium"
                  />
                  <Select value={figmaDepth} onValueChange={setFigmaDepth}>
                    <SelectTrigger className="h-9 rounded-xl border-border/60 bg-secondary/40 text-[11px] font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60 bg-card shadow-xl">
                      {['1', '2', '3', '4', '5', '6'].map(depth => <SelectItem key={depth} value={depth} className="text-xs">{depth}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={syncFigmaKnowledge}
                    disabled={!figmaUrl.trim() || figmaSyncing}
                    title={!figmaUrl.trim() ? 'Masukkan URL atau key Figma terlebih dahulu.' : undefined}
                    className="h-9 gap-1.5 rounded-xl bg-gradient-to-r from-primary to-cyan-500 px-4 text-[10px] font-bold uppercase text-white"
                  >
                    {figmaSyncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Link className="h-3.5 w-3.5" />}
                    Sinkronkan
                  </Button>
                </div>
                {figmaSyncMessage && <p className="text-[10px] font-bold text-primary" role="status">{figmaSyncMessage}</p>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
      <Card variant="majestic" className="overflow-hidden border-border/40 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">Project Knowledge</CardTitle>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                Context for QA Copilot intelligence.
              </p>
            </div>
            <Button
              onClick={() => setKnowledgeForm(EMPTY_KNOWLEDGE_FORM)}
              size="sm"
              disabled={!selectedProject}
              className="gap-1.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 text-foreground font-bold text-[10px] uppercase border border-border/50 shadow-sm transition duration-200"
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
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Kategori Tipe</Label>
                  <Select
                    value={knowledgeForm.type}
                    onValueChange={(value) => setKnowledgeForm(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus:ring-primary/20 focus:border-primary transition duration-200"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-border/60 bg-card rounded-xl shadow-2xl">
                      {KNOWLEDGE_TYPE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value} className="rounded-lg py-2">{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Judul Knowledge</Label>
                  <Input
                    value={knowledgeForm.title}
                    onChange={(event) => setKnowledgeForm(prev => ({ ...prev, title: event.target.value }))}
                    placeholder="contoh: POS Session API, QA Rules Servios"
                    className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/20 focus-visible:border-primary transition duration-200"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Isi Knowledge (Context)</Label>
                <Textarea
                  value={knowledgeForm.content}
                  onChange={(event) => setKnowledgeForm(prev => ({ ...prev, content: event.target.value }))}
                  placeholder="Paste API docs, feature map, aturan QA, atau catatan testing..."
                  className="h-40 max-h-[480px] overflow-y-auto rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/20 focus-visible:border-primary transition duration-200 resize-y [field-sizing:fixed] scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent p-4"
                />
              </div>

              <div>
                <div className="rounded-2xl border border-border/40 bg-secondary/20 p-5 shadow-inner">
                  <div className="flex flex-col gap-4">
                    <div className="min-w-0">
                      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manual Upload</Label>
                      <p className="mt-1 text-[10px] text-muted-foreground font-medium">
                        Dukung format JSON, TXT, MD, CSV, DOCX, dan PDF.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Input
                        type="file"
                        accept=".json,.txt,.md,.markdown,.csv,.docx,.pdf,.log,.yaml,.yml"
                        className="h-9 rounded-xl border-border/60 bg-secondary/40 text-[11px] font-medium text-muted-foreground file:mr-3 file:bg-primary file:rounded-lg file:border-0 file:px-3 file:py-1 file:text-[9px] file:font-semibold file:uppercase file:text-white transition duration-200"
                        onChange={(event) => setKnowledgeFile(event.target.files?.[0] || null)}
                      />
                      <Button
                        type="button"
                        onClick={uploadKnowledgeFile}
                        disabled={!knowledgeFile || knowledgeUploading}
                        className="h-9 gap-1.5 rounded-xl bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-bold shadow-md hover:shadow-cyan-500/20 transition duration-200 text-[10px] uppercase px-4"
                      >
                        {knowledgeUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        Upload
                      </Button>
                    </div>
                    {knowledgeFile && (
                      <p className="truncate text-[10px] font-semibold text-primary uppercase tracking-tight bg-primary/10 px-2 py-1 rounded-md w-fit">
                        Selected: {knowledgeFile.name}
                      </p>
                    )}
                  </div>
                </div>

              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={saveKnowledge}
                  disabled={knowledgeSaving || !knowledgeForm.title.trim() || !knowledgeForm.content.trim()}
                  className="h-11 gap-2 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-cyan-600 hover:from-primary/90 hover:via-indigo-600/90 hover:to-cyan-600/90 text-white font-bold shadow-lg hover:shadow-primary/20 transition duration-300 text-[11px] uppercase px-6"
                >
                  <Save className="h-4 w-4" />
                  {knowledgeForm.id ? 'Update Project Knowledge' : 'Simpan Knowledge'}
                </Button>
                {knowledgeForm.id && (
                  <Button variant="outline" onClick={() => setKnowledgeForm(EMPTY_KNOWLEDGE_FORM)} className="h-11 rounded-xl border-border/60 text-muted-foreground font-bold hover:text-foreground hover:bg-secondary/80 transition duration-200 px-6">
                    Batal
                  </Button>
                )}
              </div>
              {knowledgeMessage && <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-foreground" role="status">{knowledgeMessage}</p>}

              <div className="border-t border-border/10 pt-8 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stored Knowledge Base</p>
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
                        className="rounded-2xl border border-border/50 bg-secondary/20 p-5 hover:border-primary/30 hover:bg-secondary/40 hover:shadow-md transition duration-300 group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-start justify-between gap-4 relative z-10">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
                              <Badge variant="outline" className="rounded-lg bg-background/50 border-border/40 text-primary text-[9px] font-semibold uppercase tracking-tight py-0.5">
                                {KNOWLEDGE_TYPE_OPTIONS.find(option => option.value === item.type)?.label || item.type}
                              </Badge>
                              <p className="font-bold text-foreground text-sm truncate">{item.title}</p>
                            </div>
                            <p className="line-clamp-3 text-[11px] text-muted-foreground font-medium leading-relaxed group-hover:text-foreground/80 transition-colors">{item.content}</p>
                            <p className="mt-3 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-tighter">
                              Terakhir diperbarui: {new Date(item.updatedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 opacity-100 transition duration-300 sm:translate-x-2 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100">
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 rounded-xl border-border/60 bg-background/80 text-muted-foreground hover:border-red-500/40 hover:bg-red-50 hover:text-red-600 shadow-sm"
                                  aria-label={`Hapus knowledge ${item.title}`}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus knowledge?</AlertDialogTitle>
                                  <AlertDialogDescription>Knowledge “{item.title}” akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteKnowledge(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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


  );
}
