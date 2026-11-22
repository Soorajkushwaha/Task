-- =============================================================================
-- WHIMSYMAYA — Cloudflare D1 (SQLite) Initial Schema Migration
-- Migration: 0001_initial_schema.sql
-- Covers Better Auth / D1 Auth tables + All 19 WhimsyMaya relational tables
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. USERS (Better Auth compatible user record + WhimsyMaya preferences)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  display_name TEXT NOT NULL,
  photo_url TEXT NOT NULL DEFAULT '',
  role_title TEXT NOT NULL DEFAULT 'Product & Analytics Professional',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  date_format TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  default_workspace_id TEXT NOT NULL DEFAULT '',
  notify_deadlines INTEGER NOT NULL DEFAULT 1,
  notify_assignments INTEGER NOT NULL DEFAULT 1,
  notify_journal INTEGER NOT NULL DEFAULT 1,
  notify_invites INTEGER NOT NULL DEFAULT 1,
  private_journal_default INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. SESSIONS (Better Auth / D1 HTTP-only cookie session store)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- 3. ACCOUNTS (Better Auth credential & OAuth provider accounts)
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  password_hash TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_id, account_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- 4. VERIFICATIONS (Better Auth email verification & password reset tokens)
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verifications_identifier ON verifications(identifier);

-- 5. WORKSPACES (Personal & Team workspaces)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('personal', 'team')),
  owner_id TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_invite_code ON workspaces(invite_code);

-- 6. WORKSPACE_MEMBERS (RBAC: Owner, Admin, Manager, Member)
CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  photo_url TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Admin', 'Manager', 'Member')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wm_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user ON workspace_members(user_id);

-- 7. INVITATIONS (Expiring workspace invitation links & codes)
CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  invited_label TEXT NOT NULL,
  assigned_role TEXT NOT NULL CHECK (assigned_role IN ('Admin', 'Manager', 'Member')),
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Revoked')),
  expires_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(invite_code);

-- 8. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  start_date TEXT NOT NULL DEFAULT '',
  target_deadline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed', 'Archived')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  notes TEXT NOT NULL DEFAULT '',
  progress_percentage REAL NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace_status ON projects(workspace_id, status);

