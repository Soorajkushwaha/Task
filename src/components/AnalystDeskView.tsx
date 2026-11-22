import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Plus,
  Search,
  TrendingUp,
  Scale,
  Trash2,
  Paperclip,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AnalysisCategory, AnalysisRecord } from '../types';

const ANALYSIS_CATEGORIES: AnalysisCategory[] = [
  'Business Analysis',
  'Sales Analysis',
  'Operations Analysis',
  'Marketing Analysis',
  'Financial Analysis',
  'Stock Market Analysis',
  'Technical Analysis',
  'Research',
  'Other',
];

const STATUS_OPTIONS: AnalysisRecord['status'][] = [
  'Draft',
  'In Review',
  'Completed',
  'Archived',
];

const CONFIDENCE_OPTIONS: AnalysisRecord['confidenceLevel'][] = ['Low', 'Medium', 'High'];

export const AnalystDeskView: React.FC = () => {
  const {
    analysisRecords,
    projects,
    attachments,
    createAnalysisRecord,
    updateAnalysisRecord,
    deleteAnalysisRecord,
    uploadAttachment,
    deleteAttachment,
    getAttachmentDownloadUrl,
  } = useApp();

  const [selectedId, setSelectedId] = useState<string | null>(
    analysisRecords[0]?.id || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreating, setIsCreating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const selectedRecord = useMemo(
    () => analysisRecords.find((r) => r.id === selectedId) || null,
    [analysisRecords, selectedId]
  );

  const filteredRecords = useMemo(() => {
    return analysisRecords
      .filter((r) => !r.isArchived)
      .filter((rec) => {
        if (categoryFilter !== 'ALL' && rec.category !== categoryFilter) return false;
        if (statusFilter !== 'ALL' && rec.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const hay = `${rec.title} ${rec.problemStatement} ${rec.objective} ${rec.keyFindings} ${rec.recommendations} ${rec.stockSymbol || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }, [analysisRecords, categoryFilter, statusFilter, searchQuery]);

  const initialFormState: Omit<
    AnalysisRecord,
    'id' | 'workspaceId' | 'memberUids' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'
  > = {
    title: '',
    analysisDate: new Date().toISOString().split('T')[0],
    category: 'Business Analysis',
    projectId: '',
    projectName: '',
    objective: '',
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
    exchange: 'NASDAQ',
    timeframe: '1D / Daily',
    marketTrend: 'Bullish',
    technicalObservations: '',
    supportAndResistance: '',
    indicatorsUsed: 'RSI(14), EMA(50/200), VWAP',
    tradingThesis: '',
    entryExitAssumptions: '',
    stopLossAssumption: '',
    targetAssumption: '',
    riskRewardRatio: '1 : 2.8',
    actualResult: '',
    lessonsLearned: '',
    isArchived: false,
  };

  const [formData, setFormData] = useState(initialFormState);

  const handleOpenCreate = (presetCategory?: AnalysisCategory) => {
    setFormData({
      ...initialFormState,
      category: presetCategory || 'Business Analysis',
    });
    setIsCreating(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    const proj = projects.find((p) => p.id === formData.projectId);
    const newId = await createAnalysisRecord({
      ...formData,
      projectName: proj ? proj.name : '',
    });
    if (newId) setSelectedId(newId);
    setIsCreating(false);
  };

  const isStockOrTechCategory = (cat?: AnalysisCategory) =>
    cat === 'Stock Market Analysis' || cat === 'Technical Analysis';

  const recordAttachments = useMemo(
    () =>
      attachments.filter(
        (a) => a.entityType === 'analysis' && a.entityId === selectedRecord?.id
      ),
    [attachments, selectedRecord?.id]
  );

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRecord) return;
    setUploadingFile(true);
    try {
      await uploadAttachment(file, 'analysis', selectedRecord.id, 'Shared');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Structured Research, Market Thesis & Outcome Validation
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Analyst Desk
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleOpenCreate('Stock Market Analysis')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 transition-colors cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            New Market Thesis
          </button>
          <button
            onClick={() => handleOpenCreate('Business Analysis')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Analysis Record
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search research title, symbol, problem statement, findings..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
        >
          <option value="ALL">All Categories (9)</option>
          {ANALYSIS_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
        >
          <option value="ALL">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Create Analysis Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Create Structured Analysis Record
                </h2>
                <p className="text-xs text-slate-500">
                  Document problem statement, methodology, expected outcomes, and market parameters in D1
                </p>
              </div>
              <button
                onClick={() => setIsCreating(false)}
                className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Analysis Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Q3 Cloud Infrastructure Unit Economics & Margin Expansion"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as AnalysisCategory })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {ANALYSIS_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={formData.analysisDate}
                    onChange={(e) => setFormData({ ...formData, analysisDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Confidence
                  </label>
                  <select
                    value={formData.confidenceLevel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confidenceLevel: e.target.value as AnalysisRecord['confidenceLevel'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {CONFIDENCE_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as AnalysisRecord['status'],
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                    Linked Project
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
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
              </div>

              {/* Conditional Stock Market & Technical Analysis Fields */}
              {isStockOrTechCategory(formData.category) && (
                <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
                  <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Stock Market & Technical Analysis Parameters
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 mb-1">
                        Ticker / Symbol
                      </label>
                      <input
                        type="text"
                        value={formData.stockSymbol}
                        onChange={(e) =>
                          setFormData({ ...formData, stockSymbol: e.target.value.toUpperCase() })
                        }
                        placeholder="NVDA, AAPL, NIFTY"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 mb-1">
                        Exchange
                      </label>
                      <input
                        type="text"
                        value={formData.exchange}
                        onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                        placeholder="NASDAQ / NYSE / NSE"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 mb-1">
                        Timeframe
                      </label>
                      <input
                        type="text"
                        value={formData.timeframe}
                        onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                        placeholder="4H / 1D / Weekly"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 mb-1">
                        Market Trend
                      </label>
                      <input
                        type="text"
                        value={formData.marketTrend}
                        onChange={(e) => setFormData({ ...formData, marketTrend: e.target.value })}
                        placeholder="Bullish / Consolidation"
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 mb-1">
                        Entry / Exit Assumptions
                      </label>
                      <input
                        type="text"
                        value={formData.entryExitAssumptions}
                        onChange={(e) =>
                          setFormData({ ...formData, entryExitAssumptions: e.target.value })
                        }
                        placeholder="Entry $118.50 / Exit $142.00"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 mb-1">
                        Stop-Loss Assumption
                      </label>
                      <input
                        type="text"
                        value={formData.stopLossAssumption}
                        onChange={(e) =>
                          setFormData({ ...formData, stopLossAssumption: e.target.value })
                        }
                        placeholder="$110.20 (-7.0%)"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 mb-1">
                        Target Assumption
                      </label>
                      <input
                        type="text"
                        value={formData.targetAssumption}
                        onChange={(e) =>
                          setFormData({ ...formData, targetAssumption: e.target.value })
                        }
                        placeholder="$142.00 (+19.8%)"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-500 mb-1">
                        Risk-Reward Ratio
                      </label>
                      <input
                        type="text"
                        value={formData.riskRewardRatio}
                        onChange={(e) =>
                          setFormData({ ...formData, riskRewardRatio: e.target.value })
                        }
                        placeholder="1 : 2.8"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Objective
                  </label>
                  <input
                    type="text"
                    value={formData.objective}
                    onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                    placeholder="Decision or question this analysis resolves"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Problem Statement / Thesis
                  </label>
                  <input
                    type="text"
                    value={formData.problemStatement}
                    onChange={(e) =>
                      setFormData({ ...formData, problemStatement: e.target.value })
                    }
                    placeholder="Core hypothesis or market inefficiency"
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Key Findings & Empirical Observations
                  </label>
                  <textarea
                    rows={2}
                    value={formData.keyFindings}
                    onChange={(e) => setFormData({ ...formData, keyFindings: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Strategic Recommendations
                  </label>
                  <textarea
                    rows={2}
                    value={formData.recommendations}
                    onChange={(e) =>
                      setFormData({ ...formData, recommendations: e.target.value })
                    }
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                    Expected Outcome (Ex-Ante Forecast)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.expectedOutcome}
                    onChange={(e) => setFormData({ ...formData, expectedOutcome: e.target.value })}
                    placeholder="Predicted metric delta, revenue impact, or target price..."
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                    Actual Outcome (Post-Mortem Validation)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.actualOutcome}
                    onChange={(e) => setFormData({ ...formData, actualOutcome: e.target.value })}
                    placeholder="Measured real-world outcome once realized..."
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                  Save Analysis Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-2.5 max-h-[760px] overflow-y-auto pr-1">
          {filteredRecords.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-8 text-center">
              <LineChart className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No analysis records match
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Create a structured research dossier or stock market thesis.
              </p>
            </div>
          ) : (
            filteredRecords.map((rec) => {
              const isSelected = rec.id === selectedRecord?.id;
              return (
                <button
                  key={rec.id}
                  onClick={() => setSelectedId(rec.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-500/70 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>
                      {rec.analysisDate} · {rec.status}
                    </span>
                    <span>{rec.confidenceLevel} Confidence</span>
                  </div>

                  <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5 flex items-center gap-2">
                    {rec.stockSymbol && (
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        [{rec.stockSymbol}]
                      </span>
                    )}
                    <span className="line-clamp-1">{rec.title}</span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {rec.problemStatement || rec.objective || rec.keyFindings}
                  </p>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span>{rec.category}</span>
                    <span>{rec.projectName || 'Research Desk'}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Dossier */}
        <div className="lg:col-span-8">
          {!selectedRecord ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-12 text-center">
              <LineChart className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                Select an analysis dossier
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Review structured research, compare expected vs. actual outcomes, or validate market theses.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {selectedRecord.category} · {selectedRecord.analysisDate} · Confidence:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedRecord.confidenceLevel}
                    </strong>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                    {selectedRecord.stockSymbol && (
                      <span className="font-mono text-base text-indigo-600 dark:text-indigo-400">
                        {selectedRecord.stockSymbol}
                      </span>
                    )}
                    {selectedRecord.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedRecord.status}
                    onChange={(e) =>
                      updateAnalysisRecord(selectedRecord.id, {
                        status: e.target.value as AnalysisRecord['status'],
                      })
                    }
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={async () => {
                      await deleteAnalysisRecord(selectedRecord.id);
                      setSelectedId(null);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Conditional Stock Market Technical Grid */}
              {isStockOrTechCategory(selectedRecord.category) && (
                <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">
                      Market & Technical Structure
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {selectedRecord.exchange || 'EXCHANGE'} · {selectedRecord.timeframe || '1D'} ·{' '}
                      {selectedRecord.marketTrend || 'Trend'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        Entry / Exit
                      </div>
                      <div className="text-xs font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                        {selectedRecord.entryExitAssumptions || '—'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        Stop-Loss
                      </div>
                      <div className="text-xs font-mono font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
                        {selectedRecord.stopLossAssumption || '—'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        Target Price
                      </div>
                      <div className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {selectedRecord.targetAssumption || '—'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        Risk / Reward
                      </div>
                      <div className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {selectedRecord.riskRewardRatio || '—'}
                      </div>
                    </div>
                  </div>

                  {(selectedRecord.supportAndResistance || selectedRecord.indicatorsUsed) && (
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-300 pt-1">
                      Levels: {selectedRecord.supportAndResistance || 'N/A'} · Indicators:{' '}
                      {selectedRecord.indicatorsUsed || 'N/A'}
                    </div>
                  )}
                </div>
              )}

              {/* Expected Outcome vs Actual Outcome Side-by-Side Calibration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5" />
                      Expected Outcome (Forecast)
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={selectedRecord.expectedOutcome || ''}
                    onChange={(e) =>
                      updateAnalysisRecord(selectedRecord.id, {
                        expectedOutcome: e.target.value,
                      })
                    }
                    placeholder="Document ex-ante expected outcome..."
                    className="w-full text-xs leading-relaxed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200"
                  />
                </div>

                <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Actual Outcome (Realized Result)
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={selectedRecord.actualOutcome || ''}
                    onChange={(e) =>
                      updateAnalysisRecord(selectedRecord.id, {
                        actualOutcome: e.target.value,
                      })
                    }
                    placeholder="Record actual post-mortem outcome to calibrate thesis accuracy..."
                    className="w-full text-xs leading-relaxed bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/70 rounded-lg p-2.5 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Core Structured Analysis Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Objective & Scope
                  </label>
                  <textarea
                    rows={2}
                    value={selectedRecord.objective || ''}
                    onChange={(e) =>
                      updateAnalysisRecord(selectedRecord.id, { objective: e.target.value })
                    }
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Problem Statement / Thesis
                  </label>
                  <textarea
                    rows={2}
                    value={selectedRecord.problemStatement || ''}
                    onChange={(e) =>
                      updateAnalysisRecord(selectedRecord.id, {
                        problemStatement: e.target.value,
                      })
                    }
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dataset & Methodology
                  </label>
                  <textarea
                    rows={3}
                    value={selectedRecord.datasetDescription || ''}
                    onChange={(e) =>
                      updateAnalysisRecord(selectedRecord.id, {
                        datasetDescription: e.target.value,
                      })
                    }
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Key Findings & Empirical Observations
                  </label>
                  <textarea
                    rows={3}
                    value={selectedRecord.keyFindings || ''}
                    onChange={(e) =>
                      updateAnalysisRecord(selectedRecord.id, { keyFindings: e.target.value })
                    }
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Strategic Recommendations & Decision Rules
                </label>
                <textarea
                  rows={2}
                  value={selectedRecord.recommendations || ''}
                  onChange={(e) =>
                    updateAnalysisRecord(selectedRecord.id, {
                      recommendations: e.target.value,
                    })
                  }
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {/* R2 Evidence Attachments */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                      Research Evidence & Charts in Cloudflare R2 ({recordAttachments.length})
                    </h4>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5" />
                    {uploadingFile ? 'Uploading...' : 'Attach Evidence'}
                    <input
                      type="file"
                      onChange={handleAttachmentUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </label>
                </div>

                {recordAttachments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recordAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs"
                      >
                        <div className="truncate pr-2">
                          <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {att.fileName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {(att.sizeBytes / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a
                            href={getAttachmentDownloadUrl(att.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => deleteAttachment(att.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
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
