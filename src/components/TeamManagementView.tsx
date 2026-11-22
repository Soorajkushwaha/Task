import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Plus,
  Building2,
  KeyRound,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { WorkspaceRole } from '../types';

const ROLES: WorkspaceRole[] = ['Owner', 'Admin', 'Manager', 'Member'];

export const TeamManagementView: React.FC = () => {
  const {
    userProfile,
    workspaces,
    currentWorkspace,
    setCurrentWorkspaceId,
    currentUserRole,
    members,
    invitations,
    tasks,
    auditLogs,
    createWorkspace,
    createInvitation,
    revokeInvitation,
    acceptInvitationByToken,
    updateMemberRole,
    removeMember,
  } = useApp();

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Manager' | 'Member'>('Member');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinStatusMessage, setJoinStatusMessage] = useState<string | null>(null);

  const canManageTeam =
    currentUserRole === 'Owner' ||
    currentUserRole === 'Admin' ||
    currentWorkspace?.ownerId === userProfile?.id;

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    await createWorkspace(newTeamName.trim(), newTeamDesc.trim(), 'team');
    setNewTeamName('');
    setNewTeamDesc('');
    setShowCreateTeam(false);
  };

  const handleCreateInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    const inv = await createInvitation(inviteEmail.trim(), inviteRole);
    if (inv) {
      setGeneratedToken(inv.inviteCode);
    }
    setInviteEmail('');
  };

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleAcceptJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    try {
      await acceptInvitationByToken(joinCodeInput.trim());
      setJoinStatusMessage('Invitation accepted! Workspace synced.');
      setJoinCodeInput('');
    } catch (err) {
      setJoinStatusMessage(
        err instanceof Error ? err.message : 'Invalid or expired invitation code.'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Role-Based Access Control (RBAC), Expiring Invitations & Workload Allocation
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            Team & Workspace Management
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCreateTeam(!showCreateTeam)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Team Workspace
          </button>
        </div>
      </div>

      {showCreateTeam && (
        <form
          onSubmit={handleCreateTeamSubmit}
          className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              Provision New Team Workspace
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateTeam(false)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Team Workspace Name *
              </label>
              <input
                type="text"
                required
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="e.g., WhimsyMaya Core Strategy & Product"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newTeamDesc}
                onChange={(e) => setNewTeamDesc(e.target.value)}
                placeholder="Shared projects, analyst research, and sprint execution"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
            >
              Create Team Workspace
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-mono uppercase text-slate-400">Active Workspace Context</div>
          <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {currentWorkspace?.name || 'Workspace'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Type: <strong className="font-mono uppercase">{currentWorkspace?.type}</strong> · Your Role:{' '}
                <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                  {currentUserRole}
                </strong>{' '}
                · {members.length} active members
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => setCurrentWorkspaceId(ws.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    ws.id === currentWorkspace?.id
                      ? 'bg-slate-900 text-white dark:bg-indigo-600 border-transparent'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {ws.name} ({ws.type})
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">1. Owner</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Full control over workspace, members, projects, and settings.
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">2. Admin</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Can manage team members, projects, tasks, and workspace reports.
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">3. Manager</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Can create projects, assign tasks, and review team progress.
              </div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">4. Member</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Can manage assigned tasks, update progress, and log work entries.
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
              Join Workspace via Invite Code
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Paste an expiring invitation code generated by a workspace Owner or Admin to join their team.
            </p>
            <form onSubmit={handleAcceptJoinCode} className="mt-3 space-y-2.5">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="Paste invitation token..."
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-indigo-600 text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                Redeem Invitation Code
              </button>
            </form>
          </div>
          {joinStatusMessage && (
            <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-2">
              {joinStatusMessage}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Workspace Members & Workload ({members.length})
              </h3>
              <p className="text-xs text-slate-500">
                Assign RBAC roles and monitor assigned task execution
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {members.map((m) => {
              const memberTasks = tasks.filter(
                (t) => t.assignedTo === m.userId && t.status !== 'Cancelled'
              );
              const completedCount = memberTasks.filter((t) => t.status === 'Completed').length;
              const hoursLogged = memberTasks.reduce(
                (s, t) => s + (Number(t.actualHours) || 0),
                0
              );

              return (
                <div
                  key={m.id || m.userId}
                  className="py-3.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {m.displayName}
                    </div>
                    <div className="text-xs font-mono text-slate-500">
                      {completedCount}/{memberTasks.length} tasks done ·{' '}
                      {Math.round(hoursLogged * 10) / 10}h logged
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManageTeam && m.role !== 'Owner' ? (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => updateMemberRole(m.id, e.target.value as WorkspaceRole)}
                          className="px-2.5 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeMember(m.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Remove Member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {m.role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-500" />
              Generate Expiring Invitation Link / Code
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Invitations expire automatically after 7 days in Cloudflare D1
            </p>
          </div>

          <form onSubmit={handleCreateInviteSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Invitee Email or Label
              </label>
              <input
                type="text"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Assigned Workspace Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as 'Admin' | 'Manager' | 'Member')
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="Member">Member</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!canManageTeam}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white cursor-pointer"
            >
              Generate 7-Day Invitation Token
            </button>
          </form>

          {generatedToken && (
            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs space-y-1.5">
              <div className="font-semibold text-emerald-800 dark:text-emerald-300">
                Invitation Code Created
              </div>
              <div className="flex items-center justify-between gap-2 font-mono text-[11px] bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                <span className="truncate">{generatedToken}</span>
                <button
                  type="button"
                  onClick={() => handleCopyToken(generatedToken)}
                  className="text-indigo-600 hover:text-indigo-500 shrink-0 cursor-pointer"
                >
                  {copiedToken === generatedToken ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-xs font-mono uppercase text-slate-400">
              Workspace Invitations ({invitations.length})
            </div>
            {invitations.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">No active invitations.</div>
            ) : (
              invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {inv.invitedLabel}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Role: {inv.assignedRole} · {inv.status} · Code: {inv.inviteCode}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyToken(inv.inviteCode)}
                      className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                      title="Copy Invite Token"
                    >
                      {copiedToken === inv.inviteCode ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {inv.status === 'Pending' && canManageTeam && (
                      <button
                        type="button"
                        onClick={() => revokeInvitation(inv.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Revoke Invitation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          Team Activity & Audit Stream
        </h3>
        <div className="divide-y divide-slate-200/70 dark:divide-slate-800 max-h-64 overflow-y-auto">
          {auditLogs.slice(0, 12).map((log) => (
            <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {log.actorName}
                </span>{' '}
                <span className="text-slate-500">{log.actionType.toLowerCase()}</span>{' '}
                <span className="font-mono text-indigo-600 dark:text-indigo-400">
                  {log.entityType}
                </span>
                : <span className="font-medium text-slate-700 dark:text-slate-300">{log.entityTitle}</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {(log.createdAt || '').slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
