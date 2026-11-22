import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Lock,
  Globe,
  Trash2,
  Save,
  Check,
  Clock,
  Paperclip,
  Download,
  Award,
  AlertCircle,
  Lightbulb,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { JournalEntry } from '../types';
import { useDebounce } from '../hooks/useDebounce';

const CATEGORIES = [
  'Engineering',
  'Architecture',
  'Operations',
  'Strategy',
  'Research',
  'Leadership',
  'Finance',
  'Client Delivery',
  'General',
];

export const JournalView: React.FC = () => {
  const {
    journalEntries,
    projects,
    tasks,
    attachments,
    createJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    uploadAttachment,
    deleteAttachment,
    getAttachmentDownloadUrl,
  } = useApp();

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    journalEntries[0]?.id || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [filterVisibility, setFilterVisibility] = useState<string>('ALL');
  const [summaryRange, setSummaryRange] = useState<'all' | 'week' | 'month'>('all');

  const selectedEntry = useMemo(
    () => journalEntries.find((j) => j.id === selectedEntryId) || null,
    [journalEntries, selectedEntryId]
  );

  const [draft, setDraft] = useState<Partial<JournalEntry>>({});
  const [tagInput, setTagInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [uploadingFile, setUploadingFile] = useState(false);
  const isHydratingRef = useRef(false);

  useEffect(() => {
    if (selectedEntry) {
      isHydratingRef.current = true;
      setDraft({
        title: selectedEntry.title,
        entryDate: selectedEntry.entryDate,
        entryTime: selectedEntry.entryTime,
        category: selectedEntry.category,
        projectId: selectedEntry.projectId || '',
        projectName: selectedEntry.projectName || '',
        relatedTaskId: selectedEntry.relatedTaskId || '',
        relatedTaskTitle: selectedEntry.relatedTaskTitle || '',
        description: selectedEntry.description,
        activitiesPerformed: selectedEntry.activitiesPerformed,
        achievements: selectedEntry.achievements,
        challenges: selectedEntry.challenges,
        decisionsMade: selectedEntry.decisionsMade,
        lessonsLearned: selectedEntry.lessonsLearned,
        nextSteps: selectedEntry.nextSteps,
        timeSpentHours: selectedEntry.timeSpentHours,
        tags: selectedEntry.tags || [],
        visibility: selectedEntry.visibility,
      });
      setTagInput((selectedEntry.tags || []).join(', '));
      setSaveStatus('saved');
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 60);
    }
  }, [selectedEntry?.id]);

  const debouncedDraft = useDebounce(draft, 900);

  useEffect(() => {
    if (!selectedEntry || isHydratingRef.current) return;
    if (saveStatus !== 'unsaved') return;

    let cancelled = false;
    const performAutosave = async () => {
      setSaveStatus('saving');
      try {
        const parsedTags = tagInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        const proj = projects.find((p) => p.id === debouncedDraft.projectId);
        const relTask = tasks.find((t) => t.id === debouncedDraft.relatedTaskId);
        await updateJournalEntry(
          selectedEntry.id,
          {
            ...debouncedDraft,
            projectId: debouncedDraft.projectId || '',
            projectName: proj ? proj.name : '',
            relatedTaskId: debouncedDraft.relatedTaskId || '',
            relatedTaskTitle: relTask ? relTask.title : '',
            tags: parsedTags,
          },
          true
        );
        if (!cancelled) setSaveStatus('saved');
      } catch {
        if (!cancelled) setSaveStatus('unsaved');
      }
    };

    performAutosave();
    return () => {
      cancelled = true;
    };
  }, [debouncedDraft]);

  const handleFieldChange = <K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setSaveStatus('unsaved');
  };

  const handleTagInputChange = (val: string) => {
    setTagInput(val);
    const parsed = val
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    setDraft((prev) => ({ ...prev, tags: parsed }));
    setSaveStatus('unsaved');
  };

  const handleManualSave = async () => {
    if (!selectedEntry) return;
    setSaveStatus('saving');
    try {
      const parsedTags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const proj = projects.find((p) => p.id === draft.projectId);
      const relTask = tasks.find((t) => t.id === draft.relatedTaskId);
      await updateJournalEntry(selectedEntry.id, {
        ...draft,
        projectId: draft.projectId || '',
        projectName: proj ? proj.name : '',
        relatedTaskId: draft.relatedTaskId || '',
        relatedTaskTitle: relTask ? relTask.title : '',
        tags: parsedTags,
      });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('unsaved');
    }
  };

  const handleCreateNewEntry = async () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const newId = await createJournalEntry({
      title: `Work Log — ${todayStr}`,
      entryDate: todayStr,
      entryTime: timeStr,
      category: 'Engineering',
      projectId: '',
      projectName: '',
      relatedTaskId: '',
      relatedTaskTitle: '',
      description: 'Summary of primary deep work and operational deliverables.',
      activitiesPerformed: '',
      achievements: '',
      challenges: '',
      decisionsMade: '',
      lessonsLearned: '',
      nextSteps: '',
      timeSpentHours: 2.0,
      tags: ['daily-log'],
      visibility: 'Private',
      isArchived: false,
    });
    if (newId) setSelectedEntryId(newId);
  };

  const filteredEntries = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    return journalEntries
      .filter((e) => !e.isArchived)
      .filter((entry) => {
        if (filterCategory !== 'ALL' && entry.category !== filterCategory) return false;
        if (filterProject !== 'ALL' && entry.projectId !== filterProject) return false;
        if (filterVisibility !== 'ALL' && entry.visibility !== filterVisibility) return false;
        if (summaryRange === 'week' && entry.entryDate < weekAgo) return false;
        if (summaryRange === 'month' && entry.entryDate < monthStart) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const hay = `${entry.title} ${entry.description} ${entry.achievements} ${entry.decisionsMade} ${entry.lessonsLearned} ${(entry.tags || []).join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [journalEntries, filterCategory, filterProject, filterVisibility, summaryRange, searchQuery]);

  useEffect(() => {
    if (!selectedEntryId && filteredEntries.length > 0) {
      setSelectedEntryId(filteredEntries[0].id);
    }
  }, [filteredEntries, selectedEntryId]);

  const entryAttachments = useMemo(
    () =>
      attachments.filter(
        (a) => a.entityType === 'journal' && a.entityId === selectedEntry?.id
      ),
    [attachments, selectedEntry?.id]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEntry) return;
    setUploadingFile(true);
    try {
      await uploadAttachment(
        file,
        'journal',
        selectedEntry.id,
        draft.visibility || selectedEntry.visibility
      );
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const summaryStats = useMemo(() => {
    const totalHours = filteredEntries.reduce((acc, e) => acc + (Number(e.timeSpentHours) || 0), 0);
    const withAchievements = filteredEntries.filter(
      (e) => e.achievements && e.achievements.trim().length > 0
    ).length;
    const privateCount = filteredEntries.filter((e) => e.visibility === 'Private').length;
    return {
      count: filteredEntries.length,
      totalHours: Math.round(totalHours * 10) / 10,
      withAchievements,
      privateCount,
    };
  }, [filteredEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Daily Work Journal & Executive Log
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Work Journal
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0.5">
            {(['all', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSummaryRange(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  summaryRange === mode
                    ? 'bg-slate-900 text-white dark:bg-indigo-600'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {mode === 'all' ? 'All Entries' : mode === 'week' ? 'Weekly Summary' : 'Monthly Summary'}
              </button>
            ))}
          </div>

          <button
            onClick={handleCreateNewEntry}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Journal Entry
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Filtered Entries</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {summaryStats.count}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {summaryStats.privateCount} private · {summaryStats.count - summaryStats.privateCount} shared
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Logged Journal Hours</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {summaryStats.totalHours}h
          </div>
          <div className="text-xs text-slate-400 mt-1">Cumulative deep work recorded</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Achievements Documented</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {summaryStats.withAchievements}
          </div>
          <div className="text-xs text-slate-400 mt-1">Entries containing key outcomes</div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">Default Privacy Posture</div>
          <div className="text-base font-semibold text-slate-900 dark:text-white mt-1.5 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-indigo-500" />
            Private by Default
          </div>
          <div className="text-xs text-slate-400 mt-1">Owner-isolated in Cloudflare D1</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search journal entries, achievements, lessons, tags..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
        >
          <option value="ALL">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
        >
          <option value="ALL">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={filterVisibility}
          onChange={(e) => setFilterVisibility(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
        >
          <option value="ALL">All Visibility</option>
          <option value="Private">Private Only</option>
          <option value="Shared">Shared with Team</option>
        </select>
      </div>

      {/* Master-Detail Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-2.5 max-h-[760px] overflow-y-auto pr-1">
          {filteredEntries.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No journal entries found
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Create a daily work entry to document your activities, decisions, and achievements.
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isSelected = entry.id === selectedEntry?.id;
              const proj = projects.find((p) => p.id === entry.projectId);
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntryId(entry.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-500/70 dark:border-indigo-500/60 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <span>
                      {entry.entryDate} · {entry.entryTime}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {entry.visibility === 'Private' ? (
                        <>
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>Private</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3 text-indigo-500" />
                          <span className="text-indigo-600 dark:text-indigo-400">Shared</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5 line-clamp-1">
                    {entry.title}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {entry.description || 'No description yet...'}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 font-mono">
                    <span>
                      {entry.category}
                      {proj ? ` · ${proj.name}` : ''}
                    </span>
                    <span>{entry.timeSpentHours}h</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Full Structured Journal Editor */}
        <div className="lg:col-span-8">
          {!selectedEntry ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-12 text-center">
              <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                Select or create a journal entry
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Your work journal automatically saves as you type and keeps private entries isolated to your account in Cloudflare D1.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    {saveStatus === 'saving' && (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                        <span>Autosaving to D1...</span>
                      </>
                    )}
                    {saveStatus === 'saved' && (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>All changes saved</span>
                      </>
                    )}
                    {saveStatus === 'unsaved' && (
                      <>
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Unsaved edits...</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleFieldChange(
                        'visibility',
                        draft.visibility === 'Shared' ? 'Private' : 'Shared'
                      )
                    }
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      draft.visibility === 'Shared'
                        ? 'border-indigo-500/40 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {draft.visibility === 'Shared' ? (
                      <>
                        <Globe className="w-3.5 h-3.5 text-indigo-500" />
                        Shared with Workspace
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        Private Entry
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleManualSave}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-indigo-600 text-white hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Now
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      await deleteJournalEntry(selectedEntry.id);
                      setSelectedEntryId(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Title & Core Metadata */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                    Entry Title
                  </label>
                  <input
                    type="text"
                    value={draft.title || ''}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    placeholder="Entry title..."
                    className="w-full text-lg font-bold bg-transparent border-b border-slate-200 dark:border-slate-800 pb-2 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={draft.entryDate || ''}
                      onChange={(e) => handleFieldChange('entryDate', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={draft.entryTime || ''}
                      onChange={(e) => handleFieldChange('entryTime', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Category
                    </label>
                    <select
                      value={draft.category || 'Engineering'}
                      onChange={(e) => handleFieldChange('category', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Time Spent (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={draft.timeSpentHours ?? 0}
                      onChange={(e) =>
                        handleFieldChange('timeSpentHours', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Related Project
                    </label>
                    <select
                      value={draft.projectId || ''}
                      onChange={(e) => handleFieldChange('projectId', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
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
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Related Task
                    </label>
                    <select
                      value={draft.relatedTaskId || ''}
                      onChange={(e) => handleFieldChange('relatedTaskId', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    >
                      <option value="">None</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => handleTagInputChange(e.target.value)}
                      placeholder="d1, migration, architecture"
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Primary Narrative Sections */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Description & Executive Summary
                  </label>
                  <textarea
                    rows={3}
                    value={draft.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Detailed narrative of work executed..."
                    className="w-full p-3 text-xs leading-relaxed bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Activities Performed
                  </label>
                  <textarea
                    rows={2}
                    value={draft.activitiesPerformed || ''}
                    onChange={(e) => handleFieldChange('activitiesPerformed', e.target.value)}
                    placeholder="Specific engineering, operational, or research tasks completed..."
                    className="w-full p-3 text-xs leading-relaxed bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                      <Award className="w-3.5 h-3.5" />
                      Key Achievements & Deliverables
                    </label>
                    <textarea
                      rows={3}
                      value={draft.achievements || ''}
                      onChange={(e) => handleFieldChange('achievements', e.target.value)}
                      placeholder="Quantifiable wins, milestones shipped, or breakthroughs..."
                      className="w-full p-3 text-xs leading-relaxed bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Challenges & Blockers Encountered
                    </label>
                    <textarea
                      rows={3}
                      value={draft.challenges || ''}
                      onChange={(e) => handleFieldChange('challenges', e.target.value)}
                      placeholder="Technical obstacles, bottlenecks, or open risks..."
                      className="w-full p-3 text-xs leading-relaxed bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Decisions Made
                    </label>
                    <textarea
                      rows={3}
                      value={draft.decisionsMade || ''}
                      onChange={(e) => handleFieldChange('decisionsMade', e.target.value)}
                      placeholder="Architectural or operational trade-offs finalized..."
                      className="w-full p-2.5 text-xs leading-relaxed bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <Lightbulb className="w-3.5 h-3.5 text-indigo-500" />
                      Lessons Learned
                    </label>
                    <textarea
                      rows={3}
                      value={draft.lessonsLearned || ''}
                      onChange={(e) => handleFieldChange('lessonsLearned', e.target.value)}
                      placeholder="Insights gained for future iterations..."
                      className="w-full p-2.5 text-xs leading-relaxed bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                      Next Steps
                    </label>
                    <textarea
                      rows={3}
                      value={draft.nextSteps || ''}
                      onChange={(e) => handleFieldChange('nextSteps', e.target.value)}
                      placeholder="Follow-up action items for tomorrow..."
                      className="w-full p-2.5 text-xs leading-relaxed bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Cloudflare R2 Attachments Section */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                      Cloudflare R2 Attachments ({entryAttachments.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Files stored in Cloudflare R2 bucket with metadata indexed in D1 (max 10 MB)
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors">
                    <Paperclip className="w-3.5 h-3.5" />
                    {uploadingFile ? 'Uploading to R2...' : 'Attach File'}
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {entryAttachments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {entryAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs"
                      >
                        <div className="truncate pr-2">
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {att.fileName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {(att.sizeBytes / 1024).toFixed(1)} KB · {att.visibility}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={getAttachmentDownloadUrl(att.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded"
                            title="Download from R2"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => deleteAttachment(att.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            title="Delete from R2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
