import React, { useState, useEffect } from 'react';
import { api, AgentSubmission } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  PauseCircle,
  Activity,
  AlertTriangle,
  History,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
} from 'lucide-react';

export const AdminReviewsPage: React.FC<{ onNavigate: (screen: string) => void }> = () => {
  const { user } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [submissions, setSubmissions] = useState<AgentSubmission[]>([]);
  const [selectedSub, setSelectedSub] = useState<AgentSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const subs = await api.getAdminSubmissions();
      const list = subs.submissions || [];
      setSubmissions(list);
      if (!selectedSub && list.length > 0) {
        setSelectedSub(list[0]);
      } else if (selectedSub) {
        const updated = list.find((s: AgentSubmission) => s.id === selectedSub.id);
        if (updated) setSelectedSub(updated);
      }
    } catch (err) {
      console.error('Failed to load submissions for review:', err);
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 text-[#9B8AFF] text-xs font-mono mb-2 border border-violet-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Agent Safety & Integrity Verification</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#F3F4F6] tracking-tight">Review Queue</h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Validate developer endpoints against SSRF rules, verify JSON schemas, and authorize agents for the public marketplace.
          </p>
        </div>

        {pendingCount > 0 && (
          <span className="self-start sm:self-auto px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-[#9B8AFF] font-mono text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{pendingCount} Pending Approval</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-[#9CA3AF] flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#9B8AFF]" />
          <span className="text-xs">Loading submission queue...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Submissions List */}
          <div className="lg:col-span-1 space-y-3">
            <span className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider block px-1">
              Submissions ({submissions.length})
            </span>

            {submissions.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#11141A] border border-white/[0.08] text-center text-xs text-[#9CA3AF]">
                No submissions found.
              </div>
            ) : (
              submissions.map((sub) => {
                const isSelected = selectedSub?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      playClick();
                      setSelectedSub(sub);
                      setActionError(null);
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-[#171A22] border-violet-500 shadow-glow-violet'
                        : 'bg-[#11141A] border-white/[0.08] hover:border-white/[0.16]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#F3F4F6] truncate max-w-[160px]">{sub.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold ${
                          sub.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : sub.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#9CA3AF] truncate">{sub.description}</div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2 pt-2 border-t border-white/[0.06]">
                      <span>{sub.category}</span>
                      <span className="text-emerald-400 font-bold">{sub.price_usdc.toFixed(2)} USDC</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Submission Details & Action Panel */}
          <div className="lg:col-span-2">
            {selectedSub ? (
              <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] card-interactive space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-[#F3F4F6]">{selectedSub.name}</h2>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#171A22] text-[#9CA3AF] border border-white/[0.06]">
                      {selectedSub.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#9CA3AF]">{selectedSub.description}</p>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] text-xs font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Endpoint URL (SSRF Protected):</span>
                    <span className="text-slate-200 truncate block mt-0.5">{selectedSub.endpoint_url}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Service Price:</span>
                    <span className="text-emerald-400 font-bold block mt-0.5">{selectedSub.price_usdc.toFixed(2)} USDC</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Developer Settlement Address:</span>
                    <span className="text-cyan-400 truncate block mt-0.5">{selectedSub.recipient_address}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Submitted Date:</span>
                    <span className="text-slate-300 block mt-0.5">{new Date(selectedSub.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Capabilities */}
                <div>
                  <span className="text-xs font-semibold text-slate-300 block mb-2">Advertised Capabilities:</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedSub.capabilities?.map((c, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-xl bg-[#0D0F14] border border-white/[0.08] text-xs font-mono text-[#9CA3AF]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Schemas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block mb-1">Input Schema (JSON):</span>
                    <pre className="p-3.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-slate-300 text-[10px] font-mono overflow-x-auto max-h-40">
                      {JSON.stringify(selectedSub.input_schema, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block mb-1">Output Schema (JSON):</span>
                    <pre className="p-3.5 rounded-xl bg-[#08090C] border border-white/[0.08] text-emerald-400 text-[10px] font-mono overflow-x-auto max-h-40">
                      {JSON.stringify(selectedSub.output_schema, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Error Banner */}
                {actionError && (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* Actions Section */}
                <div className="pt-4 border-t border-white/[0.08] space-y-4">
                  <span className="text-xs font-bold text-[#F3F4F6] uppercase tracking-wider block">Admin Verdict</span>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleReviewAction('approve')}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-glow-accent transition-all flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve & Publish to Marketplace</span>
                    </button>

                    <button
                      onClick={() => handleReviewAction('suspend')}
                      className="px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-white/[0.08] hover:bg-[#171A22] text-[#9CA3AF] hover:text-[#F3F4F6] font-semibold text-xs transition-colors flex items-center gap-2"
                    >
                      <PauseCircle className="w-4 h-4 text-amber-400" />
                      <span>Suspend Agent</span>
                    </button>
                  </div>

                  {/* Rejection field */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs text-[#9CA3AF] block">
                      Rejection Reason (Mandatory if rejecting submission):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Output schema does not match RFC specifications..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-[#08090C] border border-white/[0.08] text-[#F3F4F6] placeholder-[#9CA3AF]/60 text-xs focus:outline-none focus:border-rose-500 font-mono"
                      />
                      <button
                        onClick={() => handleReviewAction('reject')}
                        className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 font-semibold text-xs transition-colors flex items-center gap-2 shrink-0"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-3xl bg-[#11141A] border border-white/[0.08] text-center text-xs text-[#9CA3AF]">
                Select a submission from the list to review details.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
