import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { useApp } from '../context/AppContext';
import {
  buildReportPayload,
  exportToCsv,
  exportToExcel,
  exportToPdf,
  ReportType,
} from '../utils/exportUtils';

const REPORT_TYPES: { id: ReportType; title: string; description: string }[] = [
  {
    id: 'Daily Work Report',
    title: 'Daily Work Report',
    description: 'Today’s completed tasks, logged hours, and daily journal summary.',
  },
  {
    id: 'Weekly Work Summary',
    title: 'Weekly Work Summary',
    description: 'Last 7 days of execution velocity, task completions, and journal entries.',
  },
  {
    id: 'Monthly Performance Report',
    title: 'Monthly Performance Report',
    description: '30-day executive KPI breakdown across tasks, hours, and deliverables.',
  },
  {
    id: 'Project Progress Report',
    title: 'Project Progress Report',
    description: 'All active and completed projects with eligible task completion percentages.',
  },
  {
    id: 'Task Completion Report',
    title: 'Task Completion Report',
    description: 'Detailed inventory of tasks, priorities, due dates, and estimated vs actual hours.',
  },
  {
    id: 'Work Journal Export',
    title: 'Work Journal Export',
    description: 'Chronological daily journal entries, achievements, lessons, and time spent.',
  },
  {
    id: 'Analyst Research Report',
    title: 'Analyst Research Report',
    description: 'Research dossiers, hypotheses, expected vs actual outcomes, and market theses.',
  },
  {
    id: 'Team Productivity Report',
    title: 'Team Productivity Report',
    description: 'Member-by-member task assignments, completed deliverables, and logged hours.',
  },
  {
    id: 'Custom Date Range Report',
    title: 'Custom Date Range Report',
    description: 'Filtered cross-module export for your specified date window and project.',
  },
];

