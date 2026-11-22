import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import {
  apiRequest,
  setInMemorySessionToken,
  getInMemorySessionToken,
} from '../services/api';
import {
  NavTab,
  UserProfile,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  Invitation,
  Project,
  Task,
  PlannerActivity,
  JournalEntry,
  AnalysisRecord,
  WorkSession,
  CommentItem,
  NotificationItem,
  Milestone,
  AuditLog,
  AttachmentItem,
  WorkerCapabilities,
} from '../types';
import {
  DEMO_USER,
  DEMO_WORKSPACES,
  DEMO_MEMBERS,
  DEMO_INVITATIONS,
  DEMO_PROJECTS,
  DEMO_TASKS,
  DEMO_PLANNER,
  DEMO_JOURNALS,
  DEMO_ANALYSES,
  DEMO_SESSIONS,
  DEMO_COMMENTS,
  DEMO_NOTIFICATIONS,
  DEMO_MILESTONES,
  DEMO_AUDIT_LOGS,
} from '../lib/demoData';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface AppContextType {
  // Auth & Mode
  userProfile: UserProfile | null;
  authLoading: boolean;
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  capabilities: WorkerCapabilities;
  registerWithEmail: (email: string, password: string, displayName: string, turnstileToken: string) => Promise<void>;
  loginWithEmail: (email: string, password: string, turnstileToken: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshWorkspaceData: () => Promise<void>;

  // Navigation & Theme
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  quickCreateModal: 'task' | 'planner' | 'project' | 'journal' | 'analysis' | null;
  setQuickCreateModal: (m: 'task' | 'planner' | 'project' | 'journal' | 'analysis' | null) => void;

  // Workspaces
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspaceId: (id: string) => void;
  currentUserRole: WorkspaceRole;

  // Data Collections (active workspace)
  members: WorkspaceMember[];
  invitations: Invitation[];
  projects: Project[];
  tasks: Task[];
  plannerActivities: PlannerActivity[];
  journalEntries: JournalEntry[];
  analysisRecords: AnalysisRecord[];
  workSessions: WorkSession[];
  comments: CommentItem[];
  notifications: NotificationItem[];
  milestones: Milestone[];
  auditLogs: AuditLog[];
  attachments: AttachmentItem[];

  // Toast feedback
  toasts: ToastMessage[];
  addToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // CRUD Operations (Cloudflare Workers + D1 + R2)
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  createWorkspace: (name: string, description: string, type: 'personal' | 'team') => Promise<string>;
  updateWorkspaceSettings: (workspaceId: string, name: string, description: string) => Promise<void>;
  acceptInvitationByToken: (tokenInput: string) => Promise<void>;
  createInvitation: (invitedLabel: string, assignedRole: 'Admin' | 'Manager' | 'Member') => Promise<Invitation | null>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  updateMemberRole: (memberId: string, role: WorkspaceRole) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;

  createProject: (data: Omit<Project, 'id' | 'workspaceId' | 'ownerId' | 'ownerName' | 'progressPercentage' | 'memberUids' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;

  createTask: (data: Omit<Task, 'id' | 'workspaceId' | 'createdBy' | 'createdByName' | 'memberUids' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;

  createPlannerActivity: (data: Omit<PlannerActivity, 'id' | 'workspaceId' | 'memberUids' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updatePlannerActivity: (activityId: string, updates: Partial<PlannerActivity>) => Promise<void>;
  deletePlannerActivity: (activityId: string) => Promise<void>;

  createJournalEntry: (data: Omit<JournalEntry, 'id' | 'workspaceId' | 'memberUids' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateJournalEntry: (entryId: string, updates: Partial<JournalEntry>, silent?: boolean) => Promise<void>;
  deleteJournalEntry: (entryId: string) => Promise<void>;

  createAnalysisRecord: (data: Omit<AnalysisRecord, 'id' | 'workspaceId' | 'memberUids' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateAnalysisRecord: (analysisId: string, updates: Partial<AnalysisRecord>) => Promise<void>;
  deleteAnalysisRecord: (analysisId: string) => Promise<void>;

  createWorkSession: (data: Omit<WorkSession, 'id' | 'workspaceId' | 'memberUids' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  createComment: (targetType: 'task' | 'project' | 'analysis', targetId: string, content: string) => Promise<void>;
  createMilestone: (projectId: string, title: string, dueDate: string) => Promise<void>;
  toggleMilestone: (milestoneId: string, completed: boolean) => Promise<void>;
  deleteMilestone: (milestoneId: string) => Promise<void>;

  uploadAttachment: (file: File, entityType: AttachmentItem['entityType'], entityId: string, visibility: 'Private' | 'Shared') => Promise<void>;
  deleteAttachment: (attachmentId: string) => Promise<void>;
  getAttachmentDownloadUrl: (attachmentId: string) => string;

  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [capabilities, setCapabilities] = useState<WorkerCapabilities>({
    betterAuthConfigured: false,
    turnstileConfigured: false,
    turnstileSiteKey: '',
    googleOAuthConfigured: false,
    emailResetConfigured: false,
    d1Configured: false,
    r2Configured: false,
  });

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [quickCreateModal, setQuickCreateModal] = useState<'task' | 'planner' | 'project' | 'journal' | 'analysis' | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Real D1 State
  const [realProfile, setRealProfile] = useState<UserProfile | null>(null);
  const [realWorkspaces, setRealWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>('');
  const [realRole, setRealRole] = useState<WorkspaceRole>('Owner');
  const [realMembers, setRealMembers] = useState<WorkspaceMember[]>([]);
  const [realInvitations, setRealInvitations] = useState<Invitation[]>([]);
  const [realProjects, setRealProjects] = useState<Project[]>([]);
  const [realTasks, setRealTasks] = useState<Task[]>([]);
  const [realPlanner, setRealPlanner] = useState<PlannerActivity[]>([]);
  const [realJournals, setRealJournals] = useState<JournalEntry[]>([]);
  const [realAnalyses, setRealAnalyses] = useState<AnalysisRecord[]>([]);
  const [realSessions, setRealSessions] = useState<WorkSession[]>([]);
  const [realComments, setRealComments] = useState<CommentItem[]>([]);
  const [realNotifications, setRealNotifications] = useState<NotificationItem[]>([]);
  const [realMilestones, setRealMilestones] = useState<Milestone[]>([]);
  const [realAuditLogs, setRealAuditLogs] = useState<AuditLog[]>([]);
  const [realAttachments, setRealAttachments] = useState<AttachmentItem[]>([]);

  // Isolated Demo Sandbox State
  const [demoProfile, setDemoProfile] = useState<UserProfile>(DEMO_USER);
  const [demoWorkspaces, setDemoWorkspaces] = useState<Workspace[]>(DEMO_WORKSPACES);
  const [demoWorkspaceId, setDemoWorkspaceId] = useState<string>('demo_ws_personal');
  const [demoMembers, setDemoMembers] = useState<WorkspaceMember[]>(DEMO_MEMBERS);
  const [demoInvitations, setDemoInvitations] = useState<Invitation[]>(DEMO_INVITATIONS);
  const [demoProjects, setDemoProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [demoTasks, setDemoTasks] = useState<Task[]>(DEMO_TASKS);
  const [demoPlanner, setDemoPlanner] = useState<PlannerActivity[]>(DEMO_PLANNER);
  const [demoJournals, setDemoJournals] = useState<JournalEntry[]>(DEMO_JOURNALS);
  const [demoAnalyses, setDemoAnalyses] = useState<AnalysisRecord[]>(DEMO_ANALYSES);
  const [demoSessions, setDemoSessions] = useState<WorkSession[]>(DEMO_SESSIONS);
  const [demoComments, setDemoComments] = useState<CommentItem[]>(DEMO_COMMENTS);
  const [demoNotifications, setDemoNotifications] = useState<NotificationItem[]>(DEMO_NOTIFICATIONS);
  const [demoMilestones, setDemoMilestones] = useState<Milestone[]>(DEMO_MILESTONES);
  const [demoAuditLogs, setDemoAuditLogs] = useState<AuditLog[]>(DEMO_AUDIT_LOGS);
  const [demoAttachments, setDemoAttachments] = useState<AttachmentItem[]>([]);

  const addToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const fetchWorkspacesList = useCallback(async () => {
    const res = await apiRequest<{ workspaces: Workspace[] }>('/api/workspaces');
    setRealWorkspaces(res.workspaces || []);
    return res.workspaces || [];
  }, []);

  const loadWorkspaceBootstrap = useCallback(async (wsId: string) => {
    if (!wsId) return;
    const [boot, memRes, attRes] = await Promise.all([
      apiRequest<{
        role: WorkspaceRole;
        projects: Project[];
        tasks: Task[];
        plannerActivities: PlannerActivity[];
        journalEntries: JournalEntry[];
        analysisRecords: AnalysisRecord[];
        workSessions: WorkSession[];
        comments: CommentItem[];
        milestones: Milestone[];
        notifications: NotificationItem[];
        auditLogs: AuditLog[];
      }>(`/api/records/bootstrap?workspaceId=${encodeURIComponent(wsId)}&limit=150&offset=0`),
      apiRequest<{ members: WorkspaceMember[]; invitations: Invitation[] }>(
        `/api/workspaces/${encodeURIComponent(wsId)}/members`
      ),
      apiRequest<{ attachments: AttachmentItem[] }>(
        `/api/attachments?workspaceId=${encodeURIComponent(wsId)}`
      ),
    ]);

    setRealRole(boot.role || 'Member');
    setRealProjects(boot.projects || []);
    setRealTasks(boot.tasks || []);
    setRealPlanner(boot.plannerActivities || []);
    setRealJournals(boot.journalEntries || []);
    setRealAnalyses(boot.analysisRecords || []);
    setRealSessions(boot.workSessions || []);
    setRealComments(boot.comments || []);
    setRealMilestones(boot.milestones || []);
    setRealNotifications(boot.notifications || []);
    setRealAuditLogs(boot.auditLogs || []);
    setRealMembers(memRes.members || []);
    setRealInvitations(memRes.invitations || []);
    setRealAttachments(attRes.attachments || []);
  }, []);

  const refreshWorkspaceData = useCallback(async () => {
    if (isDemoMode || !realProfile) return;
    const list = await fetchWorkspacesList();
    const targetWsId = currentWorkspaceId || list[0]?.id || '';
    if (targetWsId) {
      if (!currentWorkspaceId) setCurrentWorkspaceId(targetWsId);
      await loadWorkspaceBootstrap(targetWsId);
    }
  }, [isDemoMode, realProfile, currentWorkspaceId, fetchWorkspacesList, loadWorkspaceBootstrap]);

  // Check initial D1 session on load
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<{
          authenticated: boolean;
          user: UserProfile | null;
          capabilities: WorkerCapabilities;
        }>('/api/auth/session');

        if (res.capabilities) {
          setCapabilities(res.capabilities);
        }

        if (res.authenticated && res.user) {
          setIsDemoMode(false);
          setRealProfile(res.user);
          setTheme(res.user.theme || 'light');
          const list = await fetchWorkspacesList();
          const initialWs =
            list.find((w) => w.id === res.user?.defaultWorkspaceId) || list[0];
          if (initialWs) {
            setCurrentWorkspaceId(initialWs.id);
            await loadWorkspaceBootstrap(initialWs.id);
          }
        } else if (!res.capabilities?.betterAuthConfigured) {
          // Automatically run in clearly labelled Development & Demo Preview Mode when external credentials are not configured yet
          setIsDemoMode(true);
        }
      } catch (err) {
        console.error('Session check error:', err);
        setIsDemoMode(true);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [fetchWorkspacesList, loadWorkspaceBootstrap]);

  // Reload workspace records when currentWorkspaceId changes
  useEffect(() => {
    if (!isDemoMode && realProfile && currentWorkspaceId) {
      loadWorkspaceBootstrap(currentWorkspaceId).catch((err) =>
        console.error('Failed loading workspace:', err)
      );
    }
  }, [isDemoMode, realProfile, currentWorkspaceId, loadWorkspaceBootstrap]);

  // Auth methods
  const registerWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    turnstileToken: string
  ) => {
    const res = await apiRequest<{
      user: UserProfile;
      sessionToken: string;
      capabilities: WorkerCapabilities;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, turnstileToken }),
    });

    setInMemorySessionToken(res.sessionToken);
    if (res.capabilities) setCapabilities(res.capabilities);
    setRealProfile(res.user);
    setIsDemoMode(false);
    const list = await fetchWorkspacesList();
    if (list[0]) {
      setCurrentWorkspaceId(list[0].id);
      await loadWorkspaceBootstrap(list[0].id);
    }
    addToast(`Welcome to WhimsyMaya, ${res.user.displayName}!`, 'success');
  };

  const loginWithEmail = async (
    email: string,
    password: string,
    turnstileToken: string
  ) => {
    const res = await apiRequest<{
      user: UserProfile;
      sessionToken: string;
      capabilities: WorkerCapabilities;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, turnstileToken }),
    });

    setInMemorySessionToken(res.sessionToken);
    if (res.capabilities) setCapabilities(res.capabilities);
    setRealProfile(res.user);
    setTheme(res.user.theme || 'light');
    setIsDemoMode(false);
    const list = await fetchWorkspacesList();
    const initialWs =
      list.find((w) => w.id === res.user.defaultWorkspaceId) || list[0];
    if (initialWs) {
      setCurrentWorkspaceId(initialWs.id);
      await loadWorkspaceBootstrap(initialWs.id);
    }
    addToast(`Signed in as ${res.user.displayName}.`, 'success');
  };

  const requestPasswordReset = async (email: string) => {
    const res = await apiRequest<{ message: string }>('/api/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    addToast(res.message, 'info');
  };

  const logout = async () => {
    if (isDemoMode) {
      setIsDemoMode(false);
      addToast('Exited Demo Sandbox Mode.', 'info');
      return;
    }
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setInMemorySessionToken(null);
    setRealProfile(null);
    setRealWorkspaces([]);
    setCurrentWorkspaceId('');
    addToast('Signed out of WhimsyMaya.', 'info');
  };

  // Active mode selectors
  const userProfile = isDemoMode ? demoProfile : realProfile;
  const workspaces = isDemoMode ? demoWorkspaces : realWorkspaces;
  const activeWsId = isDemoMode ? demoWorkspaceId : currentWorkspaceId;
  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWsId) || workspaces[0] || null,
    [workspaces, activeWsId]
  );

  const handleSetWorkspaceId = (id: string) => {
    if (isDemoMode) {
      setDemoWorkspaceId(id);
    } else {
      setCurrentWorkspaceId(id);
    }
    setSelectedProjectId(null);
  };

  const members = useMemo(
    () =>
      isDemoMode
        ? demoMembers.filter((m) => m.workspaceId === activeWsId)
        : realMembers,
    [isDemoMode, demoMembers, realMembers, activeWsId]
  );

  const currentUserRole: WorkspaceRole = useMemo(() => {
    if (!isDemoMode) return realRole;
    if (!currentWorkspace || !userProfile) return 'Member';
    if (currentWorkspace.ownerId === userProfile.id) return 'Owner';
    const mem = members.find((m) => m.userId === userProfile.id);
    return mem?.role || 'Member';
  }, [isDemoMode, realRole, currentWorkspace, userProfile, members]);

  const invitations = useMemo(
    () =>
      isDemoMode
        ? demoInvitations.filter((i) => i.workspaceId === activeWsId)
        : realInvitations,
    [isDemoMode, demoInvitations, realInvitations, activeWsId]
  );

  const projects = useMemo(
    () =>
      isDemoMode
        ? demoProjects.filter((p) => p.workspaceId === activeWsId)
        : realProjects,
    [isDemoMode, demoProjects, realProjects, activeWsId]
  );

  const tasks = useMemo(
    () =>
      isDemoMode
        ? demoTasks.filter((t) => t.workspaceId === activeWsId)
        : realTasks,
    [isDemoMode, demoTasks, realTasks, activeWsId]
  );

  const plannerActivities = useMemo(
    () =>
      isDemoMode
        ? demoPlanner.filter((a) => a.workspaceId === activeWsId)
        : realPlanner,
    [isDemoMode, demoPlanner, realPlanner, activeWsId]
  );

  const journalEntries = useMemo(
    () =>
      isDemoMode
        ? demoJournals.filter(
            (j) =>
              j.workspaceId === activeWsId &&
              (j.createdBy === demoProfile.id || j.visibility === 'Shared')
          )
        : realJournals,
    [isDemoMode, demoJournals, realJournals, activeWsId, demoProfile.id]
  );

  const analysisRecords = useMemo(
    () =>
      isDemoMode
        ? demoAnalyses.filter((a) => a.workspaceId === activeWsId)
        : realAnalyses,
    [isDemoMode, demoAnalyses, realAnalyses, activeWsId]
  );

  const workSessions = useMemo(
    () =>
      isDemoMode
        ? demoSessions.filter((s) => s.workspaceId === activeWsId)
        : realSessions,
    [isDemoMode, demoSessions, realSessions, activeWsId]
  );

  const comments = useMemo(
    () =>
      isDemoMode
        ? demoComments.filter((c) => c.workspaceId === activeWsId)
        : realComments,
    [isDemoMode, demoComments, realComments, activeWsId]
  );

  const notifications = useMemo(
    () => (isDemoMode ? demoNotifications : realNotifications),
    [isDemoMode, demoNotifications, realNotifications]
  );

  const milestones = useMemo(
    () =>
      isDemoMode
        ? demoMilestones.filter((m) => m.workspaceId === activeWsId)
        : realMilestones,
    [isDemoMode, demoMilestones, realMilestones, activeWsId]
  );

  const auditLogs = useMemo(
    () =>
      isDemoMode
        ? demoAuditLogs.filter((l) => l.workspaceId === activeWsId)
        : realAuditLogs,
    [isDemoMode, demoAuditLogs, realAuditLogs, activeWsId]
  );

  const attachments = useMemo(
    () =>
      isDemoMode
        ? demoAttachments.filter((a) => a.workspaceId === activeWsId)
        : realAttachments,
    [isDemoMode, demoAttachments, realAttachments, activeWsId]
  );

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (!isDemoMode && realProfile) {
      updateUserProfile({ theme: next }).catch(() => {});
    } else if (isDemoMode) {
      setDemoProfile((p) => ({ ...p, theme: next }));
    }
  };

  // CRUD Operations
  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    if (isDemoMode) {
      setDemoProfile((prev) => ({ ...prev, ...updates, updatedAt: new Date().toISOString() }));
      addToast('Preferences updated in Demo Sandbox.');
      return;
    }

    const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setRealProfile(res.user);
    addToast('Profile settings saved to D1.');
  };

  const createWorkspace = async (
    name: string,
    description: string,
    type: 'personal' | 'team'
  ): Promise<string> => {
    if (!userProfile) return '';
    if (isDemoMode) {
      const wsId = `demo_ws_${Date.now()}`;
      const now = new Date().toISOString();
      const newWs: Workspace = {
        id: wsId,
        name,
        description,
        type,
        ownerId: userProfile.id,
        inviteCode: `WM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        memberUids: [userProfile.id],
        createdBy: userProfile.id,
        createdAt: now,
        updatedAt: now,
      };
      setDemoWorkspaces((prev) => [...prev, newWs]);
      setDemoWorkspaceId(wsId);
      addToast(`Created ${type} workspace "${name}".`);
      return wsId;
    }

    const res = await apiRequest<{ workspace: Workspace }>('/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name, description, type }),
    });
    await fetchWorkspacesList();
    setCurrentWorkspaceId(res.workspace.id);
    await loadWorkspaceBootstrap(res.workspace.id);
    addToast(`Created ${type} workspace "${name}".`);
    return res.workspace.id;
  };

  const updateWorkspaceSettings = async (workspaceId: string, name: string, description: string) => {
    if (isDemoMode) {
      setDemoWorkspaces((prev) =>
        prev.map((w) => (w.id === workspaceId ? { ...w, name, description } : w))
      );
      addToast('Workspace settings saved.');
      return;
    }
    await apiRequest(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    });
    await fetchWorkspacesList();
    addToast('Workspace settings saved to D1.');
  };

  const createInvitation = async (
    invitedLabel: string,
    assignedRole: 'Admin' | 'Manager' | 'Member'
  ): Promise<Invitation | null> => {
    if (!currentWorkspace || !userProfile) return null;
    if (isDemoMode) {
      const inv: Invitation = {
        id: `demo_inv_${Date.now()}`,
        workspaceId: currentWorkspace.id,
        workspaceName: currentWorkspace.name,
        inviteCode: `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        invitedLabel,
        assignedRole,
        status: 'Pending',
        expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
        memberUids: currentWorkspace.memberUids,
        createdBy: userProfile.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDemoInvitations((prev) => [inv, ...prev]);
      addToast('Expiring invitation code generated.');
      return inv;
    }

    const res = await apiRequest<{ invitation: Invitation }>(
      `/api/workspaces/${encodeURIComponent(currentWorkspace.id)}/invitations`,
      {
        method: 'POST',
        body: JSON.stringify({ invitedLabel, assignedRole, expiresInDays: 7 }),
      }
    );
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Expiring invitation code generated in D1.');
    return res.invitation;
  };

  const revokeInvitation = async (invitationId: string) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: 'Revoked' } : i))
      );
      addToast('Invitation revoked.', 'info');
      return;
    }
    await apiRequest(
      `/api/workspaces/${encodeURIComponent(currentWorkspace.id)}/invitations/${encodeURIComponent(invitationId)}`,
      { method: 'DELETE' }
    );
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Invitation revoked.', 'info');
  };

  const acceptInvitationByToken = async (tokenInput: string) => {
    if (isDemoMode) {
      addToast('Invitation verified in Demo Sandbox Mode.');
      return;
    }
    const res = await apiRequest<{ workspaceId: string }>('/api/workspaces/join', {
      method: 'POST',
      body: JSON.stringify({ token: tokenInput }),
    });
    await fetchWorkspacesList();
    if (res.workspaceId) {
      setCurrentWorkspaceId(res.workspaceId);
      await loadWorkspaceBootstrap(res.workspaceId);
    }
    addToast('Joined team workspace!');
  };

  const updateMemberRole = async (memberId: string, role: WorkspaceRole) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
      addToast(`Role updated to ${role}.`);
      return;
    }
    await apiRequest(
      `/api/workspaces/${encodeURIComponent(currentWorkspace.id)}/members/${encodeURIComponent(memberId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }
    );
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast(`Member role updated to ${role}.`);
  };

  const removeMember = async (memberId: string) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoMembers((prev) => prev.filter((m) => m.id !== memberId));
      addToast('Member removed.', 'info');
      return;
    }
    await apiRequest(
      `/api/workspaces/${encodeURIComponent(currentWorkspace.id)}/members/${encodeURIComponent(memberId)}`,
      { method: 'DELETE' }
    );
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Member removed from workspace.', 'info');
  };

  // Projects
  const createProject = async (
    data: Omit<Project, 'id' | 'workspaceId' | 'ownerId' | 'ownerName' | 'progressPercentage' | 'memberUids' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    if (!currentWorkspace || !userProfile) return '';
    if (isDemoMode) {
      const id = `demo_proj_${Date.now()}`;
      const now = new Date().toISOString();
      setDemoProjects((prev) => [
        {
          id,
          workspaceId: currentWorkspace.id,
          ...data,
          ownerId: userProfile.id,
          ownerName: userProfile.displayName,
          progressPercentage: 0,
          memberUids: currentWorkspace.memberUids,
          createdBy: userProfile.id,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      addToast(`Project "${data.name}" created.`);
      return id;
    }

    const res = await apiRequest<{ id: string }>('/api/records/projects', {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast(`Project "${data.name}" saved to D1.`);
    return res.id;
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
      );
      addToast('Project updated.');
      return;
    }
    await apiRequest(`/api/records/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Project updated in D1.');
  };

  const deleteProject = async (projectId: string) => {
    await updateProject(projectId, { status: 'Archived' });
  };

  // Tasks
  const createTask = async (
    data: Omit<Task, 'id' | 'workspaceId' | 'createdBy' | 'createdByName' | 'memberUids' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    if (!currentWorkspace || !userProfile) return '';
    if (isDemoMode) {
      const id = `demo_task_${Date.now()}`;
      const now = new Date().toISOString();
      setDemoTasks((prev) => [
        {
          id,
          workspaceId: currentWorkspace.id,
          ...data,
          createdBy: userProfile.id,
          createdByName: userProfile.displayName,
          memberUids: currentWorkspace.memberUids,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      addToast(`Task "${data.title}" created.`);
      return id;
    }

    const res = await apiRequest<{ id: string }>('/api/records/tasks', {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast(`Task "${data.title}" saved to D1.`);
    return res.id;
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
      );
      addToast('Task updated.');
      return;
    }
    await apiRequest(`/api/records/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Task updated in D1.');
  };

  const deleteTask = async (taskId: string) => {
    await updateTask(taskId, { isArchived: true });
  };

  // Planner
  const createPlannerActivity = async (
    data: Omit<PlannerActivity, 'id' | 'workspaceId' | 'memberUids' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    if (!currentWorkspace || !userProfile) return '';
    if (isDemoMode) {
      const id = `demo_plan_${Date.now()}`;
      const now = new Date().toISOString();
      setDemoPlanner((prev) => [
        {
          id,
          workspaceId: currentWorkspace.id,
          ...data,
          memberUids: currentWorkspace.memberUids,
          createdBy: userProfile.id,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      addToast(`Scheduled "${data.title}".`);
      return id;
    }

    const res = await apiRequest<{ id: string }>('/api/records/planner', {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast(`Scheduled "${data.title}" in D1.`);
    return res.id;
  };

  const updatePlannerActivity = async (activityId: string, updates: Partial<PlannerActivity>) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoPlanner((prev) =>
        prev.map((a) => (a.id === activityId ? { ...a, ...updates } : a))
      );
      addToast('Planner activity updated.');
      return;
    }
    await apiRequest(`/api/records/planner/${encodeURIComponent(activityId)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Planner activity updated.');
  };

  const deletePlannerActivity = async (activityId: string) => {
    await updatePlannerActivity(activityId, { isArchived: true });
  };

  // Work Journal
  const createJournalEntry = async (
    data: Omit<JournalEntry, 'id' | 'workspaceId' | 'memberUids' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    if (!currentWorkspace || !userProfile) return '';
    if (isDemoMode) {
      const id = `demo_jrnl_${Date.now()}`;
      const now = new Date().toISOString();
      setDemoJournals((prev) => [
        {
          id,
          workspaceId: currentWorkspace.id,
          ...data,
          memberUids: currentWorkspace.memberUids,
          createdBy: userProfile.id,
          createdByName: userProfile.displayName,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      addToast(`Journal entry "${data.title}" saved.`);
      return id;
    }

    const res = await apiRequest<{ id: string }>('/api/records/journal', {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast(`Journal entry "${data.title}" saved to D1.`);
    return res.id;
  };

  const updateJournalEntry = async (
    entryId: string,
    updates: Partial<JournalEntry>,
    silent = false
  ) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoJournals((prev) =>
        prev.map((j) => (j.id === entryId ? { ...j, ...updates } : j))
      );
      if (!silent) addToast('Journal entry updated.');
      return;
    }
    await apiRequest(`/api/records/journal/${encodeURIComponent(entryId)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, workspaceId: currentWorkspace.id, silent }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    if (!silent) addToast('Journal entry saved to D1.');
  };

  const deleteJournalEntry = async (entryId: string) => {
    await updateJournalEntry(entryId, { isArchived: true });
  };

  // Analyst Desk
  const createAnalysisRecord = async (
    data: Omit<AnalysisRecord, 'id' | 'workspaceId' | 'memberUids' | 'createdBy' | 'createdByName' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    if (!currentWorkspace || !userProfile) return '';
    if (isDemoMode) {
      const id = `demo_anl_${Date.now()}`;
      const now = new Date().toISOString();
      setDemoAnalyses((prev) => [
        {
          id,
          workspaceId: currentWorkspace.id,
          ...data,
          memberUids: currentWorkspace.memberUids,
          createdBy: userProfile.id,
          createdByName: userProfile.displayName,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      addToast(`Analysis "${data.title}" created.`);
      return id;
    }

    const res = await apiRequest<{ id: string }>('/api/records/analysis', {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast(`Analysis "${data.title}" saved to D1.`);
    return res.id;
  };

  const updateAnalysisRecord = async (analysisId: string, updates: Partial<AnalysisRecord>) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoAnalyses((prev) =>
        prev.map((a) => (a.id === analysisId ? { ...a, ...updates } : a))
      );
      addToast('Analysis record updated.');
      return;
    }
    await apiRequest(`/api/records/analysis/${encodeURIComponent(analysisId)}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Analysis record updated in D1.');
  };

  const deleteAnalysisRecord = async (analysisId: string) => {
    await updateAnalysisRecord(analysisId, { isArchived: true, status: 'Archived' });
  };

  // Sessions, Comments, Milestones
  const createWorkSession = async (
    data: Omit<WorkSession, 'id' | 'workspaceId' | 'memberUids' | 'createdBy' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!currentWorkspace || !userProfile) return;
    if (isDemoMode) {
      const now = new Date().toISOString();
      setDemoSessions((prev) => [
        {
          id: `demo_sess_${Date.now()}`,
          workspaceId: currentWorkspace.id,
          ...data,
          memberUids: currentWorkspace.memberUids,
          createdBy: userProfile.id,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      addToast('Work session logged.');
      return;
    }
    await apiRequest('/api/records/sessions', {
      method: 'POST',
      body: JSON.stringify({ ...data, workspaceId: currentWorkspace.id }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Work session logged to D1.');
  };

  const createComment = async (
    targetType: 'task' | 'project' | 'analysis',
    targetId: string,
    content: string
  ) => {
    if (!currentWorkspace || !userProfile) return;
    if (isDemoMode) {
      const now = new Date().toISOString();
      setDemoComments((prev) => [
        {
          id: `demo_comm_${Date.now()}`,
          workspaceId: currentWorkspace.id,
          targetType,
          targetId,
          content,
          authorName: userProfile.displayName,
          memberUids: currentWorkspace.memberUids,
          createdBy: userProfile.id,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      addToast('Comment posted.');
      return;
    }
    await apiRequest('/api/records/comments', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: currentWorkspace.id, targetType, targetId, content }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Comment saved to D1.');
  };

  const createMilestone = async (projectId: string, title: string, dueDate: string) => {
    if (!currentWorkspace || !userProfile) return;
    if (isDemoMode) {
      const now = new Date().toISOString();
      setDemoMilestones((prev) => [
        ...prev,
        {
          id: `demo_ms_${Date.now()}`,
          workspaceId: currentWorkspace.id,
          projectId,
          title,
          dueDate,
          completed: false,
          memberUids: currentWorkspace.memberUids,
          createdBy: userProfile.id,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      addToast('Milestone added.');
      return;
    }
    await apiRequest('/api/records/milestones', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: currentWorkspace.id, projectId, title, dueDate }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Milestone added in D1.');
  };

  const toggleMilestone = async (milestoneId: string, completed: boolean) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, completed } : m))
      );
      return;
    }
    await apiRequest(`/api/records/milestones/${encodeURIComponent(milestoneId)}`, {
      method: 'PUT',
      body: JSON.stringify({ workspaceId: currentWorkspace.id, completed }),
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
  };

  const deleteMilestone = async (milestoneId: string) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoMilestones((prev) => prev.filter((m) => m.id !== milestoneId));
      return;
    }
    await apiRequest(
      `/api/records/milestones/${encodeURIComponent(milestoneId)}?workspaceId=${encodeURIComponent(currentWorkspace.id)}`,
      { method: 'DELETE' }
    );
    await loadWorkspaceBootstrap(currentWorkspace.id);
  };

  // Cloudflare R2 File Attachments
  const uploadAttachment = async (
    file: File,
    entityType: AttachmentItem['entityType'],
    entityId: string,
    visibility: 'Private' | 'Shared'
  ) => {
    if (!currentWorkspace || !userProfile) return;
    if (isDemoMode) {
      const now = new Date().toISOString();
      setDemoAttachments((prev) => [
        {
          id: `demo_att_${Date.now()}`,
          workspaceId: currentWorkspace.id,
          entityType,
          entityId,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          r2Key: `demo/${file.name}`,
          visibility,
          storageDriver: 'r2-demo',
          createdBy: userProfile.id,
          createdByName: userProfile.displayName,
          createdAt: now,
        },
        ...prev,
      ]);
      addToast(`Uploaded "${file.name}" in Demo Sandbox.`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('workspaceId', currentWorkspace.id);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('visibility', visibility);

    await apiRequest('/api/attachments/upload', {
      method: 'POST',
      body: formData,
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast(`Uploaded "${file.name}" to Cloudflare R2.`);
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!currentWorkspace) return;
    if (isDemoMode) {
      setDemoAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      addToast('Attachment deleted.', 'info');
      return;
    }
    await apiRequest(`/api/attachments/${encodeURIComponent(attachmentId)}`, {
      method: 'DELETE',
    });
    await loadWorkspaceBootstrap(currentWorkspace.id);
    addToast('Attachment deleted from R2 & D1.', 'info');
  };

  const getAttachmentDownloadUrl = (attachmentId: string): string => {
    const token = getInMemorySessionToken();
    return `/api/attachments/${encodeURIComponent(attachmentId)}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  };

  // Notifications
  const markNotificationRead = async (notificationId: string) => {
    if (isDemoMode) {
      setDemoNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      return;
    }
    await apiRequest(`/api/records/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'PUT',
    });
    setRealNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsRead = async () => {
    if (isDemoMode) {
      setDemoNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      addToast('All notifications marked read.');
      return;
    }
    await apiRequest('/api/records/notifications/read-all', { method: 'PUT' });
    setRealNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast('All notifications marked read.');
  };

  return (
    <AppContext.Provider
      value={{
        userProfile,
        authLoading,
        isDemoMode,
        setIsDemoMode,
        capabilities,
        registerWithEmail,
        loginWithEmail,
        requestPasswordReset,
        logout,
        refreshWorkspaceData,
        activeTab,
        setActiveTab,
        selectedProjectId,
        setSelectedProjectId,
        theme,
        toggleTheme,
        globalSearchQuery,
        setGlobalSearchQuery,
        quickCreateModal,
        setQuickCreateModal,
        workspaces,
        currentWorkspace,
        setCurrentWorkspaceId: handleSetWorkspaceId,
        currentUserRole,
        members,
        invitations,
        projects,
        tasks,
        plannerActivities,
        journalEntries,
        analysisRecords,
        workSessions,
        comments,
        notifications,
        milestones,
        auditLogs,
        attachments,
        toasts,
        addToast,
        removeToast,
        updateUserProfile,
        createWorkspace,
        updateWorkspaceSettings,
        acceptInvitationByToken,
        createInvitation,
        revokeInvitation,
        updateMemberRole,
        removeMember,
        createProject,
        updateProject,
        deleteProject,
        createTask,
        updateTask,
        deleteTask,
        createPlannerActivity,
        updatePlannerActivity,
        deletePlannerActivity,
        createJournalEntry,
        updateJournalEntry,
        deleteJournalEntry,
        createAnalysisRecord,
        updateAnalysisRecord,
        deleteAnalysisRecord,
        createWorkSession,
        createComment,
        createMilestone,
        toggleMilestone,
        deleteMilestone,
        uploadAttachment,
        deleteAttachment,
        getAttachmentDownloadUrl,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
