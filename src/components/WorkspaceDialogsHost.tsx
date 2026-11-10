'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FEATURES } from '@/lib/features';
import {
  getPriorityColor,
  getStatusBadgeVariant,
  getStatusColor,
  getStatusIcon,
  getTestTypeColor,
} from '@/lib/client/workspace-formatters';

const ProjectModuleDialogs = dynamic(() => import('@/components/ProjectModuleDialogs').then(module => module.ProjectModuleDialogs));
const TestCaseDialog = dynamic(() => import('@/components/TestCaseDialog').then(module => module.TestCaseDialog));
const TestCaseDetailDialog = dynamic(() => import('@/components/TestCaseDetailDialog').then(module => module.TestCaseDetailDialog));
const AIRefineDialog = dynamic(() => import('@/components/AIRefineDialog').then(module => module.AIRefineDialog));
const BulkStatusDialog = dynamic(() => import('@/components/BulkStatusDialog').then(module => module.BulkStatusDialog));
const BulkExecutionDialog = dynamic(() => import('@/components/BulkExecutionDialog').then(module => module.BulkExecutionDialog));
const BulkAssignDialog = dynamic(() => import('@/components/BulkAssignDialog').then(module => module.BulkAssignDialog));
const ImportExcelDialog = dynamic(() => import('@/components/ImportExcelDialog').then(module => module.ImportExcelDialog));
const AIGenerateDialog = dynamic(() => import('@/components/AIGenerateDialog').then(module => module.AIGenerateDialog));
const FloatingAIChat = dynamic(() => import('@/components/FloatingAIChat').then(module => module.FloatingAIChat), { ssr: false });

