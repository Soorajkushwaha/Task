import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Check,
  Sun,
  Moon,
  Shield,
  Database,
  HardDrive,
  Download,
  User,
  KeyRound,
  Mail,
  Globe,
  Terminal,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { exportToExcel } from '../utils/exportUtils';
import { NavTab } from '../types';

export const NotificationsView: React.FC = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    setActiveTab,
  } = useApp();

  const [filterType, setFilterType] = useState<string>('ALL');

  const filtered = notifications.filter((n) => {
    if (filterType === 'UNREAD') return !n.read;
    if (filterType !== 'ALL') return n.type === filterType;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Deadlines, Reminders, Assignments & Milestone Alerts
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Notifications Center ({unreadCount} unread)
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Notifications</option>
            <option value="UNREAD">Unread Only</option>
            <option value="overdue">Overdue Alerts</option>
            <option value="deadline">Upcoming Deadlines</option>
            <option value="assignment">Task Assignments</option>
            <option value="project">Project Milestones</option>
            <option value="journal">Journal Reminders</option>
          </select>

          <button
            onClick={markAllNotificationsRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-indigo-600 text-white hover:opacity-90 cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All Read
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-200/70 dark:divide-slate-800">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              You are all caught up
            </div>
            <p className="text-xs text-slate-500 mt-1">
              No notifications match your current filter.
            </p>
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                !n.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
              }`}
            >
              <div
                onClick={() => {
                  if (!n.read) markNotificationRead(n.id);
                  if (n.linkTab) setActiveTab(n.linkTab as NavTab);
                }}
                className="cursor-pointer flex-1"
              >
                <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-2">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {n.type}
                  </span>
                  <span>·</span>
                  <span>{(n.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
                  {!n.read && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      · NEW
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                  {n.title}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
              </div>

              {!n.read && (
                <button
                  onClick={() => markNotificationRead(n.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 cursor-pointer"
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const {
    userProfile,
    currentWorkspace,
    isDemoMode,
    capabilities,
    theme,
    toggleTheme,
    updateUserProfile,
    tasks,
    projects,
    journalEntries,
    analysisRecords,
  } = useApp();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [roleTitle, setRoleTitle] = useState(
    userProfile?.roleTitle || 'Principal Strategy & Systems Analyst'
  );
  const [timezone, setTimezone] = useState(
    userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [dateFormat, setDateFormat] = useState(userProfile?.dateFormat || 'YYYY-MM-DD');
  const [privateJournalDefault, setPrivateJournalDefault] = useState(
    userProfile?.privateJournalDefault ?? true
  );
  const [notifyDeadlines, setNotifyDeadlines] = useState(
    userProfile?.notifyDeadlines ?? true
  );
  const [savedBanner, setSavedBanner] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({
      displayName,
      roleTitle,
      timezone,
      dateFormat,
      privateJournalDefault,
      notifyDeadlines,
      theme,
    });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const handleFullWorkspaceBackupExport = () => {
    const rows: (string | number)[][] = [
      ...tasks.map((t) => [
        'Task',
        t.id,
        t.title,
        t.status,
        t.dueDate || t.createdAt,
        t.description,
      ]),
      ...projects.map((p) => [
        'Project',
        p.id,
        p.name,
        `${p.status} (${p.progressPercentage}%)`,
        p.targetDeadline || p.startDate,
        p.description,
      ]),
      ...journalEntries.map((j) => [
        'Journal',
        j.id,
        j.title,
        j.visibility,
        j.entryDate,
        j.description,
      ]),
      ...analysisRecords.map((a) => [
        'Analysis',
        a.id,
        a.title,
        a.status,
        a.analysisDate,
        a.keyFindings,
      ]),
    ];

    exportToExcel({
      reportTitle: 'Full Workspace Archive',
      workspaceName: currentWorkspace?.name || 'WhimsyMaya Workspace',
      dateRangeLabel: 'Complete Historical Export',
      summaryKpis: [
        { label: 'Total Records', value: rows.length },
        { label: 'Mode', value: isDemoMode ? 'Demo Preview Data' : 'Cloudflare D1 Production' },
      ],
      columns: ['Module', 'Record ID', 'Title', 'Status / Visibility', 'Date', 'Summary / Details'],
      rows,
    });
  };

  const futureIntegrations = [
    {
      name: 'Better Auth',
      status: capabilities.betterAuthConfigured ? 'Configured' : 'Not Configured',
      isConfigured: capabilities.betterAuthConfigured,
      icon: KeyRound,
      envVars: 'BETTER_AUTH_SECRET',
      description:
        'Cryptographic session signing and HTTP-only cookie authentication backed by Cloudflare D1. Production login and registration remain locked until a strong secret is set.',
      command: 'npx wrangler secret put BETTER_AUTH_SECRET',
    },
    {
      name: 'Google Login',
      status: capabilities.googleOAuthConfigured ? 'Configured' : 'Not Configured',
      isConfigured: capabilities.googleOAuthConfigured,
      icon: Globe,
      envVars: 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET',
      description:
        'Optional 1-click Google OAuth 2.0 authentication. When unconfigured, Google sign-in is disabled and development mode works without Google credentials.',
      command: 'npx wrangler secret put GOOGLE_CLIENT_ID && npx wrangler secret put GOOGLE_CLIENT_SECRET',
    },
    {
      name: 'Turnstile',
      status: capabilities.turnstileConfigured ? 'Configured' : 'Not Configured',
      isConfigured: capabilities.turnstileConfigured,
      icon: Shield,
      envVars: 'VITE_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY',
      description:
        'Cloudflare Turnstile bot protection on registration, sign-in, and password recovery endpoints.',
      command: 'npx wrangler secret put TURNSTILE_SECRET_KEY',
    },
    {
      name: 'Resend Email',
      status: capabilities.emailResetConfigured ? 'Configured' : 'Not Configured',
      isConfigured: capabilities.emailResetConfigured,
      icon: Mail,
      envVars: 'RESEND_API_KEY, EMAIL_FROM',
      description:
        'Transactional email delivery for password reset links and workspace invitation notifications.',
      command: 'npx wrangler secret put RESEND_API_KEY && npx wrangler secret put EMAIL_FROM',
    },
    {
      name: 'Cloudflare D1',
      status: capabilities.d1Configured ? 'Connected' : 'Pending Setup',
      isConfigured: capabilities.d1Configured,
      icon: Database,
      envVars: 'Binding: DB (whimsymaya-db)',
      description:
        'Primary serverless SQLite database (19 tables in migrations/0001_initial_schema.sql) for users, sessions, workspaces, tasks, projects, journals, and analysis records.',
      command: 'npx wrangler d1 create whimsymaya-db && npx wrangler d1 migrations apply whimsymaya-db --remote',
    },
    {
      name: 'Cloudflare R2',
      status: capabilities.r2Configured ? 'Connected' : 'Pending Setup',
      isConfigured: capabilities.r2Configured,
      icon: HardDrive,
      envVars: 'Binding: FILES (whimsymaya-files)',
      description:
        'Zero-egress object storage bucket for work journal attachments, analyst charts, and project evidence files.',
      command: 'npx wrangler r2 bucket create whimsymaya-files',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Profile, Workspace Preferences, Privacy & Cloudflare Infrastructure Readiness
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          Settings & Future Integrations
        </h1>
      </div>

      {/* Section 1: Future Integrations Readiness Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Post-Deployment Configuration Checklist
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              Future Integrations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              All external credentials and Cloudflare bindings are optional during initial build and preview. Configure these services after deploying to Cloudflare Workers. Actual secret values are never displayed in the UI.
            </p>
          </div>
          {isDemoMode && (
            <div className="px-3 py-1.5 rounded-lg border border-amber-300/80 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-xs font-mono text-amber-800 dark:text-amber-300 shrink-0">
              Active Mode: Development & Demo Data
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {futureIntegrations.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.name}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-semibold ${
                        item.isConfigured
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      — {item.status}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Required Key / Binding: <strong className="text-slate-700 dark:text-slate-200">{item.envVars}</strong>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400 mb-1 flex items-center gap-1">
                    <Terminal className="w-3 h-3" />
                    Setup Command (Run After Deployment)
                  </div>
                  <code className="block text-[11px] font-mono bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-md overflow-x-auto whitespace-nowrap">
                    {item.command}
                  </code>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            <strong>Zero-Compromise Security Notice:</strong> WhimsyMaya never uses hardcoded production secrets or silent fallback signing keys. Until <code className="font-mono">BETTER_AUTH_SECRET</code> is configured in Cloudflare Worker secrets, production multi-user database endpoints remain locked and the interface runs safely in isolated Development & Demo Preview Mode.
          </div>
        </div>
      </div>

      {/* Section 2: Profile, Theme & Data Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveSettings}
          className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-500" />
              User Profile & Localization
            </h2>
            {savedBanner && (
              <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                ✓ Preferences Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Account Email
              </label>
              <input
                type="email"
                disabled
                value={userProfile?.email || ''}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Professional Title / Role
              </label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Timezone
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Default Journal Entry Privacy
              </label>
              <select
                value={privateJournalDefault ? 'Private' : 'Shared'}
                onChange={(e) => setPrivateJournalDefault(e.target.value === 'Private')}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="Private">Private by Default (Recommended)</option>
                <option value="Shared">Shared with Active Workspace</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyDeadlines}
                onChange={(e) => setNotifyDeadlines(e.target.checked)}
                className="rounded border-slate-300"
              />
              Enable daily planner & deadline reminders
            </label>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
            >
              Save Profile & Preferences
            </button>
          </div>
        </form>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Visual Theme & Interface Mode
            </h3>
            <p className="text-xs text-slate-500">
              Switch between Atmospheric Minimalism (Light) and High-Craft Dark UI.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => theme === 'dark' && toggleTheme()}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                  theme === 'light'
                    ? 'border-indigo-600 bg-indigo-50/60 text-indigo-700'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-4 h-4" />
                Light Mode
              </button>
              <button
                type="button"
                onClick={() => theme === 'light' && toggleTheme()}
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                  theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-950/50 text-indigo-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark Mode
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Workspace Data Portability & Backup
            </h3>
            <p className="text-xs text-slate-500">
              Export all records from <strong className="font-mono">{currentWorkspace?.name}</strong>{' '}
              into a consolidated Excel (.xlsx) workbook.
            </p>
            <button
              type="button"
              onClick={handleFullWorkspaceBackupExport}
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-indigo-600 text-white hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Full Workspace Archive (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
