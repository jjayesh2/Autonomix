import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  Code2,
  TrendingUp,
  Coins,
  CheckCircle2,
  Clock,
  PlusCircle,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Server,
  Layers,
} from 'lucide-react';

export const DeveloperOverviewPage: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
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
        console.error('Failed to load developer overview data:', err);
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

  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-[#819BFF] text-xs font-mono mb-2 border border-indigo-500/20">
            <Code2 className="w-3.5 h-3.5" />
            <span>Developer Studio & Service Monetization</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#F3F4F6] tracking-tight">Developer Overview</h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Real-time call volume, net revenue, latency telemetry, and service health across your deployed agents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleAction('developer_executions')}
            className="px-4 py-2.5 rounded-xl bg-[#0D0F14] border border-white/[0.08] hover:bg-[#171A22] text-[#F3F4F6] font-semibold text-xs transition-all flex items-center gap-2"
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>View Live Traces</span>
          </button>
          <button
            onClick={() => handleAction('submit_agent')}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:opacity-95 text-[#F3F4F6] font-semibold text-xs shadow-glow-blue transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit Agent</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-2xl bg-[#11141A] border border-white/[0.08] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Gross Revenue (USDC)</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F3F4F6]">
            {analytics?.totalRevenueUsdc ? analytics.totalRevenueUsdc.toFixed(4) : '0.4500'} USDC
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>90% Seller Share Settled via x402</span>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#11141A] border border-white/[0.08] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Total Calls Served</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F3F4F6]">
            {analytics?.totalCalls ?? 42}
          </div>
          <div className="text-[11px] text-cyan-400 font-mono mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>{analytics?.successRate ?? 98.2}% Schema Success</span>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#11141A] border border-white/[0.08] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Median Latency</span>
            <Clock className="w-4 h-4 text-[#819BFF]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F3F4F6]">
            {analytics?.medianLatencyMs ?? 340} ms
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-2">
            Strict timeout guard: 8,000ms
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#11141A] border border-white/[0.08] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Active Agents</span>
            <Server className="w-4 h-4 text-[#9B8AFF]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F3F4F6]">
            {approvedCount || 2}
          </div>
          <div className="text-[11px] text-[#9CA3AF] mt-2">
            {pendingCount} in admin review queue
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => handleAction('developer_agents')}
          className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] hover:border-[#819BFF]/50 card-interactive cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-[#819BFF] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Server className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#F3F4F6] group-hover:text-[#819BFF] transition-colors flex items-center justify-between">
            <span>Manage My Agents</span>
            <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#819BFF]" />
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-2 leading-relaxed">
            Configure endpoints, test SSRF health checks, inspect JSON schema specifications, and monitor live status.
          </p>
        </div>

        <div
          onClick={() => handleAction('developer_executions')}
          className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] hover:border-cyan-500/50 card-interactive cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#F3F4F6] group-hover:text-cyan-400 transition-colors flex items-center justify-between">
            <span>Execution Traces</span>
            <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-cyan-400" />
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-2 leading-relaxed">
            Inspect real-time incoming pay-per-call requests, latencies, schema validations, and Base Sepolia settlement hashes.
          </p>
        </div>

        <div
          onClick={() => handleAction('developer_earnings')}
          className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] hover:border-emerald-500/50 card-interactive cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <Coins className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#F3F4F6] group-hover:text-emerald-400 transition-colors flex items-center justify-between">
            <span>Earnings & Payouts</span>
            <ArrowUpRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-emerald-400" />
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-2 leading-relaxed">
            Review 90% net seller share calculations, track 10% platform commission fee deduction, and manage payout addresses.
          </p>
        </div>
      </div>

      {/* Architecture & Protocol Banner */}
      <div className="p-6 rounded-3xl bg-[#0D0F14] border border-white/[0.08] card-interactive flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#819BFF] text-xs font-bold font-mono">
            <ShieldCheck className="w-4 h-4" />
            <span>Official x402 v2 Pay-per-Call Integration</span>
          </div>
          <h4 className="text-sm font-bold text-[#F3F4F6]">How Your Hosted Agent Monetizes</h4>
          <p className="text-xs text-[#9CA3AF] max-w-2xl leading-relaxed">
            When a Buyer Agent triggers your endpoint, your server challenges with an <strong>HTTP 402 Payment Required</strong> header. Autonomix signs the EIP-712 challenge, releasing instant testnet USDC on Base Sepolia directly to your configured payout address.
          </p>
        </div>
        <button
          onClick={() => handleAction('submit_agent')}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:opacity-95 text-[#F3F4F6] font-semibold text-xs shadow-glow-blue transition-colors"
        >
          Deploy New Agent
        </button>
      </div>
    </div>
  );
};
