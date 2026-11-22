import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderKanban,
  BookOpen,
  Microscope,
  ListTodo,
  Timer,
  Plus,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { useApp } from '../context/AppContext';

export function DashboardView() {
  const {
    tasks,
    projects,
    journalEntries,
    analysisRecords,
    plannerActivities,
    workSessions,
    auditLogs,
    setActiveTab,
    setSelectedProjectId,
    setQuickCreateModal,
    updatePlannerActivity,
  } = useApp();

  const [chartTimeframe, setChartTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const todayStr = new Date().toISOString().split('T')[0];

  const activeTasks = useMemo(() => tasks.filter((t) => !t.isArchived), [tasks]);
  const eligibleTasks = useMemo(
    () => activeTasks.filter((t) => t.status !== 'Cancelled'),
    [activeTasks]
  );

  // 8 Top KPIs calculated strictly from authenticated workspace records
  const kpis = useMemo(() => {
    const totalTasks = eligibleTasks.length;
    const completedTasks = eligibleTasks.filter((t) => t.status === 'Completed').length;
    const pendingTasks = eligibleTasks.filter(
      (t) => t.status !== 'Completed'
    ).length;
    const overdueTasks = eligibleTasks.filter(
      (t) => t.status !== 'Completed' && t.dueDate && t.dueDate < todayStr
    ).length;
    const activeProjectsCount = projects.filter(
      (p) => p.status === 'Active' || p.status === 'Planning'
    ).length;
    const activeJournalsCount = journalEntries.filter((j) => !j.isArchived).length;
    const activeAnalysesCount = analysisRecords.filter((a) => !a.isArchived).length;

    const taskHours = activeTasks.reduce((sum, t) => sum + (Number(t.actualHours) || 0), 0);
    const journalHours = journalEntries
      .filter((j) => !j.isArchived)
      .reduce((sum, j) => sum + (Number(j.timeSpentHours) || 0), 0);
    const sessionHours = workSessions.reduce((sum, s) => sum + (Number(s.durationHours) || 0), 0);
    // Avoid double-counting if tasks and journals overlap, or show total logged focus hours
    const totalWorkHours = Number((taskHours + journalHours + sessionHours).toFixed(1));

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      activeProjectsCount,
      activeJournalsCount,
      activeAnalysesCount,
      totalWorkHours,
    };
  }, [eligibleTasks, activeTasks, projects, journalEntries, analysisRecords, workSessions, todayStr]);

  const isBrandNewWorkspace =
    activeTasks.length === 0 &&
    projects.length === 0 &&
    journalEntries.length === 0 &&
    analysisRecords.length === 0;

  // Section A: Today's Overview
  const todayActivities = useMemo(
    () =>
      plannerActivities
        .filter((a) => !a.isArchived && a.startDate <= todayStr && a.endDate >= todayStr)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [plannerActivities, todayStr]
  );

  // Section B: Productivity Chart Data (Daily / Weekly / Monthly)
  const productivitySeries = useMemo(() => {
    const now = new Date();
    if (chartTimeframe === 'daily') {
      const days: { label: string; completed: number; hours: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const shortLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const comp = eligibleTasks.filter(
          (t) => t.status === 'Completed' && (t.completionDate === dateStr || t.updatedAt.startsWith(dateStr))
        ).length;
        const hrs =
          journalEntries
            .filter((j) => !j.isArchived && j.entryDate === dateStr)
            .reduce((s, j) => s + (Number(j.timeSpentHours) || 0), 0) +
          workSessions
            .filter((s) => s.sessionDate === dateStr)
            .reduce((s, w) => s + (Number(w.durationHours) || 0), 0);
        days.push({ label: shortLabel, completed: comp, hours: Number(hrs.toFixed(1)) });
      }
      return days;
    }

    if (chartTimeframe === 'weekly') {
      const weeks: { label: string; completed: number; hours: number }[] = [];
      for (let w = 3; w >= 0; w--) {
        const end = new Date(now);
        end.setDate(end.getDate() - w * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];
        const comp = eligibleTasks.filter((t) => {
          const d = t.completionDate || t.updatedAt.split('T')[0];
          return t.status === 'Completed' && d >= startStr && d <= endStr;
        }).length;
        const hrs =
          journalEntries
            .filter((j) => !j.isArchived && j.entryDate >= startStr && j.entryDate <= endStr)
            .reduce((s, j) => s + (Number(j.timeSpentHours) || 0), 0) +
          eligibleTasks
            .filter((t) => {
              const d = t.completionDate || t.updatedAt.split('T')[0];
              return d >= startStr && d <= endStr;
            })
            .reduce((s, t) => s + (Number(t.actualHours) || 0), 0);
        weeks.push({
          label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          completed: comp,
          hours: Number(hrs.toFixed(1)),
        });
      }
      return weeks;
    }

    // Monthly
    const months: { label: string; completed: number; hours: number }[] = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const comp = eligibleTasks.filter(
        (t) => t.status === 'Completed' && (t.completionDate.startsWith(ym) || t.updatedAt.startsWith(ym))
      ).length;
      const hrs =
        journalEntries
          .filter((j) => !j.isArchived && j.entryDate.startsWith(ym))
          .reduce((s, j) => s + (Number(j.timeSpentHours) || 0), 0) +
        eligibleTasks
          .filter((t) => t.startDate.startsWith(ym) || t.updatedAt.startsWith(ym))
          .reduce((s, t) => s + (Number(t.actualHours) || 0), 0);
      months.push({ label, completed: comp, hours: Number(hrs.toFixed(1)) });
    }
    return months;
  }, [chartTimeframe, eligibleTasks, journalEntries, workSessions]);

  // Section C: Task Status Chart
  const statusDistribution = useMemo(() => {
    const statuses: { name: string; count: number; color: string }[] = [
      { name: 'Not Started', count: 0, color: '#64748B' },
      { name: 'In Progress', count: 0, color: '#7C3AED' },
      { name: 'Under Review', count: 0, color: '#D97706' },
      { name: 'Completed', count: 0, color: '#16A34A' },
      { name: 'On Hold', count: 0, color: '#DC2626' },
    ];
    for (const t of activeTasks) {
      const found = statuses.find((s) => s.name === t.status);
      if (found) found.count += 1;
    }
    return statuses;
  }, [activeTasks]);

  // Section F: Upcoming Deadlines
  const upcomingDeadlines = useMemo(
    () =>
      eligibleTasks
        .filter((t) => t.status !== 'Completed' && t.dueDate)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6),
    [eligibleTasks]
  );

  return (
    <div className="space-y-6">
      {/* Guided First-Time Onboarding Prompts for New Empty Workspaces */}
      {isBrandNewWorkspace && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
          <div className="max-w-3xl">
            <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1">
              Workspace Ready · Zero Fabricated Data
            </p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Welcome to WhimsyMaya. Start building your permanent work record.
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
              All analytics, completion metrics, and timelines calculate transparently from your actual records. Choose an action below to create your first record:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={() => setQuickCreateModal('project')}
                className="flex flex-col items-start p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500 transition-colors text-left"
              >
                <FolderKanban className="w-5 h-5 text-violet-600 dark:text-violet-400 mb-2" />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  1. Create First Project
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Set milestones and track progress
                </span>
              </button>
              <button
                onClick={() => setQuickCreateModal('task')}
                className="flex flex-col items-start p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500 transition-colors text-left"
              >
                <ListTodo className="w-5 h-5 text-violet-600 dark:text-violet-400 mb-2" />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  2. Add First Task
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Plan deliverables & checklists
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('journal');
                  setQuickCreateModal('journal');
                }}
                className="flex flex-col items-start p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500 transition-colors text-left"
              >
                <BookOpen className="w-5 h-5 text-violet-600 dark:text-violet-400 mb-2" />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  3. Write Journal Entry
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Record achievements & decisions
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('analyst');
                  setQuickCreateModal('analysis');
                }}
                className="flex flex-col items-start p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500 transition-colors text-left"
              >
                <Microscope className="w-5 h-5 text-violet-600 dark:text-violet-400 mb-2" />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  4. New Analysis Record
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Document business or market thesis
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8 Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Total Tasks</span>
            <ListTodo className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {kpis.totalTasks}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Eligible tasks</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {kpis.completedTasks}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {kpis.totalTasks > 0
              ? `${Math.round((kpis.completedTasks / kpis.totalTasks) * 100)}% rate`
              : 'No tasks yet'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Pending</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {kpis.pendingTasks}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">In queue</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Overdue</span>
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
            {kpis.overdueTasks}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Past due date</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Active Projects</span>
            <FolderKanban className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {kpis.activeProjectsCount}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {projects.length} total
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Journal Entries</span>
            <BookOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {kpis.activeJournalsCount}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Work logs</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Analyses</span>
            <Microscope className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {kpis.activeAnalysesCount}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Analyst desk</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium">Work Hours</span>
            <Timer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {kpis.totalWorkHours}h
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Logged effort</p>
        </div>
      </div>

      {/* Row 1: Today's Overview + Productivity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Section A: Today's Overview */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Today's Overview
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <button
                onClick={() => setQuickCreateModal('planner')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Quick Activity
              </button>
            </div>

            {/* Summary Metrics Strip */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-800 mb-4 text-center">
              <div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {todayActivities.length}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Planned Today</div>
              </div>
              <div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {todayActivities.filter((a) => a.completed).length}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Completed</div>
              </div>
              <div>
                <div className="text-lg font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                  {kpis.pendingTasks}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Remaining Tasks</div>
              </div>
            </div>

            {/* Today's Schedule List */}
            <div className="space-y-2.5">
              {todayActivities.length === 0 ? (
                <div className="py-8 text-center">
                  <Calendar className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    No activities scheduled for today
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                    Plan time blocks for deep work, meetings, or research.
                  </p>
                  <button
                    onClick={() => setQuickCreateModal('planner')}
                    className="px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/50 transition-colors"
                  >
                    Schedule Today's First Block
                  </button>
                </div>
              ) : (
                todayActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 dark:border-slate-800/70 last:border-none"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={act.completed}
                        onChange={(e) =>
                          updatePlannerActivity(act.id, { completed: e.target.checked })
                        }
                        className="mt-1 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-medium truncate ${
                            act.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {act.title}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="font-mono tabular-nums">
                            {act.startTime}–{act.endTime}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{act.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{act.priority}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => setActiveTab('planner')}
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              Open Full Calendar Planner
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Section B: Productivity Chart */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Productivity & Execution Velocity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Completed tasks and logged work hours calculated from workspace history
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setChartTimeframe(tf)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0 ${
                    chartTimeframe === tf
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productivitySeries} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  name="Work Hours"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorHours)"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Tasks Completed"
                  stroke="#16A34A"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorComp)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Task Status Chart + Project Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Section C: Task Status Chart */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Task Status Breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Distribution across pipeline stages
                </p>
              </div>
              <button
                onClick={() => setActiveTab('tasks')}
                className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
              >
                View All Tasks
              </button>
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusDistribution}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 20, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={95}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Tasks" radius={[0, 4, 4, 0]}>
                    {statusDistribution.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Section D: Project Overview */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Project Portfolio Overview
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Progress calculated from completed vs. total eligible tasks
                </p>
              </div>
              <button
                onClick={() => setQuickCreateModal('project')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Project
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="py-10 text-center">
                <FolderKanban className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No projects created yet
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Create a project to organize tasks, milestones, and research records.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-4">Project Name</th>
                      <th className="py-2.5 px-3">Status & Priority</th>
                      <th className="py-2.5 px-3">Target Deadline</th>
                      <th className="py-2.5 px-3 text-right">Members</th>
                      <th className="py-2.5 pl-3 text-right">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                    {projects.slice(0, 5).map((proj) => (
                      <tr
                        key={proj.id}
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setActiveTab('projects');
                        }}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                          {proj.name}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <span>{proj.status}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{proj.priority}</span>
                        </td>
                        <td className="py-3 px-3 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {proj.targetDeadline || '—'}
                        </td>
                        <td className="py-3 px-3 text-xs font-mono tabular-nums text-right text-slate-600 dark:text-slate-400">
                          {proj.memberUids.length}
                        </td>
                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-violet-600 dark:bg-violet-500"
                                style={{ width: `${proj.progressPercentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300 w-9 text-right">
                              {proj.progressPercentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Upcoming Deadlines + Recent Work Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Section F: Upcoming Deadlines */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Upcoming Deadlines
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pending tasks ordered chronologically by due date
              </p>
            </div>
            <button
              onClick={() => setQuickCreateModal('task')}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              + Add Task
            </button>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No pending deadlines on record.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {upcomingDeadlines.map((t) => {
                const isOverdue = t.dueDate < todayStr;
                return (
                  <div
                    key={t.id}
                    onClick={() => setActiveTab('tasks')}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 -mx-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {t.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span>{t.projectName || 'Unassigned Project'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.priority} Priority</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.status}</span>
                      </div>
                    </div>
                    <div
                      className={`text-xs font-mono tabular-nums whitespace-nowrap shrink-0 font-medium ${
                        isOverdue
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {isOverdue ? `Overdue · ${t.dueDate}` : `Due ${t.dueDate}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section E: Recent Work Activity */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Recent Work Activity
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live chronological feed of tasks, journals, and analysis records
              </p>
            </div>
            <button
              onClick={() => setActiveTab('track-record')}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              Full Track Record
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No workspace activity logged yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {log.entityTitle}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {log.actionType} · {log.summary}
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                    {log.createdAt.split('T')[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
