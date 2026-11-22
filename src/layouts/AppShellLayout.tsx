import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  FolderKanban,
  BookOpen,
  LineChart,
  History,
  FileSpreadsheet,
  Users,
  Bell,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  FlaskConical,
  KeyRound,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NavTab, PriorityLevel } from '../types';

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.FC<{ className?: string }>;
  group: 'Core Execution' | 'Intelligence & Archive' | 'Workspace';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Core Execution' },
  { id: 'planner', label: 'Daily Planner', icon: Calendar, group: 'Core Execution' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, group: 'Core Execution' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, group: 'Core Execution' },
  { id: 'journal', label: 'Work Journal', icon: BookOpen, group: 'Core Execution' },
  { id: 'analyst', label: 'Analyst Desk', icon: LineChart, group: 'Intelligence & Archive' },
  { id: 'track-record', label: 'Track Record', icon: History, group: 'Intelligence & Archive' },
  { id: 'reports', label: 'Analytics & Reports', icon: FileSpreadsheet, group: 'Intelligence & Archive' },
  { id: 'team', label: 'Team Workspace', icon: Users, group: 'Workspace' },
  { id: 'notifications', label: 'Notifications', icon: Bell, group: 'Workspace' },
  { id: 'settings', label: 'Settings & Integrations', icon: Settings, group: 'Workspace' },
];

