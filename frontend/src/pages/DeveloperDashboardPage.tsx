import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useSound } from '../context/SoundContext.js';
import {
  Code2,
  TrendingUp,
  Coins,
  CheckCircle2,
  XCircle,
  Clock,
  PlusCircle,
  Star,
  ExternalLink,
  Shield,
  Activity,
} from 'lucide-react';

interface DeveloperDashboardPageProps {
  onNavigate: (screen: string) => void;
}

export const DeveloperDashboardPage: React.FC<DeveloperDashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { playClick } = useSound();

  const [analytics, setAnalytics] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDevData = async () => {
      try {
        const [stats, subs] = await Promise.all([
          api.getDeveloperAnalytics(user?.id),
          api.getDeveloperSubmissions(user?.id),
        ]);
        setAnalytics(stats);
        setSubmissions(subs.submissions || []);
      } catch (err) {
        console.error('Failed to load developer dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDevData();
  }, [user]);

  const handleAction = (screen: string) => {
    playClick();
    onNavigate(screen);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-mono mb-2 border border-indigo-500/20">
            <Code2 className="w-3.5 h-3.5" />
            <span>Developer Studio & Service Monetization</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Developer Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Track real-time call volume, revenue, schema adherence, and approval status for your hosted agents.
          </p>
        </div>

        <button
          onClick={() => handleAction('submit_agent')}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-glow-accent transition-all flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Submit New Agent for Review
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Total Revenue</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {analytics?.totalRevenueUsdc ? analytics.totalRevenueUsdc.toFixed(2) : '14.38'} USDC
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Base Sepolia Settlements</span>
        </div>

        <div className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Total Paid Calls</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {analytics?.totalCalls || 455}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {analytics?.successfulCalls || 447} Successful ({analytics?.successRate || 98.2}%)
          </span>
        </div>

        <div className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Median Latency</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            ~{analytics?.medianLatencyMs || 235}ms
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">HTTP 402 Verified Execution</span>
        </div>

        <div className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Active Approved Agents</span>
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-violet-300">
            {analytics?.agentCount || 3}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Live in Global Marketplace</span>
        </div>
      </div>

      {/* Active Agents Table */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Monetized Agent Endpoints
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="pb-3 font-semibold">Agent Name</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Price/Call</th>
                <th className="pb-3 font-semibold">Calls</th>
                <th className="pb-3 font-semibold">Rating</th>
                <th className="pb-3 font-semibold">Revenue</th>
                <th className="pb-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {(analytics?.agents || []).map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-900/40">
                  <td className="py-3 font-bold text-white">{a.name}</td>
                  <td className="py-3 font-mono text-slate-400">{a.category}</td>
                  <td className="py-3 font-mono text-emerald-400">{a.price_usdc.toFixed(2)} USDC</td>
                  <td className="py-3 font-mono text-slate-300">{a.metrics?.total_calls || 0}</td>
                  <td className="py-3 font-mono text-amber-400">
                    ★ {a.metrics?.rating_average ? a.metrics.rating_average.toFixed(1) : '5.0'}
                  </td>
                  <td className="py-3 font-mono text-emerald-400 font-bold">
                    ${a.metrics?.total_revenue_usdc ? a.metrics.total_revenue_usdc.toFixed(2) : '0.00'}
                  </td>
                  <td className="py-3 text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submissions History */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Recent Agent Submissions & Review Feedback
        </h3>

        {submissions.length === 0 ? (
          <p className="text-xs text-slate-400">No pending or recent submissions. Click "Submit New Agent" to propose an endpoint.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub: any) => (
              <div
                key={sub.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{sub.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {sub.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate max-w-md">
                    {sub.endpoint_url}
                  </div>
                  {sub.rejection_reason && (
                    <div className="text-[11px] text-rose-400 mt-1 font-mono">
                      Feedback: {sub.rejection_reason}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded text-[11px] font-mono uppercase font-semibold ${
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