-- 9. TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assigned_to TEXT NOT NULL,
  assigned_to_name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  start_date TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started', 'In Progress', 'Under Review', 'Completed', 'On Hold', 'Cancelled')),
  estimated_hours REAL NOT NULL DEFAULT 0,
  actual_hours REAL NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  completion_date TEXT NOT NULL DEFAULT '',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_archived ON tasks(workspace_id, is_archived, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(workspace_id, due_date);

-- 10. TASK_CHECKLISTS (Normalized checklist items for tasks)
CREATE TABLE IF NOT EXISTS task_checklists (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_checklists_task ON task_checklists(task_id);

-- 11. TASK_COMMENTS (Comments on tasks, projects, and analysis records)
CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'task' CHECK (target_type IN ('task', 'project', 'analysis')),
  target_id TEXT NOT NULL,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_comments_target ON task_comments(workspace_id, target_type, target_id);

-- 12. PLANNER_ACTIVITIES
CREATE TABLE IF NOT EXISTS planner_activities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '10:00',
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  category TEXT NOT NULL DEFAULT 'Work' CHECK (category IN ('Work', 'Meeting', 'Research', 'Learning', 'Personal', 'Administrative', 'Other')),
  reminder_minutes INTEGER NOT NULL DEFAULT 15,
  recurrence TEXT NOT NULL DEFAULT 'None' CHECK (recurrence IN ('None', 'Daily', 'Weekly', 'Monthly')),
  completed INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_planner_workspace_dates ON planner_activities(workspace_id, is_archived, start_date, end_date);

-- 13. JOURNAL_ENTRIES (Private by default; Shared with team when visibility = 'Shared')
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  related_task_id TEXT NOT NULL DEFAULT '',
  related_task_title TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  entry_time TEXT NOT NULL DEFAULT '17:00',
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL DEFAULT '',
  activities_performed TEXT NOT NULL DEFAULT '',
  achievements TEXT NOT NULL DEFAULT '',
  challenges TEXT NOT NULL DEFAULT '',
  decisions_made TEXT NOT NULL DEFAULT '',
  lessons_learned TEXT NOT NULL DEFAULT '',
  next_steps TEXT NOT NULL DEFAULT '',
  time_spent_hours REAL NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL DEFAULT 'Private' CHECK (visibility IN ('Private', 'Shared')),
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_journal_workspace_vis ON journal_entries(workspace_id, is_archived, visibility, created_by, entry_date);

-- 14. ANALYSIS_RECORDS (Analyst Desk + Stock Market Analysis fields)
CREATE TABLE IF NOT EXISTS analysis_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '',
  project_name TEXT NOT NULL DEFAULT '',
  related_task_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Business Analysis', 'Sales Analysis', 'Operations Analysis', 'Marketing Analysis', 'Financial Analysis', 'Stock Market Analysis', 'Technical Analysis', 'Research', 'Other')),
  analysis_date TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  problem_statement TEXT NOT NULL DEFAULT '',
  dataset_description TEXT NOT NULL DEFAULT '',
  methodology TEXT NOT NULL DEFAULT '',
  observations TEXT NOT NULL DEFAULT '',
  key_findings TEXT NOT NULL DEFAULT '',
  risks_and_assumptions TEXT NOT NULL DEFAULT '',
  conclusion TEXT NOT NULL DEFAULT '',
  recommendations TEXT NOT NULL DEFAULT '',
  expected_outcome TEXT NOT NULL DEFAULT '',
  actual_outcome TEXT NOT NULL DEFAULT '',
  confidence_level TEXT NOT NULL DEFAULT 'High' CHECK (confidence_level IN ('High', 'Medium', 'Low')),
  status TEXT NOT NULL DEFAULT 'Completed' CHECK (status IN ('Draft', 'In Review', 'Completed', 'Archived')),
  supporting_links TEXT NOT NULL DEFAULT '',
  stock_symbol TEXT NOT NULL DEFAULT '',
  exchange TEXT NOT NULL DEFAULT '',
  timeframe TEXT NOT NULL DEFAULT '',
  market_trend TEXT NOT NULL DEFAULT '',
  technical_observations TEXT NOT NULL DEFAULT '',
  support_and_resistance TEXT NOT NULL DEFAULT '',
  indicators_used TEXT NOT NULL DEFAULT '',
  trading_thesis TEXT NOT NULL DEFAULT '',
  entry_exit_assumptions TEXT NOT NULL DEFAULT '',
  stop_loss_assumption TEXT NOT NULL DEFAULT '',
  target_assumption TEXT NOT NULL DEFAULT '',
  risk_reward_ratio TEXT NOT NULL DEFAULT '',
  actual_result TEXT NOT NULL DEFAULT '',
  lessons_learned TEXT NOT NULL DEFAULT '',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_analysis_workspace_cat ON analysis_records(workspace_id, is_archived, category, analysis_date);

-- 15. WORK_SESSIONS
CREATE TABLE IF NOT EXISTS work_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '',
  task_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  duration_hours REAL NOT NULL DEFAULT 0,
  session_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace_date ON work_sessions(workspace_id, session_date);

-- 16. MILESTONES
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(workspace_id, project_id);

-- 17. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deadline', 'overdue', 'assignment', 'status', 'project', 'journal', 'invitation')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_tab TEXT NOT NULL DEFAULT 'dashboard',
  target_id TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read, created_at);

-- 18. AUDIT_LOGS (Track Record Unified Chronological Timeline)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'project', 'journal', 'analysis', 'planner', 'milestone', 'session', 'team', 'attachment')),
  entity_id TEXT NOT NULL,
  entity_title TEXT NOT NULL,
  project_id TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  summary TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_date ON audit_logs(workspace_id, created_at DESC);

-- 19. ATTACHMENTS (D1 Metadata + Cloudflare R2 Object Key)
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('journal', 'project', 'analysis', 'report', 'profile')),
  entity_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL DEFAULT 'Shared' CHECK (visibility IN ('Private', 'Shared')),
  storage_driver TEXT NOT NULL DEFAULT 'r2',
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(workspace_id, entity_type, entity_id);