export const AppShellLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    userProfile,
    isDemoMode,
    theme,
    toggleTheme,
    activeTab,
    setActiveTab,
    workspaces,
    currentWorkspace,
    setCurrentWorkspaceId,
    notifications,
    globalSearchQuery,
    setGlobalSearchQuery,
    logout,
    createTask,
    createProject,
    createJournalEntry,
    createAnalysisRecord,
    createPlannerActivity,
  } = useApp();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<
    'task' | 'planner' | 'project' | 'journal' | 'analysis'
  >('task');

  const [qcTitle, setQcTitle] = useState('');
  const [qcDescription, setQcDescription] = useState('');
  const [qcPriority, setQcPriority] = useState<PriorityLevel>('High');
  const [qcDate, setQcDate] = useState(new Date().toISOString().split('T')[0]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleQuickCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcTitle.trim()) return;

    if (quickCreateType === 'task') {
      await createTask({
        title: qcTitle.trim(),
        description: qcDescription.trim(),
        projectId: '',
        projectName: '',
        assignedTo: userProfile?.id || '',
        assignedToName: userProfile?.displayName || 'Workspace Owner',
        startDate: qcDate,
        dueDate: qcDate,
        priority: qcPriority,
        status: 'Not Started',
        estimatedHours: 2,
        actualHours: 0,
        tags: ['quick-create'],
        checklistSummary: '0/0',
        completionDate: '',
        isArchived: false,
      });
      setActiveTab('tasks');
    } else if (quickCreateType === 'planner') {
      await createPlannerActivity({
        title: qcTitle.trim(),
        description: qcDescription.trim(),
        startDate: qcDate,
        endDate: qcDate,
        startTime: '09:30',
        endTime: '11:00',
        priority: qcPriority,
        category: 'Work',
        projectId: '',
        projectName: '',
        reminderMinutes: 15,
        recurrence: 'None',
        completed: false,
        isArchived: false,
      });
      setActiveTab('planner');
    } else if (quickCreateType === 'project') {
      await createProject({
        name: qcTitle.trim(),
        description: qcDescription.trim(),
        startDate: qcDate,
        targetDeadline: qcDate,
        status: 'Active',
        priority: qcPriority,
        notes: '',
      });
      setActiveTab('projects');
    } else if (quickCreateType === 'journal') {
      await createJournalEntry({
        title: qcTitle.trim(),
        entryDate: qcDate,
        entryTime: '17:00',
        category: 'Engineering',
        projectId: '',
        projectName: '',
        relatedTaskId: '',
        relatedTaskTitle: '',
        description: qcDescription.trim(),
        activitiesPerformed: '',
        achievements: '',
        challenges: '',
        decisionsMade: '',
        lessonsLearned: '',
        nextSteps: '',
        timeSpentHours: 2,
        tags: ['daily-log'],
        visibility: 'Private',
        isArchived: false,
      });
      setActiveTab('journal');
    } else if (quickCreateType === 'analysis') {
      await createAnalysisRecord({
        title: qcTitle.trim(),
        category: 'Business Analysis',
        analysisDate: qcDate,
        projectId: '',
        projectName: '',
        objective: qcDescription.trim(),
        problemStatement: '',
        datasetDescription: '',
        methodology: '',
        observations: '',
        keyFindings: '',
        risksAndAssumptions: '',
        conclusion: '',
        recommendations: '',
        expectedOutcome: '',
        actualOutcome: '',
        confidenceLevel: 'High',
        status: 'In Review',
        supportingLinks: '',
        relatedTaskId: '',
        stockSymbol: '',
        exchange: '',
        timeframe: '',
        marketTrend: '',
        technicalObservations: '',
        supportAndResistance: '',
        indicatorsUsed: '',
        tradingThesis: '',
        entryExitAssumptions: '',
        stopLossAssumption: '',
        targetAssumption: '',
        riskRewardRatio: '',
        actualResult: '',
        lessonsLearned: '',
        isArchived: false,
      });
      setActiveTab('analyst');
    }

    setQcTitle('');
    setQcDescription('');
    setQuickCreateOpen(false);
  };

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-300 select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
            WM
          </div>
          {(!sidebarCollapsed || isMobile) && (
            <div className="truncate">
              <div className="text-sm font-bold text-white tracking-tight leading-none">
                WhimsyMaya
              </div>
              <div className="text-[10px] font-mono text-indigo-400 tracking-wider uppercase mt-0.5">
                Plan · Record · Analyse
              </div>
            </div>
          )}
        </div>

        {!isMobile ? (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        ) : (
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Workspace Switcher */}
      <div className="p-3 border-b border-slate-800/80">
        {(!sidebarCollapsed || isMobile) && (
          <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5 px-1">
            Active Workspace
          </label>
        )}
        <select
          value={currentWorkspace?.id || ''}
          onChange={(e) => setCurrentWorkspaceId(e.target.value)}
          className="w-full px-2.5 py-2 text-xs font-medium bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          title="Switch Personal or Team Workspace"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.type === 'personal' ? '🔒 ' : '👥 '}
              {ws.name} ({ws.type})
            </option>
          ))}
        </select>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
        {(['Core Execution', 'Intelligence & Archive', 'Workspace'] as const).map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          return (
            <div key={group} className="space-y-1">
              {(!sidebarCollapsed || isMobile) && (
                <div className="px-2.5 pb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  {group}
                </div>
              )}
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (isMobile) setMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                    title={item.label}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-indigo-400' : 'text-slate-400'
                        }`}
                      />
                      {(!sidebarCollapsed || isMobile) && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </div>

                    {(!sidebarCollapsed || isMobile) &&
                      item.id === 'notifications' &&
                      unreadCount > 0 && (
                        <span className="font-mono text-[11px] font-bold text-indigo-400">
                          {unreadCount}
                        </span>
                      )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
              {(userProfile?.displayName || 'U').slice(0, 2).toUpperCase()}
            </div>
            {(!sidebarCollapsed || isMobile) && (
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">
                  {userProfile?.displayName}
                </div>
                <div className="text-[10px] font-mono text-amber-400 truncate">
                  {isDemoMode ? 'DEMO DATA PREVIEW' : userProfile?.email}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title={isDemoMode ? 'View Authentication Screen' : 'Sign Out'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Fixed Collapsible Sidebar */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-200 border-r border-slate-800 ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderSidebarContent(false)}</div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-full h-full z-10">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Development & Demo Data Disclosure Banner */}
        {isDemoMode && (
          <div className="bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/30 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-medium">
              <FlaskConical className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Development & Preview Mode (Demo Data):</strong> You are exploring isolated demo records. No external API keys or credentials are required now.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('settings')}
                className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" />
                Future Integrations Setup
              </button>
              <button
                onClick={logout}
                className="font-mono text-[11px] text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
              >
                View Login Screen
              </button>
            </div>
          </div>
        )}

        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
              <span>{currentWorkspace?.name}</span>
              <span>/</span>
              <span className="text-slate-900 dark:text-white font-semibold capitalize">
                {activeTab.replace('-', ' ')}
              </span>
              {isDemoMode && (
                <span className="ml-2 text-[11px] font-mono text-amber-600 dark:text-amber-400">
                  [DEMO DATA]
                </span>
              )}
            </div>
          </div>

          {/* Global Search & Contextual Actions */}
          <div className="flex items-center gap-2.5 flex-1 max-w-xl justify-end">
            <div className="relative flex-1 max-w-xs hidden sm:block">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => {
                  setGlobalSearchQuery(e.target.value);
                  if (e.target.value.trim() && activeTab !== 'track-record') {
                    setActiveTab('track-record');
                  }
                }}
                placeholder="Global archive search..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => setQuickCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Quick Create</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-600" />
              )}
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Universal Quick-Create Modal */}
      {quickCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Quick Create in {currentWorkspace?.name}
              </h3>
              <button
                onClick={() => setQuickCreateOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'task', label: 'Task' },
                  { id: 'planner', label: 'Planner Block' },
                  { id: 'project', label: 'Project' },
                  { id: 'journal', label: 'Journal Entry' },
                  { id: 'analysis', label: 'Analysis Record' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setQuickCreateType(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                    quickCreateType === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleQuickCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={qcTitle}
                  onChange={(e) => setQcTitle(e.target.value)}
                  placeholder={`Enter ${quickCreateType} title...`}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={3}
                  value={qcDescription}
                  onChange={(e) => setQcDescription(e.target.value)}
                  placeholder="Summary or objective..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={qcDate}
                    onChange={(e) => setQcDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={qcPriority}
                    onChange={(e) => setQcPriority(e.target.value as PriorityLevel)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickCreateOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                  Create Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
