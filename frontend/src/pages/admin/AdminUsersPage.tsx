import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  Users,
  Shield,
  Code2,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Lock,
} from 'lucide-react';

export const AdminUsersPage: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const { user: currentAdmin } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminUsers();
      setUsers(res.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    playClick();
    setActionLoadingId(userId);
    setNotification(null);

    try {
      await api.updateUserRole(userId, newRole, currentAdmin?.id);
      playSuccess();
      setNotification({
        type: 'success',
        message: `User privileges updated to "${newRole.toUpperCase()}".`,
      });
      await fetchUsers();
    } catch (err: any) {
      playError();
      setNotification({
        type: 'error',
        message: err.message || 'Failed to update user role.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-2 border border-cyan-500/20">
            <Users className="w-3.5 h-3.5" />
            <span>Role-Based Access Control</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#F3F4F6] tracking-tight">Users & Role Governance</h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Audit authenticated profiles, manage developer onboarding requests, and promote accounts to privileged tiers.
          </p>
        </div>

        <button
          onClick={() => {
            playClick();
            fetchUsers();
          }}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#0D0F14] border border-white/[0.08] hover:bg-[#171A22] text-[#9CA3AF] hover:text-[#F3F4F6] text-xs font-semibold flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Directory</span>
        </button>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center gap-2 border ${
            notification.type === 'success'
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by email, user ID, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#11141A] border border-white/[0.08] text-[#F3F4F6] text-xs placeholder:text-[#9CA3AF]/60 focus:outline-none focus:border-violet-500 font-mono"
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="p-12 text-center text-[#9CA3AF] flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#9B8AFF]" />
          <span className="text-xs">Loading registered user accounts...</span>
        </div>
      ) : (
        <div className="rounded-3xl bg-[#11141A] border border-white/[0.08] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0D0F14] text-[#9CA3AF] font-mono border-b border-white/[0.08] uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">User Email / Account</th>
                  <th className="py-3 px-4">User ID</th>
                  <th className="py-3 px-4">Current Role</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Role Authorization Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredUsers.map((u) => {
                  const isActing = actionLoadingId === u.id;
                  const isSelf = currentAdmin?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-[#171A22]/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#F3F4F6]">
                        <div className="flex items-center gap-2">
                          <span>{u.email || 'Anonymous / OAuth Account'}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-[#9B8AFF] text-[9px] font-mono border border-violet-500/30">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#9CA3AF] text-[11px]">
                        {u.id.slice(0, 12)}...
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase inline-flex items-center gap-1 ${
                            u.role === 'admin'
                              ? 'bg-violet-500/10 text-[#9B8AFF] border border-violet-500/30'
                              : u.role === 'developer'
                              ? 'bg-indigo-500/10 text-[#819BFF] border border-indigo-500/30'
                              : 'bg-[#171A22] text-[#9CA3AF] border border-white/[0.06]'
                          }`}
                        >
                          {u.role === 'admin' && <Lock className="w-2.5 h-2.5" />}
                          {u.role === 'developer' && <Code2 className="w-2.5 h-2.5" />}
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#9CA3AF] text-[11px]">
                        {new Date(u.created_at || Date.now()).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {u.role === 'customer' && (
                            <button
                              onClick={() => handleRoleChange(u.id, 'developer')}
                              disabled={isActing}
                              className="px-3 py-1 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-[#819BFF] border border-indigo-500/30 font-semibold text-[11px] transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              {isActing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Code2 className="w-3 h-3" />
                              )}
                              <span>Promote to Developer</span>
                            </button>
                          )}

                          {u.role === 'developer' && (
                            <button
                              onClick={() => handleRoleChange(u.id, 'customer')}
                              disabled={isActing}
                              className="px-3 py-1 rounded-xl bg-[#171A22] hover:bg-[#1e222d] text-slate-300 border border-white/[0.08] font-semibold text-[11px] transition-colors disabled:opacity-50"
                            >
                              Revoke to Customer
                            </button>
                          )}

                          {u.role !== 'admin' && (
                            <button
                              onClick={() => handleRoleChange(u.id, 'admin')}
                              disabled={isActing}
                              className="px-2.5 py-1 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-[#9B8AFF] border border-violet-500/30 font-semibold text-[11px] transition-colors disabled:opacity-50"
                            >
                              Grant Admin
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
