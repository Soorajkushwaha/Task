import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  Users,
  FileText,
  Trash2,
  Edit3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Project, ProjectStatus, PriorityLevel } from '../types';

const PROJECT_STATUSES: ProjectStatus[] = [
  'Planning',
  'Active',
  'On Hold',
  'Completed',
  'Archived',
];

const PRIORITIES: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

export function ProjectsView() {
  const {
    projects,
    tasks,
    members,
    milestones,
    auditLogs,
    selectedProjectId,
    setSelectedProjectId,
    createProject,
    updateProject,
    deleteProject,
    createMilestone,
    toggleMilestone,
    deleteMilestone,
    setQuickCreateModal,
  } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [targetDeadline, setTargetDeadline] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<ProjectStatus>('Active');
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [notes, setNotes] = useState('');

  // Milestone input on project detail page
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDue, setNewMilestoneDue] = useState(() => new Date().toISOString().split('T')[0]);

  const openCreateModal = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setTargetDeadline(new Date().toISOString().split('T')[0]);
    setStatus('Active');
    setPriority('High');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setName(proj.name);
    setDescription(proj.description);
    setStartDate(proj.startDate);
    setTargetDeadline(proj.targetDeadline);
    setStatus(proj.status);
    setPriority(proj.priority);
    setNotes(proj.notes);
    setIsModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingProject) {
      await updateProject(editingProject.id, {
        name,
        description,
        startDate,
        targetDeadline,
        status,
        priority,
        notes,
      });
    } else {
      await createProject({
        name,
        description,
        startDate,
        targetDeadline,
        status,
        priority,
        notes,
      });
    }
    setIsModalOpen(false);
  };

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  // Calculate dynamic project progress using completed vs total eligible tasks (excluding cancelled tasks)
  const getProjectMetrics = (projId: string) => {
    const projTasks = tasks.filter((t) => t.projectId === projId && !t.isArchived);
    const eligible = projTasks.filter((t) => t.status !== 'Cancelled');
    const completed = eligible.filter((t) => t.status === 'Completed');
    const progress =
      eligible.length > 0 ? Math.round((completed.length / eligible.length) * 100) : 0;
    const estHours = projTasks.reduce((s, t) => s + (Number(t.estimatedHours) || 0), 0);
    const actHours = projTasks.reduce((s, t) => s + (Number(t.actualHours) || 0), 0);
    return {
      totalEligible: eligible.length,
      completedCount: completed.length,
      cancelledCount: projTasks.length - eligible.length,
      progress,
      estHours: Number(estHours.toFixed(1)),
      actHours: Number(actHours.toFixed(1)),
      projTasks,
    };
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) =>
      filterStatus === 'All' ? p.status !== 'Archived' : p.status === filterStatus
    );
  }, [projects, filterStatus]);

  // PROJECT DETAIL PAGE
  if (activeProject) {
    const metrics = getProjectMetrics(activeProject.id);
    const projMilestones = milestones.filter((m) => m.projectId === activeProject.id);
    const projLogs = auditLogs.filter((l) => l.projectId === activeProject.id);

    return (
      <div className="space-y-6">
        {/* Detail Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSelectedProjectId(null)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Projects Portfolio
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openEditModal(activeProject)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Project
              </button>
              <button
                onClick={() => setQuickCreateModal('task')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Project Task
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="font-mono">{activeProject.id}</span>
                <span aria-hidden="true">·</span>
                <span>{activeProject.status}</span>
                <span aria-hidden="true">·</span>
                <span>{activeProject.priority} Priority</span>
                <span aria-hidden="true">·</span>
                <span>Owner: {activeProject.ownerName}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {activeProject.name}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                {activeProject.description || 'No project description provided.'}
              </p>
            </div>

            {/* Progress & Report Summary Box */}
            <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                <span>Eligible Task Completion</span>
                <span className="font-mono tabular-nums font-bold text-violet-600 dark:text-violet-400">
                  {metrics.progress}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-violet-600 dark:bg-violet-500 transition-all"
                  style={{ width: `${metrics.progress}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {metrics.completedCount}/{metrics.totalEligible}
                  </div>
                  <div className="text-[11px] text-slate-500">Tasks Done</div>
                </div>
                <div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {metrics.actHours}h / {metrics.estHours}h
                  </div>
                  <div className="text-[11px] text-slate-500">Actual / Est</div>
                </div>
                <div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {activeProject.targetDeadline || '—'}
                  </div>
                  <div className="text-[11px] text-slate-500">Deadline</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project Tasks + Milestones + Team & Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Project Tasks Table */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Project Tasks ({metrics.projTasks.length})
            </h3>
            {metrics.projTasks.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No tasks linked to this project yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.projTasks.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {t.title}
                      </p>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {t.status} · {t.priority} · Assigned to {t.assignedToName}
                      </div>
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-500 text-right shrink-0">
                      <div>Due {t.dueDate || '—'}</div>
                      <div>{t.actualHours}h / {t.estimatedHours}h</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Milestones & Notes */}
          <div className="lg:col-span-5 space-y-6">
            {/* Milestones */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Project Milestones ({projMilestones.filter((m) => m.completed).length}/{projMilestones.length})
              </h3>
              <div className="space-y-2 mb-4">
                {projMilestones.length === 0 ? (
                  <p className="text-xs text-slate-500">No milestones added yet.</p>
                ) : (
                  projMilestones.map((ms) => (
                    <div
                      key={ms.id}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-none"
                    >
                      <button
                        onClick={() => toggleMilestone(ms.id, !ms.completed)}
                        className="flex items-center gap-2 text-left text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        {ms.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className={ms.completed ? 'line-through text-slate-400' : ''}>
                          {ms.title}
                        </span>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-slate-400">{ms.dueDate}</span>
                        <button
                          onClick={() => deleteMilestone(ms.id)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  placeholder="Milestone title..."
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
                <input
                  type="date"
                  value={newMilestoneDue}
                  onChange={(e) => setNewMilestoneDue(e.target.value)}
                  className="px-2 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
                <button
                  onClick={() => {
                    if (newMilestoneTitle.trim()) {
                      createMilestone(activeProject.id, newMilestoneTitle, newMilestoneDue);
                      setNewMilestoneTitle('');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Project Notes & Team Members */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Project Notes & Documentation
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-4">
                {activeProject.notes || 'No executive notes recorded yet.'}
              </p>

              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                Assigned Team Members ({members.length})
              </h4>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                {members.map((m) => (
                  <span key={m.id}>
                    {m.displayName} ({m.role})
                  </span>
                ))}
              </div>
            </div>

            {/* Project Activity Timeline */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Project Activity Timeline
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {projLogs.length === 0 ? (
                  <p className="text-xs text-slate-400">No project events logged yet.</p>
                ) : (
                  projLogs.map((l) => (
                    <div key={l.id} className="text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {l.actionType} · {l.entityTitle}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {l.actorName} · <span className="font-mono">{l.createdAt.split('T')[0]}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PROJECTS PORTFOLIO GRID
  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(['All', ...PROJECT_STATUSES] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filterStatus === st
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Project
        </button>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <FolderKanban className="w-9 h-9 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            No projects in this view
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Create a project to structure deliverables, milestones, and progress tracking.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
          >
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((proj) => {
            const metrics = getProjectMetrics(proj.id);
            return (
              <div
                key={proj.id}
                onClick={() => setSelectedProjectId(proj.id)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500 rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span>
                      {proj.status} · {proj.priority} Priority
                    </span>
                    <span className="font-mono tabular-nums">Due {proj.targetDeadline || '—'}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                    {proj.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                    {proj.description}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400">
                      {metrics.completedCount} of {metrics.totalEligible} eligible tasks
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {metrics.progress}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-violet-600 dark:bg-violet-500"
                      style={{ width: `${metrics.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <span>Owner: {proj.ownerName}</span>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditModal(proj)}
                        className="hover:text-slate-900 dark:hover:text-white"
                      >
                        Edit
                      </button>
                      <span>·</span>
                      <button
                        onClick={() => deleteProject(proj.id)}
                        className="hover:text-red-600"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              {editingProject ? 'Edit Project' : 'Create New Project'}
            </h3>
            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q4 Revenue Analytics & Forecasting"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {PROJECT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Deadline
                  </label>
                  <input
                    type="date"
                    value={targetDeadline}
                    onChange={(e) => setTargetDeadline(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Project Description
                </label>
                <textarea
                  rows={2}
                  maxLength={4000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Executive Notes & Scope
                </label>
                <textarea
                  rows={3}
                  maxLength={8000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg"
                >
                  {editingProject ? 'Save Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
