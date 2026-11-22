import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthPage } from './pages/AuthPage';
import { AppShellLayout } from './layouts/AppShellLayout';
import { DashboardView } from './components/DashboardView';
import { PlannerView } from './components/PlannerView';
import { TasksView } from './components/TasksView';
import { ProjectsView } from './components/ProjectsView';
import { JournalView } from './components/JournalView';
import { AnalystDeskView } from './components/AnalystDeskView';
import { TrackRecordView } from './components/TrackRecordView';
import { AnalyticsReportsView } from './components/AnalyticsReportsView';
import { TeamManagementView } from './components/TeamManagementView';
import { NotificationsView, SettingsView } from './components/NotificationsSettingsView';

const MainWorkspaceRouter: React.FC = () => {
  const { userProfile, authLoading, isDemoMode, activeTab } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center mx-auto">
            WM
          </div>
          <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Initializing WhimsyMaya Workspace...
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile && !isDemoMode) {
    return <AuthPage />;
  }

  return (
    <AppShellLayout>
      {activeTab === 'dashboard' && <DashboardView />}
      {activeTab === 'planner' && <PlannerView />}
      {activeTab === 'tasks' && <TasksView />}
      {activeTab === 'projects' && <ProjectsView />}
      {activeTab === 'journal' && <JournalView />}
      {activeTab === 'analyst' && <AnalystDeskView />}
      {activeTab === 'track-record' && <TrackRecordView />}
      {activeTab === 'reports' && <AnalyticsReportsView initialTab="analytics" />}
      {activeTab === 'team' && <TeamManagementView />}
      {activeTab === 'notifications' && <NotificationsView />}
      {activeTab === 'settings' && <SettingsView />}
    </AppShellLayout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainWorkspaceRouter />
      </AppProvider>
    </ErrorBoundary>
  );
}
