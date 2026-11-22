import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Task,
  Project,
  JournalEntry,
  AnalysisRecord,
  PlannerActivity,
  WorkspaceMember,
} from '../types';

export type ReportType =
  | 'Daily Work Report'
  | 'Weekly Work Summary'
  | 'Monthly Performance Report'
  | 'Project Progress Report'
  | 'Task Completion Report'
  | 'Work Journal Export'
  | 'Analyst Research Report'
  | 'Team Productivity Report'
  | 'Custom Date Range Report';

export interface ReportExportPayload {
  reportTitle: string;
  workspaceName: string;
  dateRangeLabel: string;
  summaryKpis: { label: string; value: string | number }[];
  columns: string[];
  rows: (string | number)[][];
}

export function exportToExcel(payload: ReportExportPayload) {
  const wb = XLSX.utils.book_new();

  const summaryData: (string | number)[][] = [
    ['WHIMSYMAYA — Plan. Record. Analyse. Improve.'],
    ['Report Title', payload.reportTitle],
    ['Workspace', payload.workspaceName],
    ['Date Range', payload.dateRangeLabel],
    ['Generated At', new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'],
    [],
    ['Summary KPI', 'Value'],
    ...payload.summaryKpis.map((k) => [k.label, k.value]),
    [],
    payload.columns,
    ...payload.rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws, 'WhimsyMaya Report');

  const safeName = payload.reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  XLSX.writeFile(wb, `whimsymaya_${safeName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportToCsv(payload: ReportExportPayload) {
  const wb = XLSX.utils.book_new();
  const sheetData: (string | number)[][] = [
    ['Application', 'WhimsyMaya'],
    ['Report Title', payload.reportTitle],
    ['Workspace', payload.workspaceName],
    ['Date Range', payload.dateRangeLabel],
    ['Generated At', new Date().toISOString()],
    [],
    payload.columns,
    ...payload.rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const safeName = payload.reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  XLSX.writeFile(wb, `whimsymaya_${safeName}_${new Date().toISOString().split('T')[0]}.csv`, {
    bookType: 'csv',
  });
}

export function exportToPdf(payload: ReportExportPayload) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(`WHIMSYMAYA — ${payload.reportTitle}`, 40, 40);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Workspace: ${payload.workspaceName}  |  Range: ${payload.dateRangeLabel}  |  Generated: ${new Date().toISOString().split('T')[0]}`,
    40,
    58
  );

  const kpiText = payload.summaryKpis.map((k) => `${k.label}: ${k.value}`).join('   ·   ');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(kpiText, 40, 76);

  autoTable(doc, {
    startY: 92,
    head: [payload.columns],
    body: payload.rows.map((r) => r.map((c) => String(c))),
    styles: {
      fontSize: 8.5,
      cellPadding: 6,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const safeName = payload.reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  doc.save(`whimsymaya_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function buildReportPayload(
  reportType: ReportType,
  workspaceName: string,
  data: {
    tasks: Task[];
    projects: Project[];
    journalEntries: JournalEntry[];
    analysisRecords: AnalysisRecord[];
    plannerActivities: PlannerActivity[];
    members: WorkspaceMember[];
  },
  filters: {
    startDate?: string;
    endDate?: string;
    projectId?: string;
  }
): ReportExportPayload {
  const todayStr = new Date().toISOString().split('T')[0];
  const weekAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgoStr = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const filterByProject = <T extends { projectId?: string }>(items: T[]) =>
    filters.projectId ? items.filter((i) => i.projectId === filters.projectId) : items;

  const filterByDate = (dateVal: string, minDate?: string, maxDate?: string) => {
    const d = (dateVal || '').slice(0, 10);
    if (minDate && d < minDate) return false;
    if (maxDate && d > maxDate) return false;
    return true;
  };

  const eligibleTasks = filterByProject(data.tasks).filter((t) => t.status !== 'Cancelled');
  const completedTasks = eligibleTasks.filter((t) => t.status === 'Completed');
  const completionRate =
    eligibleTasks.length > 0
      ? `${Math.round((completedTasks.length / eligibleTasks.length) * 1000) / 10}%`
      : '0%';

  if (reportType === 'Project Progress Report') {
    const projs = filters.projectId
      ? data.projects.filter((p) => p.id === filters.projectId)
      : data.projects;
    return {
      reportTitle: reportType,
      workspaceName,
      dateRangeLabel: 'All Active & Historical Projects',
      summaryKpis: [
        { label: 'Total Projects', value: projs.length },
        {
          label: 'Completed Projects',
          value: projs.filter((p) => p.status === 'Completed').length,
        },
        { label: 'Overall Task Completion', value: completionRate },
      ],
      columns: ['Project Name', 'Owner', 'Status', 'Priority', 'Progress %', 'Start Date', 'Target Deadline'],
      rows: projs.map((p) => [
        p.name,
        p.ownerName,
        p.status,
        p.priority,
        `${p.progressPercentage}%`,
        p.startDate,
        p.targetDeadline,
      ]),
    };
  }

  if (reportType === 'Work Journal Export') {
    const journals = filterByProject(data.journalEntries).filter((j) =>
      filterByDate(j.entryDate, filters.startDate, filters.endDate)
    );
    const totalHours = journals.reduce((s, j) => s + (Number(j.timeSpentHours) || 0), 0);
    return {
      reportTitle: reportType,
      workspaceName,
      dateRangeLabel:
        filters.startDate || filters.endDate
          ? `${filters.startDate || 'Start'} to ${filters.endDate || 'Present'}`
          : 'All Journal Entries',
      summaryKpis: [
        { label: 'Journal Entries', value: journals.length },
        { label: 'Total Logged Hours', value: `${Math.round(totalHours * 10) / 10}h` },
      ],
      columns: ['Date', 'Time', 'Title', 'Category', 'Project', 'Hours', 'Achievements', 'Visibility'],
      rows: journals.map((j) => [
        j.entryDate,
        j.entryTime,
        j.title,
        j.category,
        j.projectName || 'General',
        j.timeSpentHours,
        j.achievements || '—',
        j.visibility,
      ]),
    };
  }

  if (reportType === 'Analyst Research Report') {
    const analyses = filterByProject(data.analysisRecords).filter((a) =>
      filterByDate(a.analysisDate, filters.startDate, filters.endDate)
    );
    return {
      reportTitle: reportType,
      workspaceName,
      dateRangeLabel: 'Structured Analyst Dossiers',
      summaryKpis: [
        { label: 'Total Research Dossiers', value: analyses.length },
        {
          label: 'Completed / Verified',
          value: analyses.filter((a) => a.status === 'Completed').length,
        },
      ],
      columns: ['Date', 'Title', 'Category', 'Ticker', 'Status', 'Confidence', 'Expected Outcome', 'Actual Outcome'],
      rows: analyses.map((a) => [
        a.analysisDate,
        a.title,
        a.category,
        a.stockSymbol || '—',
        a.status,
        a.confidenceLevel,
        a.expectedOutcome || '—',
        a.actualOutcome || '—',
      ]),
    };
  }

  if (reportType === 'Team Productivity Report') {
    return {
      reportTitle: reportType,
      workspaceName,
      dateRangeLabel: 'Active Team Member Workload',
      summaryKpis: [
        { label: 'Team Members', value: data.members.length },
        { label: 'Workspace Task Completion', value: completionRate },
      ],
      columns: ['Member Name', 'Role', 'Assigned Tasks', 'Completed Tasks', 'Completion Rate', 'Logged Hours'],
      rows: data.members.map((m) => {
        const mTasks = data.tasks.filter(
          (t) => t.assignedTo === m.userId && t.status !== 'Cancelled'
        );
        const mDone = mTasks.filter((t) => t.status === 'Completed').length;
        const mHours = mTasks.reduce((s, t) => s + (Number(t.actualHours) || 0), 0);
        const rate = mTasks.length > 0 ? `${Math.round((mDone / mTasks.length) * 100)}%` : '0%';
        return [
          m.displayName,
          m.role,
          mTasks.length,
          mDone,
          rate,
          `${Math.round(mHours * 10) / 10}h`,
        ];
      }),
    };
  }

  // Task-based & Date-window reports (Daily, Weekly, Monthly, Task Completion, Custom Date Range)
  let minD = filters.startDate;
  let maxD = filters.endDate;
  if (reportType === 'Daily Work Report') {
    minD = todayStr;
    maxD = todayStr;
  } else if (reportType === 'Weekly Work Summary') {
    minD = weekAgoStr;
  } else if (reportType === 'Monthly Performance Report') {
    minD = monthAgoStr;
  }

  const filteredTasks = filterByProject(data.tasks).filter((t) =>
    filterByDate(t.dueDate || t.createdAt, minD, maxD)
  );
  const totalActual = filteredTasks.reduce((s, t) => s + (Number(t.actualHours) || 0), 0);

  return {
    reportTitle: reportType,
    workspaceName,
    dateRangeLabel: minD || maxD ? `${minD || 'Start'} to ${maxD || 'Present'}` : 'All Dates',
    summaryKpis: [
      { label: 'Tasks in Scope', value: filteredTasks.length },
      { label: 'Task Completion Rate', value: completionRate },
      { label: 'Logged Task Hours', value: `${Math.round(totalActual * 10) / 10}h` },
    ],
    columns: ['Task Title', 'Project', 'Assignee', 'Priority', 'Status', 'Due Date', 'Est. Hours', 'Actual Hours'],
    rows: filteredTasks.map((t) => [
      t.title,
      t.projectName || 'General',
      t.assignedToName || 'Unassigned',
      t.priority,
      t.status,
      t.dueDate || '—',
      t.estimatedHours,
      t.actualHours,
    ]),
  };
}
