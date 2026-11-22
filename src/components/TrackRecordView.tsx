import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  CheckSquare,
  FolderKanban,
  BookOpen,
  LineChart,
  Award,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NavTab } from '../types';

type DatePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'prevMonth'
  | 'custom';

interface UnifiedArchiveItem {
  id: string;
  entityType: 'Task' | 'Project' | 'Journal' | 'Analysis' | 'Audit';
  title: string;
  subtitle: string;
  category: string;
  projectId: string | null;
  projectName: string;
  dateStr: string;
  timestamp: string;
  userName: string;
  isAchievement: boolean;
  targetTab: NavTab;
}

export const TrackRecordView: React.FC = () => {
  const {
    tasks,
    projects,
    journalEntries,
    analysisRecords,
    auditLogs,
    setActiveTab,
    globalSearchQuery,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState(globalSearchQuery || '');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [onlyAchievements, setOnlyAchievements] = useState(false);

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  const archiveItems = useMemo<UnifiedArchiveItem[]>(() => {
    const items: UnifiedArchiveItem[] = [];

    tasks.forEach((t) => {
      const dateStr = (t.completionDate || t.updatedAt || t.createdAt || '').slice(0, 10);
      items.push({
        id: `task-${t.id}`,
        entityType: 'Task',
        title: t.title,
        subtitle: `${t.status} · Priority: ${t.priority} · Actual: ${t.actualHours}h (Est: ${t.estimatedHours}h)`,
        category: (t.tags && t.tags[0]) || 'Task Execution',
        projectId: t.projectId || null,
        projectName: t.projectName || (t.projectId ? projectMap.get(t.projectId) || 'Project' : 'Unassigned'),
        dateStr,
        timestamp: t.completionDate || t.updatedAt || t.createdAt,
        userName: t.assignedToName || t.createdByName || 'Workspace Member',
        isAchievement: t.status === 'Completed',
        targetTab: 'tasks',
      });
    });

    projects.forEach((p) => {
      const dateStr = (p.updatedAt || p.createdAt || p.startDate || '').slice(0, 10);
      items.push({
        id: `proj-${p.id}`,
        entityType: 'Project',
        title: p.name,
        subtitle: `Status: ${p.status} · Progress: ${p.progressPercentage}% · Priority: ${p.priority}`,
        category: 'Project Initiative',
        projectId: p.id,
        projectName: p.name,
        dateStr,
        timestamp: p.updatedAt || p.createdAt,
        userName: p.ownerName || 'Project Owner',
        isAchievement: p.status === 'Completed' || p.progressPercentage === 100,
        targetTab: 'projects',
      });
    });

    journalEntries.forEach((j) => {
      const hasWin = Boolean(j.achievements && j.achievements.trim().length > 0);
      items.push({
        id: `journal-${j.id}`,
        entityType: 'Journal',
        title: j.title,
        subtitle: hasWin
          ? `Achievement: ${j.achievements} (${j.timeSpentHours}h)`
          : `${(j.description || '').slice(0, 140)} (${j.timeSpentHours}h)`,
        category: j.category || 'Engineering',
        projectId: j.projectId || null,
        projectName: j.projectName || (j.projectId ? projectMap.get(j.projectId) || 'Project' : 'Personal'),
        dateStr: j.entryDate,
        timestamp: `${j.entryDate}T${j.entryTime || '12:00'}:00Z`,
        userName: j.createdByName || 'Author',
        isAchievement: hasWin,
        targetTab: 'journal',
      });
    });

    analysisRecords.forEach((a) => {
      items.push({
        id: `analysis-${a.id}`,
        entityType: 'Analysis',
        title: a.stockSymbol ? `[${a.stockSymbol}] ${a.title}` : a.title,
        subtitle: `${a.category} · ${a.status} · Confidence: ${a.confidenceLevel}`,
        category: a.category,
        projectId: a.projectId || null,
        projectName: a.projectName || (a.projectId ? projectMap.get(a.projectId) || 'Project' : 'Research Desk'),
        dateStr: a.analysisDate,
        timestamp: a.updatedAt || a.createdAt,
        userName: a.createdByName || 'Analyst',
        isAchievement: a.status === 'Completed',
        targetTab: 'analyst',
      });
    });

    auditLogs.forEach((log) => {
      const dateStr = (log.createdAt || '').slice(0, 10);
      items.push({
        id: `audit-${log.id}`,
        entityType: 'Audit',
        title: `${log.actionType}: ${log.entityTitle}`,
        subtitle: log.summary,
        category: log.category || log.entityType,
        projectId: log.projectId || null,
        projectName: 'System Audit Log',
        dateStr,
        timestamp: log.createdAt,
        userName: log.actorName || 'Member',
        isAchievement: false,
        targetTab: 'dashboard',
      });
    });

    return items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [tasks, projects, journalEntries, analysisRecords, auditLogs, projectMap]);

  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
    const last7 = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const last30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStart = `${prevMonthDate.getFullYear()}-${String(
      prevMonthDate.getMonth() + 1
    ).padStart(2, '0')}-01`;
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      .toISOString()
      .split('T')[0];

    return {
      todayStr,
      yesterday,
      last7,
      last30,
      thisMonthStart,
      prevMonthStart,
      prevMonthEnd,
    };
  }, []);

  const filteredItems = useMemo(() => {
    return archiveItems.filter((item) => {
      if (typeFilter !== 'ALL' && item.entityType !== typeFilter) return false;
      if (projectFilter !== 'ALL' && item.projectId !== projectFilter) return false;
      if (onlyAchievements && !item.isAchievement) return false;

      if (datePreset === 'today' && item.dateStr !== dateRangeBounds.todayStr) return false;
      if (datePreset === 'yesterday' && item.dateStr !== dateRangeBounds.yesterday) return false;
      if (datePreset === 'last7' && item.dateStr < dateRangeBounds.last7) return false;
      if (datePreset === 'last30' && item.dateStr < dateRangeBounds.last30) return false;
      if (datePreset === 'thisMonth' && item.dateStr < dateRangeBounds.thisMonthStart)
        return false;
      if (
        datePreset === 'prevMonth' &&
        (item.dateStr < dateRangeBounds.prevMonthStart ||
          item.dateStr > dateRangeBounds.prevMonthEnd)
      )
        return false;
      if (datePreset === 'custom') {
        if (customStart && item.dateStr < customStart) return false;
        if (customEnd && item.dateStr > customEnd) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${item.title} ${item.subtitle} ${item.category} ${item.projectName} ${item.userName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    archiveItems,
    typeFilter,
    projectFilter,
    onlyAchievements,
    datePreset,
    dateRangeBounds,
    customStart,
    customEnd,
    searchQuery,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Searchable Long-Term Professional Work History & Audit Ledger
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Professional Track Record
          </h1>
        </div>

        <button
          onClick={() => setOnlyAchievements(!onlyAchievements)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
            onlyAchievements
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          {onlyAchievements ? 'Showing Key Achievements Only' : 'Highlight Key Achievements'}
        </button>
      </div>

      {/* Temporal & Entity Filter Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'all', label: 'All History' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7', label: 'Last 7 Days' },
              { id: 'last30', label: 'Last 30 Days' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'prevMonth', label: 'Previous Month' },
              { id: 'custom', label: 'Custom Range' },
            ] as { id: DatePreset; label: string }[]
          ).map((preset) => (
            <button
              key={preset.id}
              onClick={() => setDatePreset(preset.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                datePreset === preset.id
                  ? 'bg-slate-900 text-white dark:bg-indigo-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all tasks, journal logs, projects, analysis dossiers..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Record Types</option>
            <option value="Task">Tasks</option>
            <option value="Project">Projects</option>
            <option value="Journal">Work Journal</option>
            <option value="Analysis">Analyst Desk</option>
            <option value="Audit">Audit Trail</option>
          </select>

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Unified Chronological Ledger */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-200/70 dark:divide-slate-800">
        <div className="px-5 py-3 flex items-center justify-between text-xs font-mono text-slate-500">
          <span>Showing {filteredItems.length} chronological records</span>
          <span>Click any entry to inspect in source module</span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No historical records match your filter criteria
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Try expanding your date range or clearing the search query.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.targetTab)}
              className="px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex items-start justify-between gap-4 group"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="mt-0.5 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {item.entityType === 'Task' && <CheckSquare className="w-4 h-4 text-indigo-500" />}
                  {item.entityType === 'Project' && (
                    <FolderKanban className="w-4 h-4 text-violet-500" />
                  )}
                  {item.entityType === 'Journal' && (
                    <BookOpen className="w-4 h-4 text-emerald-500" />
                  )}
                  {item.entityType === 'Analysis' && (
                    <LineChart className="w-4 h-4 text-amber-500" />
                  )}
                  {item.entityType === 'Audit' && <Clock className="w-4 h-4 text-slate-400" />}
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {item.entityType}
                    </span>
                    <span>·</span>
                    <span>{item.dateStr}</span>
                    <span>·</span>
                    <span>{item.category}</span>
                    <span>·</span>
                    <span>{item.projectName}</span>
                    <span>·</span>
                    <span>{item.userName}</span>
                  </div>

                  <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
                    <span className="truncate">{item.title}</span>
                    {item.isAchievement && (
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        ★ Achievement
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {item.subtitle}
                  </p>
                </div>
              </div>

              <div className="text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0 pt-1">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
