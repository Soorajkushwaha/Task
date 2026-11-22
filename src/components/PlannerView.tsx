import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Edit3,
  ArrowRight,
  Bell,
  Repeat,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PlannerActivity, PlannerCategory, PriorityLevel } from '../types';

const CATEGORIES: PlannerCategory[] = [
  'Work',
  'Meeting',
  'Research',
  'Learning',
  'Personal',
  'Administrative',
  'Other',
];

const PRIORITIES: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

export function PlannerView() {
  const {
    plannerActivities,
    projects,
    createPlannerActivity,
    updatePlannerActivity,
    deletePlannerActivity,
  } = useApp();

  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly' | 'agenda'>('weekly');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterProject, setFilterProject] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Completed'>('All');

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingActivity, setEditingActivity] = useState<PlannerActivity | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [category, setCategory] = useState<PlannerCategory>('Work');
  const [projectId, setProjectId] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState(15);
  const [recurrence, setRecurrence] = useState<'None' | 'Daily' | 'Weekly' | 'Monthly'>('None');

  const openCreateModal = (dateOverride?: string) => {
    const d = dateOverride || selectedDate;
    setEditingActivity(null);
    setTitle('');
    setDescription('');
    setStartDate(d);
    setEndDate(d);
    setStartTime('09:00');
    setEndTime('10:00');
    setPriority('Medium');
    setCategory('Work');
    setProjectId('');
    setReminderMinutes(15);
    setRecurrence('None');
    setIsModalOpen(true);
  };

  const openEditModal = (act: PlannerActivity) => {
    setEditingActivity(act);
    setTitle(act.title);
    setDescription(act.description);
    setStartDate(act.startDate);
    setEndDate(act.endDate);
    setStartTime(act.startTime);
    setEndTime(act.endTime);
    setPriority(act.priority);
    setCategory(act.category);
    setProjectId(act.projectId);
    setReminderMinutes(act.reminderMinutes);
    setRecurrence(act.recurrence);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const assocProj = projects.find((p) => p.id === projectId);

    if (editingActivity) {
      await updatePlannerActivity(editingActivity.id, {
        title,
        description,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
        startTime,
        endTime,
        priority,
        category,
        projectId,
        projectName: assocProj?.name || '',
        reminderMinutes: Number(reminderMinutes),
        recurrence,
      });
    } else {
      await createPlannerActivity({
        title,
        description,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
        startTime,
        endTime,
        priority,
        category,
        projectId,
        projectName: assocProj?.name || '',
        reminderMinutes: Number(reminderMinutes),
        recurrence,
        completed: false,
        isArchived: false,
      });
    }
    setIsModalOpen(false);
  };

  const shiftSelectedDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const moveActivityByDays = async (act: PlannerActivity, offsetDays: number) => {
    const s = new Date(act.startDate + 'T00:00:00');
    s.setDate(s.getDate() + offsetDays);
    const e = new Date(act.endDate + 'T00:00:00');
    e.setDate(e.getDate() + offsetDays);
    await updatePlannerActivity(act.id, {
      startDate: s.toISOString().split('T')[0],
      endDate: e.toISOString().split('T')[0],
    });
  };

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return plannerActivities
      .filter((a) => !a.isArchived)
      .filter((a) => (filterCategory === 'All' ? true : a.category === filterCategory))
      .filter((a) => (filterProject === 'All' ? true : a.projectId === filterProject))
      .filter((a) => {
        if (filterStatus === 'Completed') return a.completed;
        if (filterStatus === 'Pending') return !a.completed;
        return true;
      })
      .sort((a, b) => {
        const dComp = a.startDate.localeCompare(b.startDate);
        return dComp !== 0 ? dComp : a.startTime.localeCompare(b.startTime);
      });
  }, [plannerActivities, filterCategory, filterProject, filterStatus]);

  // Helper to check if an activity occurs on a given YYYY-MM-DD date (including recurrence)
  const occursOnDate = (act: PlannerActivity, dateStr: string) => {
    if (act.startDate <= dateStr && act.endDate >= dateStr) return true;
    if (dateStr < act.startDate) return false;
    if (act.recurrence === 'Daily') return true;
    if (act.recurrence === 'Weekly') {
      const d1 = new Date(act.startDate + 'T00:00:00').getDay();
      const d2 = new Date(dateStr + 'T00:00:00').getDay();
      return d1 === d2;
    }
    if (act.recurrence === 'Monthly') {
      return act.startDate.slice(8, 10) === dateStr.slice(8, 10);
    }
    return false;
  };

  // Generate 7 days of current week around selectedDate
  const weekDays = useMemo(() => {
    const base = new Date(selectedDate + 'T00:00:00');
    const dayOfWeek = base.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const days: { dateStr: string; dayName: string; dayNum: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + mondayOffset + i);
      days.push({
        dateStr: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    return days;
  }, [selectedDate]);

  // Generate days of current month for Monthly View
  const monthDays = useMemo(() => {
    const base = new Date(selectedDate + 'T00:00:00');
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      list.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return list;
  }, [selectedDate]);

  return (
    <div className="space-y-5">
      {/* Top Planner Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['daily', 'weekly', 'monthly', 'agenda'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap shrink-0 ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {mode === 'agenda' ? 'Agenda / List' : mode}
              </button>
            ))}
          </div>

          {/* Date Navigator */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftSelectedDate(viewMode === 'monthly' ? -30 : viewMode === 'weekly' ? -7 : -1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="px-2.5 py-1 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
            <button
              onClick={() => shiftSelectedDate(viewMode === 'monthly' ? 30 : viewMode === 'weekly' ? 7 : 1)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            >
              Today
            </button>
          </div>
        </div>

        {/* Filters & Create CTA */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
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
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
          </select>

          <button
            onClick={() => openCreateModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Schedule Activity
          </button>
        </div>
      </div>

      {/* VIEW 1: DAILY VIEW */}
      {viewMode === 'daily' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Daily Schedule · {selectedDate}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All planned blocks and recurring activities for this day
              </p>
            </div>
            <button
              onClick={() => openCreateModal(selectedDate)}
              className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
            >
              + Add Activity on {selectedDate}
            </button>
          </div>

          <div className="space-y-3">
            {filteredActivities.filter((a) => occursOnDate(a, selectedDate)).length === 0 ? (
              <div className="py-12 text-center">
                <CalendarIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No activities scheduled on {selectedDate}
                </p>
                <button
                  onClick={() => openCreateModal(selectedDate)}
                  className="mt-3 px-3.5 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
                >
                  Schedule Activity
                </button>
              </div>
            ) : (
              filteredActivities
                .filter((a) => occursOnDate(a, selectedDate))
                .map((act) => (
                  <div
                    key={act.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => updatePlannerActivity(act.id, { completed: !act.completed })}
                        className="mt-0.5 text-violet-600 dark:text-violet-400"
                      >
                        {act.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <h4
                          className={`text-sm font-semibold ${
                            act.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {act.title}
                        </h4>
                        {act.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            {act.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
                          <span className="font-mono tabular-nums">
                            {act.startTime} – {act.endTime}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{act.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{act.priority} Priority</span>
                          {act.projectName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{act.projectName}</span>
                            </>
                          )}
                          {act.recurrence !== 'None' && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Repeat className="w-3 h-3" /> {act.recurrence}
                              </span>
                            </>
                          )}
                          {act.reminderMinutes > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Bell className="w-3 h-3" /> {act.reminderMinutes}m reminder
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => moveActivityByDays(act, -1)}
                        className="px-2 py-1 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        title="Move 1 day earlier"
                      >
                        -1d
                      </button>
                      <button
                        onClick={() => moveActivityByDays(act, 1)}
                        className="px-2 py-1 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        title="Move 1 day later"
                      >
                        +1d
                      </button>
                      <button
                        onClick={() => openEditModal(act)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePlannerActivity(act.id)}
                        className="p-1.5 text-slate-500 hover:text-red-600"
                        title="Archive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: WEEKLY VIEW */}
      {viewMode === 'weekly' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((wd) => {
            const dayActs = filteredActivities.filter((a) => occursOnDate(a, wd.dateStr));
            const isSelected = wd.dateStr === selectedDate;
            return (
              <div
                key={wd.dateStr}
                className={`bg-white dark:bg-slate-900 border rounded-xl p-3 flex flex-col justify-between min-h-[260px] ${
                  isSelected
                    ? 'border-violet-500 dark:border-violet-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {wd.dayName}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {wd.dayNum}
                      </div>
                    </div>
                    <button
                      onClick={() => openCreateModal(wd.dateStr)}
                      className="p-1 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded"
                      title={`Add activity on ${wd.dateStr}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {dayActs.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-slate-600 py-4 text-center">
                        No blocks
                      </p>
                    ) : (
                      dayActs.map((act) => (
                        <div
                          key={act.id}
                          onClick={() => openEditModal(act)}
                          className="p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-500 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span
                              className={`text-xs font-medium line-clamp-2 ${
                                act.completed
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {act.title}
                            </span>
                            <input
                              type="checkbox"
                              checked={act.completed}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                updatePlannerActivity(act.id, { completed: e.target.checked })
                              }
                              className="mt-0.5 rounded border-slate-300 text-violet-600 cursor-pointer"
                            />
                          </div>
                          <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">
                            {act.startTime} · {act.category}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: MONTHLY VIEW */}
      {viewMode === 'monthly' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {monthDays.map((dStr) => {
              const dayActs = filteredActivities.filter((a) => occursOnDate(a, dStr));
              const isToday = dStr === new Date().toISOString().split('T')[0];
              return (
                <div
                  key={dStr}
                  onClick={() => {
                    setSelectedDate(dStr);
                    setViewMode('daily');
                  }}
                  className={`p-2.5 rounded-lg border min-h-[105px] cursor-pointer transition-colors ${
                    isToday
                      ? 'border-violet-500 bg-violet-50/20 dark:bg-violet-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {dStr.slice(8, 10)}
                    </span>
                    {dayActs.length > 0 && (
                      <span className="text-[11px] text-violet-600 dark:text-violet-400">
                        {dayActs.length} act.
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayActs.slice(0, 3).map((act) => (
                      <div
                        key={act.id}
                        className="text-[11px] truncate text-slate-600 dark:text-slate-300"
                      >
                        <span className="font-mono">{act.startTime}</span> {act.title}
                      </div>
                    ))}
                    {dayActs.length > 3 && (
                      <div className="text-[10px] text-slate-400">
                        +{dayActs.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 4: AGENDA / LIST VIEW */}
      {viewMode === 'agenda' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Activity Title</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Category & Priority</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                      No matching planner activities found.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={act.completed}
                          onChange={(e) =>
                            updatePlannerActivity(act.id, { completed: e.target.checked })
                          }
                          className="rounded border-slate-300 text-violet-600 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <p
                          className={`font-medium ${
                            act.completed
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {act.title}
                        </p>
                        {act.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {act.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {act.startDate} · {act.startTime}–{act.endTime}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {act.category} · {act.priority}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                        {act.projectName || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => moveActivityByDays(act, 1)}
                            className="px-2 py-1 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Move to next day"
                          >
                            +1d
                          </button>
                          <button
                            onClick={() => openEditModal(act)}
                            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePlannerActivity(act.id)}
                            className="p-1 text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Activity Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {editingActivity ? 'Edit Planner Activity' : 'Schedule Planner Activity'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Activity Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Deep Work: Financial Model Calibration"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PlannerCategory)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
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
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Project
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Recurrence
                  </label>
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="None">None</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Reminder (min)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={reminderMinutes}
                    onChange={(e) => setReminderMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description & Preparation Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Agenda, objectives, or preparation links..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
                >
                  {editingActivity ? 'Save Changes' : 'Schedule Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