export function WorkspaceDialogsHost(props: Record<string, any>) {
  const {
    access,
    selectedProject,
    selectedProjectName,
    modules,
    showCreateProject,
    showCreateModule,
    newProjectName,
    newProjectDesc,
    newModuleName,
    setShowCreateProject,
    setShowCreateModule,
    setNewProjectName,
    setNewProjectDesc,
    setNewModuleName,
    handleCreateProject,
    handleCreateModule,
    showTestCaseDialog,
    setShowTestCaseDialog,
    setDraftTestCase,
    editingTestCase,
    draftTestCase,
    loadAll,
    viewTestCase,
    showDetailDialog,
    setShowDetailDialog,
    socketReady,
    liveLogs,
    activeDevLogTab,
    expandedLogId,
    isLoadingHistory,
    loadedRunLabel,
    aiSummary,
    isSummarizing,
    manualCaptureTargetUrl,
    manualCaptureSessionId,
    manualRecording,
    isManualCaptureActive,
    isStartingManualCapture,
    isStoppingManualCapture,
    isProcessingManualRecording,
    logEndRef,
    setManualCaptureTargetUrl,
    setActiveDevLogTab,
    setExpandedLogId,
    setAiSummary,
    clearLogs,
    startManualCapture,
    stopManualCapture,
    loadCurrentLogRun,
    generateAISummary,
    loadLogHistory,
    filterConsoleLogs,
    openEditDialog,
    openAIRefineDialog,
    toast,
    navigationContextList,
    handleNavigate,
    showAIRefineDialog,
    setShowAIRefineDialog,
    setAiRefinedCase,
    setRefiningTestCase,
    refiningTestCase,
    aiRefinedCase,
    aiRefining,
    aiRefineSaving,
    handleAIRefine,
    handleApplyAIRefinement,
    showDeleteConfirm,
    setShowDeleteConfirm,
    selectedIds,
    handleBulkDelete,
    handleDeleteTestCase,
    showBulkAction,
    bulkStatus,
    setShowBulkAction,
    setBulkStatus,
    handleBulkStatusUpdate,
    showBulkExecution,
    testRunOptions,
    bulkExecutionRun,
    bulkExecutionStatus,
    bulkExecutionTester,
    setShowBulkExecution,
    setBulkExecutionRun,
    setBulkExecutionStatus,
    setBulkExecutionTester,
    handleBulkExecution,
    showBulkAssign,
    bulkAssignRun,
    bulkAssignee,
    setShowBulkAssign,
    setBulkAssignRun,
    setBulkAssignee,
    handleBulkAssign,
    showImportDialog,
    setShowImportDialog,
    resetImportPreview,
    importCreateModules,
    setImportCreateModules,
    importing,
    previewingImport,
    selectedImportFile,
    importPreview,
    fileInputRef,
    handleConfirmImportExcel,
    lastImportBatchId,
    handleUndoImport,
    handleImportMappingChange,
    showAIDialog,
    setShowAIDialog,
    setAiGeneratedCases,
    setAiSelectedCases,
    aiGenerating,
    aiGeneratedCases,
    aiSelectedCases,
    aiSaving,
    handleAIGenerate,
    handleAISaveSelected,
    toggleAISelectAll,
    toggleAISelect,
    openTestCaseFromChat,
    openDraftCreateDialog,
  } = props;

  return (
    <>
      {(showCreateProject || showCreateModule) && (
        <ProjectModuleDialogs
          showCreateProject={showCreateProject}
          showCreateModule={showCreateModule}
          newProjectName={newProjectName}
          newProjectDesc={newProjectDesc}
          newModuleName={newModuleName}
          setShowCreateProject={setShowCreateProject}
          setShowCreateModule={setShowCreateModule}
          setNewProjectName={setNewProjectName}
          setNewProjectDesc={setNewProjectDesc}
          setNewModuleName={setNewModuleName}
          onCreateProject={handleCreateProject}
          onCreateModule={handleCreateModule}
        />
      )}

      {access.canEdit && showTestCaseDialog && (
        <TestCaseDialog
          open={showTestCaseDialog}
          onOpenChange={(open) => {
            setShowTestCaseDialog(open);
            if (!open) setDraftTestCase(null);
          }}
          editingTestCase={editingTestCase}
          initialTestCase={draftTestCase}
          selectedProject={selectedProject}
          modules={modules}
          onSaveSuccess={() => loadAll(selectedProject)}
        />
      )}

      {viewTestCase?.projectId === selectedProject && (
        <TestCaseDetailDialog
          open={showDetailDialog}
          onOpenChange={setShowDetailDialog}
          viewTestCase={viewTestCase}
          socketReady={socketReady}
          liveLogs={liveLogs}
          activeDevLogTab={activeDevLogTab}
          expandedLogId={expandedLogId}
          isLoadingHistory={isLoadingHistory}
          loadedRunLabel={loadedRunLabel}
          aiSummary={aiSummary}
          isSummarizing={isSummarizing}
          manualCaptureTargetUrl={manualCaptureTargetUrl}
          manualCaptureSessionId={manualCaptureSessionId}
          manualRecording={manualRecording}
          isManualCaptureActive={isManualCaptureActive}
          isStartingManualCapture={isStartingManualCapture}
          isStoppingManualCapture={isStoppingManualCapture}
          isProcessingManualRecording={isProcessingManualRecording}
          logEndRef={logEndRef}
          setManualCaptureTargetUrl={setManualCaptureTargetUrl}
          setActiveDevLogTab={setActiveDevLogTab}
          setExpandedLogId={setExpandedLogId}
          setAiSummary={setAiSummary}
          clearLogs={clearLogs}
          startManualCapture={startManualCapture}
          stopManualCapture={stopManualCapture}
          loadCurrentLogRun={loadCurrentLogRun}
          generateAISummary={generateAISummary}
          loadLogHistory={loadLogHistory}
          filterConsoleLogs={filterConsoleLogs}
          getStatusColor={getStatusColor}
          getStatusIcon={getStatusIcon}
          getStatusBadgeVariant={getStatusBadgeVariant}
          getTestTypeColor={getTestTypeColor}
          getPriorityColor={getPriorityColor}
          onEdit={openEditDialog}
          onRefine={FEATURES.aiTestcaseFlows ? openAIRefineDialog : undefined}
          onCopyId={(id) => {
            navigator.clipboard.writeText(id);
            toast({ variant: 'success', title: 'ID Disalin', description: 'Internal ID berhasil disalin untuk Katalon.' });
          }}
          testCaseList={navigationContextList ?? []}
          onNavigate={handleNavigate}
        />
      )}

      {FEATURES.aiTestcaseFlows && showAIRefineDialog && (
        <AIRefineDialog
          open={showAIRefineDialog}
          onOpenChange={(open) => {
            setShowAIRefineDialog(open);
            if (!open) {
              setAiRefinedCase(null);
              setRefiningTestCase(null);
            }
          }}
          testCase={refiningTestCase}
          refinedCase={aiRefinedCase}
          refining={aiRefining}
          saving={aiRefineSaving}
          onRefine={handleAIRefine}
          onApply={handleApplyAIRefinement}
          onReset={() => setAiRefinedCase(null)}
          getPriorityColor={getPriorityColor}
          getTestTypeColor={getTestTypeColor}
        />
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Test Case?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size > 0
                ? `${selectedIds.size} test case yang dipilih akan dihapus. Tindakan ini tidak bisa dibatalkan.`
                : 'Test case ini akan dihapus. Tindakan ini tidak bisa dibatalkan.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedIds.size > 0) handleBulkDelete();
                else if (editingTestCase) handleDeleteTestCase(editingTestCase.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showBulkAction && (
        <BulkStatusDialog
          open={showBulkAction}
          selectedCount={selectedIds.size}
          bulkStatus={bulkStatus}
          onOpenChange={setShowBulkAction}
          setBulkStatus={setBulkStatus}
          onSubmit={handleBulkStatusUpdate}
        />
      )}

      {showBulkExecution && (
        <BulkExecutionDialog
          open={showBulkExecution}
          selectedCount={selectedIds.size}
          testRuns={testRunOptions}
          testRunId={bulkExecutionRun}
          status={bulkExecutionStatus}
          tester={bulkExecutionTester}
          onOpenChange={setShowBulkExecution}
          onTestRunChange={setBulkExecutionRun}
          onStatusChange={setBulkExecutionStatus}
          onTesterChange={setBulkExecutionTester}
          onSubmit={handleBulkExecution}
        />
      )}

      {showBulkAssign && (
        <BulkAssignDialog
          open={showBulkAssign}
          selectedCount={selectedIds.size}
          testRuns={testRunOptions}
          testRunId={bulkAssignRun}
          assignee={bulkAssignee}
          onOpenChange={setShowBulkAssign}
          onTestRunChange={setBulkAssignRun}
          onAssigneeChange={setBulkAssignee}
          onSubmit={handleBulkAssign}
        />
      )}

      {showImportDialog && (
        <ImportExcelDialog
          open={showImportDialog}
          onOpenChange={(open) => {
            setShowImportDialog(open);
            if (!open) resetImportPreview();
          }}
          createModules={importCreateModules}
          onCreateModulesChange={setImportCreateModules}
          importing={importing}
          previewing={previewingImport}
          selectedFileName={selectedImportFile?.name || ''}
          importPreview={importPreview}
          fileInputRef={fileInputRef}
          onChooseFile={() => fileInputRef.current?.click()}
          onConfirmImport={handleConfirmImportExcel}
          lastImportBatchId={lastImportBatchId}
          onUndoImport={handleUndoImport}
          onMappingChange={handleImportMappingChange}
          onClearPreview={resetImportPreview}
        />
      )}

      {access.canEdit && FEATURES.aiTestcaseFlows && (
        <>
          {showAIDialog && (
            <AIGenerateDialog
              open={showAIDialog}
              onOpenChange={(open) => {
                setShowAIDialog(open);
                if (!open) {
                  setAiGeneratedCases([]);
                  setAiSelectedCases(new Set());
                }
              }}
              projectId={selectedProject}
              modules={modules}
              aiGenerating={aiGenerating}
              aiGeneratedCases={aiGeneratedCases}
              aiSelectedCases={aiSelectedCases}
              aiSaving={aiSaving}
              handleAIGenerate={handleAIGenerate}
              handleAISaveSelected={handleAISaveSelected}
              toggleAISelectAll={toggleAISelectAll}
              toggleAISelect={toggleAISelect}
              resetGeneratedCases={() => {
                setAiGeneratedCases([]);
                setAiSelectedCases(new Set());
              }}
              getTestTypeColor={getTestTypeColor}
              getPriorityColor={getPriorityColor}
            />
          )}

          <FloatingAIChat
            projectId={selectedProject}
            projectName={selectedProjectName}
            selectedTestCase={viewTestCase?.projectId === selectedProject ? viewTestCase : null}
            onOpenTestCaseId={openTestCaseFromChat}
            onCreateTestCaseDraft={openDraftCreateDialog}
          />
        </>
      )}
    </>
  );
}
