import { DashboardPanel } from '@/components/DashboardPanel';
import { TestCaseTable } from '@/components/TestCaseTable';
import { BugFixPanel } from '@/components/BugFixPanel';
import { AutomatedPanel } from '@/components/AutomatedPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { FEATURES } from '@/lib/features';

type WorkspaceViewProps = Record<string, any>;

export function buildWorkspaceViews(props: WorkspaceViewProps) {
  const { activeTab, stats, modules, expandedModules, setExpandedModules, selectedModuleFilter, setSelectedModuleFilter,
handleOpenDetail, handleModuleRiskClick, isLoadingStats, lastRefreshed, loadStats, loadTestCases,
selectedProject, testCaseFilterModules, hasUnassignedTestCases, testCases, search, filterStatus, filterTestType,
filterPriority, filterModule, filterSubMenu, subMenuOptions, selectedIds, page, limit, total, totalPages,
filterTestRun, setFilterTestRun, filterBug, setFilterBug, filterTag, setFilterTag, filterCreatedFrom, setFilterCreatedFrom, filterCreatedTo, setFilterCreatedTo, testRunOptions,
testRecordById, fileInputRef, setSearch, setFilterStatus, setFilterTestType, setFilterPriority, setFilterModule,
 setFilterSubMenu, setPage, setLimit, setShowBulkAction, setShowBulkExecution, setShowBulkAssign, setShowDeleteConfirm, openCreateDialog, openAIDialog,
setShowImportDialog, handleImportExcel, handleExportExcel, isLoadingTestCases, handleQuickStatusChange,
toggleSelectAll, toggleSelect, toggleSort, openEditDialog, handleDuplicate, setEditingTestCase,
getStatusColor, getStatusIcon, getStatusBadgeVariant, getPriorityColor, getTestTypeColor,
bugFixFilterModules, hasUnassignedBugFixItems, visibleBugFixItems, bugFixSearch, bugFixFilterStatus,
bugFixFilterModule, bugFixTab, setBugFixSearch, setBugFixFilterStatus, setBugFixFilterModule, setBugFixTab,
handleBugFixStatusChange, openBugFixDetail, automatedItems, automatedSearch, automatedFilterModule,
automatedLoading, setAutomatedSearch, setAutomatedFilterModule, loadAutomated, visibleAutomatedItems,
projects, setSelectedProject, setShowCreateProject, setShowCreateModule, handleDeleteProject, handleDeleteModule } = props;
  // ============== RENDER: DASHBOARD ==============
  const renderDashboard = () => (
    <DashboardPanel
      stats={stats}
      modules={modules}
      expandedModules={expandedModules}
      setExpandedModules={setExpandedModules}
      selectedModuleFilter={selectedModuleFilter}
      setSelectedModuleFilter={setSelectedModuleFilter}
      onOpenDetail={handleOpenDetail}
      onModuleRiskClick={handleModuleRiskClick}
      onNavigate={(tab) => props.setActiveTab?.(tab)}
      isLoading={isLoadingStats}
      lastRefreshed={lastRefreshed}
      onRefresh={() => { loadStats(selectedProject); loadTestCases(selectedProject); }}
    />
  );
  // ============== RENDER: TEST CASE TABLE ==============
  const renderTestCases = () => (
    <TestCaseTable
      selectedProject={selectedProject}
      modules={testCaseFilterModules}
      hasUnassignedModule={hasUnassignedTestCases}
      testCases={testCases}
      search={search}
      filterStatus={filterStatus}
      filterTestType={filterTestType}
      filterPriority={filterPriority}
      filterModule={filterModule}
      filterSubMenu={filterSubMenu}
      filterTestRun={filterTestRun}
      setFilterTestRun={setFilterTestRun}
      filterBug={filterBug}
      setFilterBug={setFilterBug}
      filterTag={filterTag}
      setFilterTag={setFilterTag}
      filterCreatedFrom={filterCreatedFrom}
      setFilterCreatedFrom={setFilterCreatedFrom}
      filterCreatedTo={filterCreatedTo}
      setFilterCreatedTo={setFilterCreatedTo}
      testRunOptions={testRunOptions}
      subMenuOptions={subMenuOptions}
      selectedIds={selectedIds}
      page={page}
      limit={limit}
      total={total}
      totalPages={totalPages}
      testRecordById={testRecordById}
      fileInputRef={fileInputRef}
      aiEnabled={FEATURES.aiTestcaseFlows}
      setSearch={setSearch}
      setFilterStatus={setFilterStatus}
      setFilterTestType={setFilterTestType}
      setFilterPriority={setFilterPriority}
      setFilterModule={setFilterModule}
      setFilterSubMenu={setFilterSubMenu}
      setPage={setPage}
      setLimit={setLimit}
      setShowBulkAction={setShowBulkAction}
      setShowBulkExecution={setShowBulkExecution}
      setShowBulkAssign={setShowBulkAssign}
      setShowDeleteConfirm={setShowDeleteConfirm}
      openCreateDialog={openCreateDialog}
      openAIDialog={FEATURES.aiTestcaseFlows ? openAIDialog : () => {}}
      openImportDialog={() => setShowImportDialog(true)}
      handleImportExcel={handleImportExcel}
      handleExportExcel={handleExportExcel}
      isLoading={isLoadingTestCases}
      onQuickStatusChange={handleQuickStatusChange}
      refreshList={() => { if (selectedProject) { loadTestCases(selectedProject); loadStats(selectedProject); } }}
      toggleSelectAll={toggleSelectAll}
      toggleSelect={toggleSelect}
      toggleSort={toggleSort}
      openViewDialog={(tc) => handleOpenDetail(tc, testCases)}
      openEditDialog={openEditDialog}
      handleDuplicate={handleDuplicate}
      requestDelete={(tc) => { setEditingTestCase(tc); setShowDeleteConfirm(true); }}
      getStatusColor={getStatusColor}
      getStatusIcon={getStatusIcon}
      getStatusBadgeVariant={getStatusBadgeVariant}
      getPriorityColor={getPriorityColor}
      getTestTypeColor={getTestTypeColor}
    />
  );

  // ============== RENDER: BUGFIX ==============
  const renderBugFix = () => (
    <BugFixPanel
      selectedProject={selectedProject}
      modules={bugFixFilterModules}
      hasUnassignedModule={hasUnassignedBugFixItems}
      stats={stats}
      visibleBugFixItems={visibleBugFixItems}
      bugFixSearch={bugFixSearch}
      bugFixFilterStatus={bugFixFilterStatus}
      bugFixFilterModule={bugFixFilterModule}
      bugFixTab={bugFixTab}
      setBugFixSearch={setBugFixSearch}
      setBugFixFilterStatus={setBugFixFilterStatus}
      setBugFixFilterModule={setBugFixFilterModule}
      setBugFixTab={setBugFixTab}
      getPriorityColor={getPriorityColor}
      onStatusChange={handleBugFixStatusChange}
      onOpenDetail={openBugFixDetail}
    />
  );

  // ============== RENDER: TEST RECORDS ==============
  const renderAutomated = () => (
    <AutomatedPanel
      selectedProject={selectedProject}
      modules={modules}
      items={automatedItems}
      search={automatedSearch}
      filterModule={automatedFilterModule}
      loading={automatedLoading}
      setSearch={setAutomatedSearch}
      setFilterModule={setAutomatedFilterModule}
      onRefresh={() => loadAutomated(selectedProject)}
      onOpenDetail={(tc) => handleOpenDetail(tc, visibleAutomatedItems)}
      getStatusColor={getStatusColor}
      getStatusIcon={getStatusIcon}
      getStatusBadgeVariant={getStatusBadgeVariant}
      getPriorityColor={getPriorityColor}
      getTestTypeColor={getTestTypeColor}
    />
  );

  // ============== RENDER: PROJECT & MODULE MANAGEMENT ==============
  const renderSettings = () => (
    <SettingsPanel
      projects={projects}
      modules={modules}
      selectedProject={selectedProject}
      setSelectedProject={setSelectedProject}
      onCreateProject={() => setShowCreateProject(true)}
      onCreateModule={() => setShowCreateModule(true)}
      onDeleteProject={handleDeleteProject}
      onDeleteModule={handleDeleteModule}
    />
  );


  return {
    dashboard: renderDashboard(),
    testcases: renderTestCases(),
    bugfix: renderBugFix(),
    automated: renderAutomated(),
    settings: renderSettings(),
  };
}
