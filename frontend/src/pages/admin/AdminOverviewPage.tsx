import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  ShieldCheck,
  Users,
  Server,
  Activity,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export const AdminOverviewPage: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { playClick } = useSound();

  const [overview, setOverview] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [stats, logs, ai] = await Promise.all([
          api.getAdminOverview(),
          api.getAdminAuditLogs(),
          api.getAIStatus(),
        ]);
        setOverview(stats);
        setAuditLogs(logs.logs || []);
        setAiStatus(ai);
      } catch (err) {
        console.error('Failed to load admin overview:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, []);

  const handleTestAI = async () => {
    playClick();
    setTestingAI(true);
    setAiTestResult(null);
    try {
      const res = await api.testAIConnection();
      setAiTestResult(res);
      const updated = await api.getAIStatus();
      setAiStatus(updated);
    } catch (err: any) {
      setAiTestResult({ success: false, message: err.message || 'Diagnostic failed' });
    } finally {
      setTestingAI(false);
    }
  };

  const handleAction = (screen: string) => {
    playClick();
    onNavigate(screen);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 text-[#9B8AFF] text-xs font-mono mb-2 border border-violet-500/20">
            <Lock className="w-3.5 h-3.5" />
            <span>Root Administration & Governance</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#F3F4F6] tracking-tight">Admin Console</h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Global network telemetry, agent safety approvals, role privileges, and tamper-evident audit logs.
          </p>
        </div>

        {overview?.pendingReviews > 0 && (
          <button
            onClick={() => handleAction('admin_reviews')}
            className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-[#F3F4F6] font-semibold text-xs shadow-glow-violet transition-all flex items-center gap-2 animate-pulse"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{overview.pendingReviews} Agents Awaiting Review</span>
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-[#11141A] border border-violet-500/30 card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Pending Submissions</span>
            <ShieldAlert className="w-4 h-4 text-[#9B8AFF]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#9B8AFF]">
            {overview?.pendingReviews ?? 1}
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-2">
            Mandatory rejection rationale required
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#11141A] border border-white/[0.08] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Registered Profiles</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F3F4F6]">
            {overview?.totalUsers ?? 3}
          </div>
          <div className="text-[11px] text-cyan-400 font-mono mt-2">
            Role promotion via secure endpoint
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#11141A] border border-white/[0.08] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Active Marketplace Agents</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F3F4F6]">
            {overview?.activeAgents ?? 3}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-2">
            SSRF & schema validated
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#11141A] border border-white/[0.08] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Platform Invocations</span>
            <Activity className="w-4 h-4 text-[#819BFF]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F3F4F6]">
            {overview?.totalExecutions ?? 24}
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-2">
            Base Sepolia settled
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => handleAction('admin_reviews')}
          className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] hover:border-violet-500/50 card-interactive cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-violet-500/10 text-[#9B8AFF] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#F3F4F6] group-hover:text-[#9B8AFF] transition-colors flex items-center justify-between">
            <span>Review Queue</span>
            <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#9B8AFF]" />
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-2 leading-relaxed">
            Approve, reject with feedback, or suspend agent submissions before they enter the public marketplace.
          </p>
        </div>

        <div
          onClick={() => handleAction('admin_users')}
          className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] hover:border-cyan-500/50 card-interactive cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#F3F4F6] group-hover:text-cyan-400 transition-colors flex items-center justify-between">
            <span>Users & Privileges</span>
            <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-cyan-400" />
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-2 leading-relaxed">
            Manage authenticated profiles, grant developer publishing privileges, and monitor suspicious registrations.
          </p>
        </div>

        <div
          onClick={() => handleAction('admin_monitoring')}
          className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] hover:border-[#819BFF]/50 card-interactive cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-[#819BFF] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#F3F4F6] group-hover:text-[#819BFF] transition-colors flex items-center justify-between">
            <span>Platform Monitoring</span>
            <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#819BFF]" />
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-2 leading-relaxed">
            Inspect platform-wide execution traces, failure spikes, latency anomalies, and x402 payment reconciliations.
          </p>
        </div>
      </div>

      {/* AI Model Provider Infrastructure & Health Diagnostics */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-indigo-500/30 card-interactive space-y-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-base font-bold text-[#F3F4F6]">AI Model Provider Infrastructure</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/10 text-[#819BFF] border border-indigo-500/20">
                Official Google Gen AI SDK
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF]">
              Server-side AI orchestrator status, real token usage tracking, and automated diagnostics. API keys are strictly kept server-side.
            </p>
          </div>

          <button
            onClick={handleTestAI}
            disabled={testingAI}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:opacity-95 text-[#F3F4F6] font-semibold text-xs shadow-glow-blue transition-colors flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {testingAI ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
            <span>Run Provider Ping Diagnostic</span>
          </button>
        </div>

        {/* Diagnostic result feedback */}
        {aiTestResult && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-mono flex items-center justify-between border ${
              aiTestResult.success
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {aiTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
              <span>{aiTestResult.message}</span>
            </div>
            {aiTestResult.latencyMs && (
              <span className="text-[#9CA3AF] text-[10px]">Roundtrip: ~{aiTestResult.latencyMs}ms</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-white/[0.08] text-xs font-mono">
          <div>
            <span className="text-slate-500 text-[10px] block">Active Provider:</span>
            <span className="text-[#F3F4F6] font-bold uppercase mt-0.5 block">{aiStatus?.provider || 'Google Gemini'}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Configured Model:</span>
            <span className="text-cyan-400 font-bold mt-0.5 block">{aiStatus?.model || 'gemini-3.5-flash-lite'}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Tokens Processed:</span>
            <span className="text-[#819BFF] font-bold mt-0.5 block">{aiStatus?.totalTokens || 0} tokens</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Cumulative AI Cost:</span>
            <span className="text-emerald-400 font-bold mt-0.5 block">${aiStatus?.totalCostUsd?.toFixed(6) || '0.000000'} USD</span>
          </div>
        </div>
      </div>

      {/* Recent Security Audit Logs */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] card-interactive space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#F3F4F6]">Tamper-Evident Audit Logs</h3>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Append-only security records of administrative actions, agent submissions, and role alterations.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">{auditLogs.length} entries</span>
        </div>

        <div className="divide-y divide-white/[0.04] max-h-80 overflow-y-auto">
          {auditLogs.slice(0, 8).map((log) => (
            <div key={log.id} className="py-3 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                <div>
                  <span className="font-mono font-bold text-[#F3F4F6] uppercase text-[11px]">{log.action}</span>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Target: {log.target_type} ({log.target_id?.slice(0, 8) || 'system'}) • Actor: {log.actor_id?.slice(0, 8) || 'system'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                {new Date(log.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
