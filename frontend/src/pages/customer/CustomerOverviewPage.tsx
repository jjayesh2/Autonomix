import React, { useState, useEffect } from 'react';
import { api, Task, Agent } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  Coins,
  Cpu,
  PlusCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

interface CustomerOverviewPageProps {
  onNavigate: (tab: string) => void;
  onSelectTask: (taskId: string) => void;
}

export const CustomerOverviewPage: React.FC<CustomerOverviewPageProps> = ({ onNavigate, onSelectTask }) => {
  const { user } = useAuth();
  const { playClick } = useSound();

  const [wallet, setWallet] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [featuredAgents, setFeaturedAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [w, t, a] = await Promise.all([
          api.getWalletSummary(user?.id),
          api.getTasks(user?.id),
          api.getMarketplaceAgents(),
        ]);
        setWallet(w);
        setTasks(t.tasks || []);
        setFeaturedAgents((a.agents || []).slice(0, 3));
      } catch (err) {
        console.error('Failed to load customer overview:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const activeTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'planning');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const successRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 100;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner / Welcome */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#11141A] to-[#171A22] border border-white/[0.08] shadow-card-elevated flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-2 border border-cyan-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Buyer Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.displayName}
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-1 max-w-xl">
            Orchestrate multi-agent workflows, deploy verified sub-services, and settle micro-calls on Base Sepolia.
          </p>
        </div>

        <button
          onClick={() => {
            playClick();
            onNavigate('create_task');
          }}
          className="self-start md:self-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:from-indigo-500 hover:to-[#819BFF] text-white font-bold text-xs shadow-glow-accent transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Launch New Task</span>
        </button>
      </div>

      {/* Operational Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#11141A] border border-white/[0.08] hover:border-white/[0.16] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-2">
            <span className="text-xs font-medium">Available Task Balance</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400">
            {wallet?.availableBalanceUsdc ? wallet.availableBalanceUsdc.toFixed(2) : '5.00'} USDC
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">Base Sepolia Testnet</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#11141A] border border-white/[0.08] hover:border-white/[0.16] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-2">
            <span className="text-xs font-medium">Total Spending</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-white">
            {wallet?.totalSpentUsdc ? wallet.totalSpentUsdc.toFixed(2) : '0.00'} USDC
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">Across {tasks.length} tasks</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#11141A] border border-white/[0.08] hover:border-white/[0.16] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-2">
            <span className="text-xs font-medium">Executing Now</span>
            <Activity className="w-4 h-4 text-[#819BFF]" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-[#819BFF]">
            {activeTasks.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">
            {activeTasks.length > 0 ? 'Live on-chain settlements' : 'No active tasks'}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#11141A] border border-white/[0.08] hover:border-white/[0.16] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] mb-2">
            <span className="text-xs font-medium">Task Success Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-400">
            {successRate}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">Schema-verified executions</div>
        </div>
      </div>

      {/* Two Column Layout: Recent Tasks & Recommended Agents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tasks Table */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Recent Autonomous Tasks
            </h3>
            <button
              onClick={() => {
                playClick();
                onNavigate('customer_tasks');
              }}
              className="text-xs text-[#819BFF] hover:text-[#9B8AFF] font-semibold transition-colors"
            >
              View All Tasks →
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-12 text-[#9CA3AF] text-xs">
              No tasks launched yet. Launch your first task using the button above.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  onClick={() => {
                    playClick();
                    onSelectTask(task.id);
                  }}
                  className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] hover:border-white/[0.16] card-interactive cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs truncate max-w-sm">
                        {task.description}
                      </span>
                      <span
                        className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                          task.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : task.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#9CA3AF] mt-1 font-mono">
                      {new Date(task.created_at).toLocaleString()} • Budget: {task.budget_limit.toFixed(2)} USDC
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-emerald-400 text-xs font-bold">
                      {task.total_cost.toFixed(2)} USDC
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommended Approved Agents */}
        <div className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Marketplace Agents
            </h3>
            <button
              onClick={() => {
                playClick();
                onNavigate('marketplace');
              }}
              className="text-xs text-[#819BFF] hover:text-[#9B8AFF] font-semibold transition-colors"
            >
              Browse →
            </button>
          </div>

          <div className="space-y-3">
            {featuredAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => {
                  playClick();
                  onNavigate('marketplace');
                }}
                className="p-3.5 rounded-2xl bg-[#0D0F14] border border-white/[0.08] hover:border-white/[0.16] card-interactive cursor-pointer transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate max-w-[150px]">
                    {agent.name}
                  </span>
                  <span className="font-mono text-emerald-400 text-xs font-semibold">
                    {agent.price_usdc.toFixed(2)} USDC
                  </span>
                </div>
                <p className="text-[11px] text-[#9CA3AF] line-clamp-1">{agent.description}</p>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
                  <span>★ {agent.metrics?.rating_average ? agent.metrics.rating_average.toFixed(1) : '5.0'}</span>
                  <span>~{agent.metrics?.median_latency_ms || 200}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
