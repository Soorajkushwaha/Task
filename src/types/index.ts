export type NavTab =
  | 'dashboard'
  | 'planner'
  | 'tasks'
  | 'projects'
  | 'journal'
  | 'analyst'
  | 'track-record'
  | 'reports'
  | 'team'
  | 'notifications'
  | 'settings';

export type WorkspaceRole = 'Owner' | 'Admin' | 'Manager' | 'Member';
export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Under Review' | 'Completed' | 'On Hold' | 'Cancelled';
export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Archived';
export type PlannerCategory = 'Work' | 'Meeting' | 'Research' | 'Learning' | 'Personal' | 'Administrative' | 'Other';
export type AnalysisCategory =
  | 'Business Analysis'
  | 'Sales Analysis'
  | 'Operations Analysis'
  | 'Marketing Analysis'
  | 'Financial Analysis'
  | 'Stock Market Analysis'
  | 'Technical Analysis'
  | 'Research'
  | 'Other';

export interface WorkerCapabilities {
  betterAuthConfigured: boolean;
  turnstileConfigured: boolean;
  turnstileSiteKey: string;
  googleOAuthConfigured: boolean;
  emailResetConfigured: boolean;
  d1Configured: boolean;
  r2Configured: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  emailVerified?: boolean;
  displayName: string;
  photoURL: string;
  roleTitle: string;
  timezone: string;
  dateFormat: string;
  theme: 'light' | 'dark';
  defaultWorkspaceId: string;
  notifyDeadlines: boolean;
  notifyAssignments: boolean;
  notifyJournal: boolean;
  notifyInvites: boolean;
  privateJournalDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  type: 'personal' | 'team';
  ownerId: string;
  inviteCode: string;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  photoURL: string;
  role: WorkspaceRole;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  workspaceName: string;
  inviteCode: string;
  invitedLabel: string;
  assignedRole: 'Admin' | 'Manager' | 'Member';
  status: 'Pending' | 'Accepted' | 'Revoked';
  expiresAt?: string;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  startDate: string;
  targetDeadline: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  notes: string;
  progressPercentage: number;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  projectId: string;
  projectName: string;
  assignedTo: string;
  assignedToName: string;
  createdBy: string;
  createdByName: string;
  startDate: string;
  dueDate: string;
  priority: PriorityLevel;
  status: TaskStatus;
  estimatedHours: number;
  actualHours: number;
  tags: string[];
  checklistSummary: string;
  completionDate: string;
  isArchived: boolean;
  memberUids: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlannerActivity {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  priority: PriorityLevel;
  category: PlannerCategory;
  projectId: string;
  projectName: string;
  reminderMinutes: number;
  recurrence: 'None' | 'Daily' | 'Weekly' | 'Monthly';
  completed: boolean;
  isArchived: boolean;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  workspaceId: string;
  title: string;
  entryDate: string;
  entryTime: string;
  category: string;
  projectId: string;
  projectName: string;
  relatedTaskId: string;
  relatedTaskTitle: string;
  description: string;
  activitiesPerformed: string;
  achievements: string;
  challenges: string;
  decisionsMade: string;
  lessonsLearned: string;
  nextSteps: string;
  timeSpentHours: number;
  tags: string[];
  visibility: 'Private' | 'Shared';
  isArchived: boolean;
  memberUids: string[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisRecord {
  id: string;
  workspaceId: string;
  title: string;
  category: AnalysisCategory;
  analysisDate: string;
  projectId: string;
  projectName: string;
  objective: string;
  problemStatement: string;
  datasetDescription: string;
  methodology: string;
  observations: string;
  keyFindings: string;
  risksAndAssumptions: string;
  conclusion: string;
  recommendations: string;
  expectedOutcome: string;
  actualOutcome: string;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  status: 'Draft' | 'In Review' | 'Completed' | 'Archived';
  supportingLinks: string;
  relatedTaskId: string;
  stockSymbol: string;
  exchange: string;
  timeframe: string;
  marketTrend: string;
  technicalObservations: string;
  supportAndResistance: string;
  indicatorsUsed: string;
  tradingThesis: string;
  entryExitAssumptions: string;
  stopLossAssumption: string;
  targetAssumption: string;
  riskRewardRatio: string;
  actualResult: string;
  lessonsLearned: string;
  isArchived: boolean;
  memberUids: string[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkSession {
  id: string;
  workspaceId: string;
  title: string;
  projectId: string;
  taskId: string;
  durationHours: number;
  sessionDate: string;
  notes: string;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentItem {
  id: string;
  workspaceId: string;
  targetType: 'task' | 'project' | 'analysis';
  targetId: string;
  content: string;
  authorName: string;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  workspaceId: string;
  recipientId: string;
  type: 'deadline' | 'overdue' | 'assignment' | 'status' | 'project' | 'journal' | 'invitation';
  title: string;
  message: string;
  linkTab: string;
  targetId: string;
  read: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  dueDate: string;
  completed: boolean;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  actionType: string;
  entityType: 'task' | 'project' | 'journal' | 'analysis' | 'planner' | 'milestone' | 'session' | 'team' | 'attachment';
  entityId: string;
  entityTitle: string;
  projectId: string;
  category: string;
  summary: string;
  actorName: string;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentItem {
  id: string;
  workspaceId: string;
  entityType: 'journal' | 'project' | 'analysis' | 'report' | 'profile';
  entityId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  r2Key: string;
  visibility: 'Private' | 'Shared';
  storageDriver: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}