export const AnalyticsReportsView: React.FC<{ initialTab?: 'analytics' | 'reports' }> = ({
  initialTab = 'analytics',
}) => {
  const {
    tasks,
    projects,
    journalEntries,
    analysisRecords,
    plannerActivities,
    members,
    currentWorkspace,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'analytics' | 'reports'>(initialTab);
  const [selectedReport, setSelectedReport] = useState<ReportType>('Monthly Performance Report');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [projectIdFilter, setProjectIdFilter] = useState<string>('ALL');

  const kpis = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Task Completion Rate = Completed eligible tasks / Total eligible tasks * 100 (Exclude Cancelled)
    const eligibleTasks = tasks.filter((t) => t.status !== 'Cancelled' && !t.isArchived);
    const completedTasks = eligibleTasks.filter((t) => t.status === 'Completed');
    const taskCompletionRate =
      eligibleTasks.length > 0
        ? Math.round((completedTasks.length / eligibleTasks.length) * 1000) / 10
        : 0;

    // 2. On-Time Completion Rate = Tasks completed on or before due date / Completed tasks with due dates * 100
    const completedWithDue = completedTasks.filter((t) => Boolean(t.dueDate));
    const completedOnTime = completedWithDue.filter((t) => {
      const compDate = (t.completionDate || t.updatedAt || todayStr).slice(0, 10);
      return compDate <= t.dueDate;
    });
    const onTimeRate =
      completedWithDue.length > 0
        ? Math.round((completedOnTime.length / completedWithDue.length) * 1000) / 10
        : 100;

    // 3. Pending & Overdue Tasks
    const pendingTasks = eligibleTasks.filter((t) => t.status !== 'Completed');
    const overdueTasks = pendingTasks.filter((t) => t.dueDate && t.dueDate < todayStr);

    // 4. Total Work Hours & Average Time per Task
    const taskActualHours = tasks.reduce((acc, t) => acc + (Number(t.actualHours) || 0), 0);
    const journalHours = journalEntries.reduce(
      (acc, j) => acc + (Number(j.timeSpentHours) || 0),
      0
    );
    const totalWorkHours = Math.round(Math.max(taskActualHours, journalHours) * 10) / 10;
    const avgTimePerTask =
      completedTasks.length > 0
        ? Math.round((taskActualHours / completedTasks.length) * 10) / 10
        : 0;

    // 5. Projects Completed, Journal Consistency, Research Records, Achievements
    const projectsCompleted = projects.filter((p) => p.status === 'Completed').length;
    const uniqueJournalDates = new Set(journalEntries.map((j) => j.entryDate)).size;
    const achievementsRecorded = journalEntries.filter(
      (j) => j.achievements && j.achievements.trim().length > 0
    ).length;

    return {
      taskCompletionRate,
      eligibleCount: eligibleTasks.length,
      completedCount: completedTasks.length,
      onTimeRate,
      completedOnTimeCount: completedOnTime.length,
      completedWithDueCount: completedWithDue.length,
      pendingCount: pendingTasks.length,
      overdueCount: overdueTasks.length,
      totalWorkHours,
      avgTimePerTask,
      projectsCompleted,
      totalProjects: projects.length,
      uniqueJournalDates,
      totalJournalEntries: journalEntries.length,
      researchRecordsCount: analysisRecords.length,
      achievementsRecorded,
    };
  }, [tasks, projects, journalEntries, analysisRecords]);

  const chartsData = useMemo(() => {
    const projectPerformance = projects.map((p) => {
      const projTasks = tasks.filter((t) => t.projectId === p.id && t.status !== 'Cancelled');
      const planned = projTasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
      const actual = projTasks.reduce((s, t) => s + (Number(t.actualHours) || 0), 0);
      return {
        name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
        progress: p.progressPercentage,
        PlannedHours: Math.round(planned * 10) / 10,
        ActualHours: Math.round(actual * 10) / 10,
      };
    });

    const priorities = ['Low', 'Medium', 'High', 'Critical'] as const;
    const priorityDist = priorities.map((pri) => ({
      name: pri,
      Total: tasks.filter((t) => t.priority === pri).length,
      Completed: tasks.filter((t) => t.priority === pri && t.status === 'Completed').length,
    }));

    const statuses = [
      'Not Started',
      'In Progress',
      'Under Review',
      'Completed',
      'On Hold',
      'Cancelled',
    ] as const;
    const statusDist = statuses.map((st) => ({
      name: st,
      Count: tasks.filter((t) => t.status === st).length,
    }));

    const catMap = new Map<string, { category: string; Tasks: number; JournalHours: number }>();
    tasks.forEach((t) => {
      const c = (t.tags && t.tags[0]) || 'General';
      const cur = catMap.get(c) || { category: c, Tasks: 0, JournalHours: 0 };
      cur.Tasks += 1;
      catMap.set(c, cur);
    });
    journalEntries.forEach((j) => {
      const c = j.category || 'General';
      const cur = catMap.get(c) || { category: c, Tasks: 0, JournalHours: 0 };
      cur.JournalHours = Math.round((cur.JournalHours + (Number(j.timeSpentHours) || 0)) * 10) / 10;
      catMap.set(c, cur);
    });

    return {
      projectPerformance,
      priorityDist,
      statusDist,
      categoryDist: Array.from(catMap.values()),
    };
  }, [projects, tasks, journalEntries]);

  const reportPayload = useMemo(() => {
    return buildReportPayload(
      selectedReport,
      currentWorkspace?.name || 'WhimsyMaya Workspace',
      {
        tasks,
        projects,
        journalEntries,
        analysisRecords,
        plannerActivities,
        members,
      },
      {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        projectId: projectIdFilter !== 'ALL' ? projectIdFilter : undefined,
      }
    );
  }, [
    selectedReport,
    currentWorkspace?.name,
    tasks,
    projects,
    journalEntries,
    analysisRecords,
    plannerActivities,
    members,
    startDate,
    endDate,
    projectIdFilter,
  ]);

  const handleExport = (format: 'xlsx' | 'csv' | 'pdf') => {
    if (format === 'xlsx') {
      exportToExcel(reportPayload);
    } else if (format === 'csv') {
      exportToCsv(reportPayload);
    } else {
      exportToPdf(reportPayload);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Verified Telemetry, KPI Formulas & Multi-Format Export Engine
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Performance Analytics & Reports
          </h1>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-slate-900 text-white dark:bg-indigo-600'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Performance Analytics
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-slate-900 text-white dark:bg-indigo-600'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Report Generator (.XLSX / CSV / PDF)
          </button>
        </div>
      </div>

      {activeTab === 'analytics' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Task Completion Rate</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
                {kpis.taskCompletionRate}%
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                {kpis.completedCount}/{kpis.eligibleCount} eligible (excl. Cancelled)
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">On-Time Completion</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                {kpis.onTimeRate}%
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                {kpis.completedOnTimeCount}/{kpis.completedWithDueCount} completed ≤ due date
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Pending & Overdue</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {kpis.pendingCount}{' '}
                <span className="text-sm font-normal text-rose-600 dark:text-rose-400">
                  ({kpis.overdueCount} overdue)
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                Active non-cancelled backlog
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Total Work Hours</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {kpis.totalWorkHours}h
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                Avg {kpis.avgTimePerTask}h per completed task
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500">Projects & Research</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                {kpis.projectsCompleted}/{kpis.totalProjects}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                {kpis.researchRecordsCount} analyses · {kpis.achievementsRecorded} wins
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Planned vs. Actual Work Hours by Project
                </h3>
                <p className="text-xs text-slate-500">
                  Comparing estimated task budgets against logged execution hours
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.projectPerformance}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="PlannedHours" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ActualHours" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Task Status Distribution
                </h3>
                <p className="text-xs text-slate-500">
                  Current workflow state across all workspace tasks
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.statusDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="Count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Task Priority vs. Completion Breakdown
                </h3>
                <p className="text-xs text-slate-500">
                  Total vs. completed deliverables across priority tiers
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartsData.priorityDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Completed" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Work Category Distribution
                </h3>
                <p className="text-xs text-slate-500">
                  Task volume and journal deep-work hours by functional domain
                </p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartsData.categoryDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.15} />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="Tasks"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="JournalHours"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2">
            {REPORT_TYPES.map((rep) => (
              <button
                key={rep.id}
                onClick={() => setSelectedReport(rep.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                  selectedReport === rep.id
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500/70 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {rep.title}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {rep.description}
                </p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {reportPayload.reportTitle}
                  </h2>
                  <p className="text-xs font-mono text-slate-500 mt-0.5">
                    {reportPayload.dateRangeLabel} · {reportPayload.rows.length} rows ready for export
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Export Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:opacity-90 text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Export PDF
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Project Filter
                  </label>
                  <select
                    value={projectIdFilter}
                    onChange={(e) => setProjectIdFilter(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="ALL">All Projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setProjectIdFilter('ALL');
                    }}
                    className="w-full px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-[460px]">
                {reportPayload.rows.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    No records found for this report configuration.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                      <tr>
                        {reportPayload.columns.map((col) => (
                          <th
                            key={col}
                            className="py-2.5 px-3 font-mono text-[11px] uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                      {reportPayload.rows.slice(0, 50).map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          {row.map((val, cIdx) => (
                            <td
                              key={cIdx}
                              className="py-2 px-3 text-slate-700 dark:text-slate-300 font-mono text-[11px] max-w-[240px] truncate"
                            >
                              {String(val ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
