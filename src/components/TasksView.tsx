import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  CheckSquare,
  MessageSquare,
  History,
  Trash2,
  Edit3,
  Clock,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Task, TaskStatus, PriorityLevel, ChecklistItem } from '../types';

const TASK_STATUSES: TaskStatus[] = [
  'Not Started',
  'In Progress',
  'Under Review',
  'Completed',
  'On Hold',
  'Cancelled',
];

const PRIORITIES: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

export function TasksView() {
  const {
    tasks,
    projects,
    members,
    comments,
    auditLogs,
    userProfile,
    createTask,
    updateTask,
    deleteTask,
    createComment,
  } = useApp();

  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [filterAssignee, setFilterAssignee] = useState<string>('All');
  const [filterDue, setFilterDue] = useState<'All' | 'Overdue' | 'Today' | 'Upcoming'>('All');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'updatedAt'>('dueDate');

  // Detail & Edit Drawer/Modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [status, setStatus] = useState<TaskStatus>('Not Started');
  const [estimatedHours, setEstimatedHours] = useState<number>(2);
  const [actualHours, setActualHours] = useState<number>(0);
  const [tagsInput, setTagsInput] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [newCommentText, setNewCommentText] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const parseChecklist = (raw: string): ChecklistItem[] => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const openCreateModal = () => {
    setSelectedTask(null);
    setTitle('');
    setDescription('');
    setProjectId(projects[0]?.id || '');
    setAssignedTo(userProfile?.id || '');
    setStartDate(todayStr);
    setDueDate(todayStr);
    setPriority('Medium');
    setStatus('Not Started');
    setEstimatedHours(2);
    setActualHours(0);
    setTagsInput('');
    setChecklist([]);
    setIsCreateOpen(true);
  };

  const openTaskInspector = (task: Task) => {
    setSelectedTask(task);
    setTitle(task.title);
    setDescription(task.description);
    setProjectId(task.projectId);
    setAssignedTo(task.assignedTo);
    setStartDate(task.startDate);
    setDueDate(task.dueDate);
    setPriority(task.priority);
    setStatus(task.status);
    setEstimatedHours(task.estimatedHours);
    setActualHours(task.actualHours);
    setTagsInput(task.tags.join(', '));
    setChecklist(parseChecklist(task.checklistSummary));
    setIsCreateOpen(true);
  };

  const handleAddChecklistItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklist((prev) => [
      ...prev,
      { id: `chk_${Date.now()}`, text: newCheckItem.trim(), done: false },
    ]);
    setNewCheckItem('');
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const proj = projects.find((p) => p.id === projectId);
    const mem = members.find((m) => m.userId === assignedTo);
    const parsedTags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (selectedTask) {
      await updateTask(selectedTask.id, {
        title,
        description,
        projectId,
        projectName: proj?.name || '',
        assignedTo: assignedTo || userProfile?.id || '',
        assignedToName: mem?.displayName || userProfile?.displayName || 'User',
        startDate,
        dueDate,
        priority,
        status,
        estimatedHours: Number(estimatedHours),
        actualHours: Number(actualHours),
        tags: parsedTags,
        checklistSummary: JSON.stringify(checklist),
      });
    } else {
      await createTask({
        title,
        description,
        projectId,
        projectName: proj?.name || '',
        assignedTo: assignedTo || userProfile?.id || '',
        assignedToName: mem?.displayName || userProfile?.displayName || 'User',
        startDate,
        dueDate,
        priority,
        status,
        estimatedHours: Number(estimatedHours),
        actualHours: Number(actualHours),
        tags: parsedTags,
        checklistSummary: JSON.stringify(checklist),
        completionDate: status === 'Completed' ? todayStr : '',
        isArchived: false,
      });
    }
    setIsCreateOpen(false);
  };

  const handleAddComment = async () => {
    if (!selectedTask || !newCommentText.trim()) return;
    await createComment('task', selectedTask.id, newCommentText.trim());
    setNewCommentText('');
  };

  const priorityRank: Record<PriorityLevel, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.isArchived)
      .filter((t) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      })
      .filter((t) => (filterPriority === 'All' ? true : t.priority === filterPriority))
      .filter((t) => (filterProject === 'All' ? true : t.projectId === filterProject))
      .filter((t) => (filterAssignee === 'All' ? true : t.assignedTo === filterAssignee))
      .filter((t) => {
        if (filterDue === 'Overdue') return t.status !== 'Completed' && t.dueDate && t.dueDate < todayStr;
        if (filterDue === 'Today') return t.dueDate === todayStr;
        if (filterDue === 'Upcoming') return t.dueDate > todayStr;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') return priorityRank[b.priority] - priorityRank[a.priority];
        if (sortBy === 'updatedAt') return b.updatedAt.localeCompare(a.updatedAt);
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      });
  }, [tasks, searchQuery, filterPriority, filterProject, filterAssignee, filterDue, sortBy, todayStr]);

  const taskComments = useMemo(
    () =>
      selectedTask
        ? comments.filter((c) => c.targetType === 'task' && c.targetId === selectedTask.id)
        : [],
    [comments, selectedTask]
  );

  const taskHistory = useMemo(
    () =>
      selectedTask
        ? auditLogs.filter((l) => l.entityType === 'task' && l.entityId === selectedTask.id)
        : [],
    [auditLogs, selectedTask]
  );

  return (
    <div className="space-y-5">
      {/* Task Management Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['list', 'kanban', 'calendar'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0 ${
                  viewMode === m
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {m === 'kanban' ? 'Kanban Board' : `${m} View`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, ID, tags..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 w-48"
            />
          </div>
        </div>

        {/* Filters & Primary CTA */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="All">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="All">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="All">All Assignees</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayName}
              </option>
            ))}
          </select>

          <select
            value={filterDue}
            onChange={(e) => setFilterDue(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="All">All Due Dates</option>
            <option value="Overdue">Overdue</option>
            <option value="Today">Due Today</option>
            <option value="Upcoming">Upcoming</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="dueDate">Sort: Due Date</option>
            <option value="priority">Sort: Priority</option>
            <option value="updatedAt">Sort: Recently Updated</option>
          </select>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Task
          </button>
        </div>
      </div>

      {/* VIEW 1: LIST VIEW */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Task & ID</th>
                  <th className="py-3 px-3">Project</th>
                  <th className="py-3 px-3">Assignee</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Due Date</th>
                  <th className="py-3 px-4 text-right">Est / Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      No tasks match your current filters. Click "New Task" to add one.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => {
                    const isOverdue = t.status !== 'Completed' && t.dueDate && t.dueDate < todayStr;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => openTaskInspector(t)}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {t.title}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="font-mono">{t.id.slice(0, 12)}</span>
                            {t.tags.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{t.tags.join(' / ')}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                          {t.projectName || '—'}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {t.assignedToName}
                        </td>
                        <td className="py-3 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {t.priority}
                        </td>
                        <td
                          className="py-3 px-3 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={t.status}
                            onChange={(e) =>
                              updateTask(t.id, { status: e.target.value as TaskStatus })
                            }
                            className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                          >
                            {TASK_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td
                          className={`py-3 px-3 text-xs font-mono tabular-nums text-right whitespace-nowrap ${
                            isOverdue
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {t.dueDate || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {t.estimatedHours}h / {t.actualHours}h
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {TASK_STATUSES.map((st) => {
            const colTasks = filteredTasks.filter((t) => t.status === st);
            return (
              <div
                key={st}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col min-h-[420px]"
              >
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {st}
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 flex-1">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => openTaskInspector(t)}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500 cursor-pointer transition-colors"
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                        {t.title}
                      </p>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        {t.priority} · {t.assignedToName}
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span>Due {t.dueDate || '—'}</span>
                        <span>{t.actualHours}/{t.estimatedHours}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Tasks Grouped by Due Date
          </h3>
          <div className="space-y-4">
            {Array.from(new Set(filteredTasks.map((t) => t.dueDate || 'Unscheduled')))
              .sort()
              .map((dateGroup) => (
                <div
                  key={dateGroup}
                  className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-none"
                >
                  <div className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 mb-2">
                    Due Date: {dateGroup}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {filteredTasks
                      .filter((t) => (t.dueDate || 'Unscheduled') === dateGroup)
                      .map((t) => (
                        <div
                          key={t.id}
                          onClick={() => openTaskInspector(t)}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-violet-400 cursor-pointer"
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {t.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {t.status} · {t.priority} · {t.projectName || 'No Project'}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Task Create / Inspector Modal with Checklists, Comments & History */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full p-6 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedTask ? `Task Inspector · ${selectedTask.id}` : 'Create New Task'}
                </h3>
                {selectedTask && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Created by {selectedTask.createdByName} on {selectedTask.createdAt.split('T')[0]} · Updated {selectedTask.updatedAt.split('T')[0]}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter clear actionable task title..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Project Association
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Unassigned</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Assigned User
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {TASK_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Est. Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Actual Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={actualHours}
                    onChange={(e) => setActualHours(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Description
                </label>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Acceptance criteria, context, and deliverables..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g., analytics, q4, modeling"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Checklist Section */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Sub-Task Checklist ({checklist.filter((c) => c.done).length}/{checklist.length})
                </label>
                <div className="space-y-1.5 mb-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggleChecklistItem(item.id)}
                          className="rounded border-slate-300 text-violet-600"
                        />
                        <span className={item.done ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}>
                          {item.text}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setChecklist((prev) => prev.filter((c) => c.id !== item.id))}
                        className="text-slate-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCheckItem}
                    onChange={(e) => setNewCheckItem(e.target.value)}
                    placeholder="Add checklist step..."
                    className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200"
                  >
                    Add Step
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                {selectedTask ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteTask(selectedTask.id);
                      setIsCreateOpen(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Archive Task
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
                  >
                    {selectedTask ? 'Save Task Updates' : 'Create Task'}
                  </button>
                </div>
              </div>
            </form>

            {/* Comments & Activity History for Existing Tasks */}
            {selectedTask && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-3">
                    <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
                    Task Discussion ({taskComments.length})
                  </h4>
                  <div className="space-y-2.5 max-h-40 overflow-y-auto mb-3">
                    {taskComments.length === 0 ? (
                      <p className="text-xs text-slate-400">No comments yet.</p>
                    ) : (
                      taskComments.map((c) => (
                        <div key={c.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs">
                          <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {c.authorName}
                            </span>
                            <span className="font-mono text-[10px]">
                              {c.createdAt.split('T')[0]}
                            </span>
                          </div>
                          <p className="text-slate-700 dark:text-slate-300">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Write a comment..."
                      className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 dark:bg-violet-600 rounded-lg"
                    >
                      Post
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-3">
                    <History className="w-3.5 h-3.5 text-violet-600" />
                    Task Activity History ({taskHistory.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {taskHistory.length === 0 ? (
                      <p className="text-xs text-slate-400">No status changes logged yet.</p>
                    ) : (
                      taskHistory.map((h) => (
                        <div key={h.id} className="text-xs border-b border-slate-100 dark:border-slate-800 pb-1.5">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {h.actionType}
                          </span>{' '}
                          <span className="text-slate-500">by {h.actorName}</span>
                          <div className="text-[11px] font-mono text-slate-400">
                            {h.createdAt.replace('T', ' ').slice(0, 16)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
