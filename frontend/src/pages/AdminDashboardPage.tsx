import React, { useState, useEffect } from 'react';
import { api, AgentSubmission } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useSound } from '../context/SoundContext.js';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  PauseCircle,
  Activity,
  Code,
  Coins,
  AlertTriangle,
  History,
  CheckCircle2,
} from 'lucide-react';

interface AdminDashboardPageProps {
  onNavigate: (screen: string) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = () => {
  const { user } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [submissions, setSubmissions] = useState<AgentSubmission[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<AgentSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [subs, logs] = await Promise.all([
        api.getAdminSubmissions(),
        api.getAdminAuditLogs(),
      ]);
      setSubmissions(subs.submissions || []);
      setAuditLogs(logs.logs || []);
      if (!selectedSub && subs.submissions?.length > 0) {
        setSelectedSub(subs.submissions[0]);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReviewAction = async (action: 'approve' | 'reject' | 'suspend') => {
    if (!selectedSub) return;
    playClick();
    setActionError(null);

    if (action === 'reject' && !rejectionReason.trim()) {
      playError();
      setActionError('A valid rejection reason is required to notify the developer.');
      return;
    }

    try {
      await api.reviewSubmission(selectedSub.id, action, rejectionReason, user?.id);
      playSuccess();
      setRejectionReason('');
      await loadData();
    } catch (err: any) {
      playError();
      setActionError(err.message || 'Review action failed');
    }
  };

  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 text-[#9B8AFF] text-xs font-mono mb-2 border border-violet-500/20">
          <ShieldCheck className="w-3.5 h-3.5 text-[#9B8AFF]" />
          <span>Restricted Admin Operations</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#F3F4F6] tracking-tight">Admin Review Dashboard</h1>
        <p className="text-xs text-[#9CA3AF] mt-1">
          Review, validate, approve, or reject third-party agent submissions before marketplace listing.
        </p>
      </div>

      {/* Review Queue & Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Submissions Queue */}
        <div className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] card-interactive space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#F3F4F6] uppercase tracking-wider">
              Submission Queue
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {pendingCount} Pending
            </span>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {submissions.map((sub) => (
              <div
                key={sub.id}
                onClick={() => {
                  playClick();
                  setSelectedSub(sub);
                  setActionError(null);
                }}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  selectedSub?.id === sub.id
                    ? 'bg-indigo-600/20 border-indigo-500/60 shadow-sm'
                    : 'bg-[#0D0F14] border-white/[0.08] hover:border-white/[0.16]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#F3F4F6] text-xs">{sub.name}</span>
                  <span
                    className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ${
                      sub.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : sub.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>
                <div className="text-[11px] text-[#9CA3AF] font-mono truncate">{sub.category} • {sub.price_usdc} USDC</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Inspection & Action Console */}
        <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] card-interactive space-y-6">
          {selectedSub ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#0D0F14] text-[#819BFF] border border-white/[0.08]">
                    {selectedSub.category} Agent
                  </span>
                  <h2 className="text-xl font-bold text-[#F3F4F6] mt-1">{selectedSub.name}</h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block">Proposed Price</span>
                  <span className="text-base font-bold font-mono text-emerald-400">
                    {selectedSub.price_usdc.toFixed(2)} USDC
                  </span>
                </div>
              </div>

              {/* Endpoint & Security Info */}
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Endpoint URL:</span>
                  <span className="font-mono text-cyan-400 bg-[#0D0F14] px-3 py-1.5 rounded-lg border border-white/[0.08] block truncate">
                    {selectedSub.endpoint_url}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">Payment Recipient Wallet:</span>
                  <span className="font-mono text-[#F3F4F6] bg-[#0D0F14] px-3 py-1.5 rounded-lg border border-white/[0.08] block truncate">
                    {selectedSub.recipient_address}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[11px]">Capabilities:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedSub.capabilities?.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[#0D0F14] border border-white/[0.08] text-[#9CA3AF] font-mono text-[10px]">
                        #{c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Schemas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-300 block mb-1">Input Schema</span>
                  <pre className="p-3 rounded-xl bg-[#08090C] border border-white/[0.08] text-[10px] font-mono text-slate-300 max-h-40 overflow-y-auto">
                    {JSON.stringify(selectedSub.input_schema, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-300 block mb-1">Output Schema</span>
                  <pre className="p-3 rounded-xl bg-[#08090C] border border-white/[0.08] text-[10px] font-mono text-emerald-400 max-h-40 overflow-y-auto">
                    {JSON.stringify(selectedSub.output_schema, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Rejection reason input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Rejection Reason (Required if rejecting)
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Endpoint latency exceeded 3000ms SLA or schema mismatch"
                  className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-[#F3F4F6] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#819BFF]"
                />
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-white/[0.08]">
                <button
                  onClick={() => handleReviewAction('approve')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm flex items-center gap-2 transition-all"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve & Publish to Marketplace
                </button>

                <button
                  onClick={() => handleReviewAction('reject')}
                  className="px-5 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 font-semibold text-xs flex items-center gap-2 transition-all"
                >
                  <XCircle className="w-4 h-4" />
                  Reject with Feedback
                </button>

                <button
                  onClick={() => handleReviewAction('suspend')}
                  className="px-4 py-2.5 rounded-xl bg-[#0D0F14] hover:bg-[#171A22] text-[#9CA3AF] border border-white/[0.08] font-medium text-xs flex items-center gap-2 transition-all"
                >
                  <PauseCircle className="w-4 h-4" />
                  Suspend
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-24 text-[#9CA3AF] text-xs">
              Select a submission from the queue to review.
            </div>
          )}
        </div>
      </div>

      {/* Admin Security Audit Log */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] card-interactive space-y-4">
        <h3 className="text-sm font-bold text-[#F3F4F6] uppercase tracking-wider flex items-center gap-2">
          <History className="w-4 h-4 text-[#9B8AFF]" />
          Administrative Action & Audit Log
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-500 text-[11px]">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Target Type</th>
                <th className="pb-2">Target ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-slate-300">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#171A22]/50 transition-colors">
                  <td className="py-2.5 text-slate-500 text-[10px]">{new Date(log.created_at).toLocaleTimeString()}</td>
                  <td className="py-2.5 font-bold text-[#819BFF]">{log.action}</td>
                  <td className="py-2.5 text-[#9CA3AF]">{log.target_type}</td>
                  <td className="py-2.5 text-slate-500 truncate max-w-xs">{log.target_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
