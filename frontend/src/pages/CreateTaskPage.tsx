import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useSound } from '../context/SoundContext.js';
import {
  Sparkles,
  Coins,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Layers,
  CheckCircle,
  Database,
  Globe,
  Brain,
  AlertTriangle,
} from 'lucide-react';

interface CreateTaskPageProps {
  onNavigate: (screen: string) => void;
  onTaskCreated: (taskId: string) => void;
}

export const CreateTaskPage: React.FC<CreateTaskPageProps> = ({ onNavigate, onTaskCreated }) => {
  const { user } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [description, setDescription] = useState('');
  const [budgetLimit, setBudgetLimit] = useState(0.10);
  const [loading, setLoading] = useState(false);
  const [planPreview, setPlanPreview] = useState<any>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);

  // Demo Scenarios from Master Build Prompt
  const DEMO_PRESETS = [
    {
      id: 'demo_data',
      title: 'Demo 1: Market Data Oracle',
      category: 'Data',
      icon: Database,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      description: 'Retrieve verified decentralized price feeds and 24h market metrics for ETH from the AlphaData Oracle.',
      budget: 0.05,
    },
    {
      id: 'demo_scraper',
      title: 'Demo 2: Web Sandbox Crawler',
      category: 'Scraping',
      icon: Globe,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      description: 'Scrape and extract structured hardware products, prices, and stock states from the controlled sandbox.',
      budget: 0.05,
    },
    {
      id: 'demo_multi',
      title: 'Demo 3: Multi-Agent Synthesis (All 3)',
      category: 'Multi-Agent',
      icon: Brain,
      color: 'text-[#9B8AFF] bg-[#9B8AFF]/10 border-[#9B8AFF]/20',
      description: 'Orchestrate Data, Scraping, and Inference agents: fetch oracle prices, extract catalog items, and synthesize an executive valuation brief.',
      budget: 0.12,
    },
  ];

  // Auto-estimate plan whenever description or budget changes
  useEffect(() => {
    if (!description.trim()) {
      setPlanPreview(null);
      setPlanningError(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const plan = await api.planTask(description, budgetLimit);
        setPlanPreview(plan);
        setPlanningError(plan.canExecute ? null : plan.explanation);
      } catch (err: any) {
        setPlanningError(err.message);
      }
    }, 750);

    return () => clearTimeout(timer);
  }, [description, budgetLimit]);

  const handleApplyPreset = (preset: typeof DEMO_PRESETS[0]) => {
    playClick();
    setDescription(preset.description);
    setBudgetLimit(preset.budget);
  };

  const handleExecute = async () => {
    if (!description.trim()) return;
    playClick();
    setLoading(true);

    try {
      const task = await api.createTask({
        description,
        budgetLimit,
        userId: user?.id,
        title: description.slice(0, 48),
        plan: planPreview,
      });

      if (task.error) {
        throw new Error(task.message || task.error);
      }

      // Start execution immediately
      await api.executeTask(task.id);
      playSuccess();
      onTaskCreated(task.id);
      onNavigate('live_execution');
    } catch (err: any) {
      playError();
      setPlanningError(err.message || 'Failed to initialize task execution');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Title */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#819BFF]/10 text-[#819BFF] text-xs font-mono mb-2 border border-[#819BFF]/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Buyer Agent Autonomous Orchestrator</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Create Autonomous Task</h1>
        <p className="text-xs text-[#9CA3AF] mt-1">
          State your requirements in plain English. The Buyer Agent will autonomously plan, reserve budget, and pay agents via HTTP 402 on Base Sepolia.
        </p>
      </div>

      {/* Demo Scenario Presets */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-[#F3F4F6] uppercase tracking-wider block">
          Quick Demo Scenarios (Recommended for Hackathon Testing)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEMO_PRESETS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="p-4 rounded-2xl bg-[#11141A] border border-white/[0.08] hover:border-white/[0.16] card-interactive transition-all text-left group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`p-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 ${p.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      <span>{p.category}</span>
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold">{p.budget} USDC</span>
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-[#819BFF] transition-colors">
                    {p.title}
                  </h4>
                  <p className="text-[11px] text-[#9CA3AF] mt-1.5 leading-relaxed line-clamp-2">
                    {p.description}
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-[#819BFF] font-semibold group-hover:underline flex items-center gap-1">
                  Load Scenario <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Task Form */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated space-y-6">
        <div>
          <label className="block text-xs font-medium text-[#F3F4F6] mb-2">
            Task Description (Plain English)
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Fetch market oracle data for ETH, scrape related GPU prices from the catalog, and summarize the best investment arbitrage."
            className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-2xl p-4 text-xs text-[#F3F4F6] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#819BFF]/60 leading-relaxed font-sans transition-colors"
          />
        </div>

        {/* Budget Selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[#F3F4F6] flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-emerald-400" />
              Maximum Authorized Budget Cap
            </label>
            <span className="text-base font-extrabold font-mono text-emerald-400">
              {budgetLimit.toFixed(2)} USDC
            </span>
          </div>

          <input
            type="range"
            min="0.02"
            max="0.50"
            step="0.01"
            value={budgetLimit}
            onChange={(e) => setBudgetLimit(parseFloat(e.target.value))}
            className="w-full accent-[#819BFF] cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-slate-500 font-mono mt-1">
            <span>0.02 USDC (Min)</span>
            <span>0.10 USDC (Standard)</span>
            <span>0.50 USDC (Max Cap)</span>
          </div>
        </div>

        {/* Pre-Execution Plan & Cost Estimation */}
        {planPreview && (
          <div className="p-5 rounded-2xl bg-[#0D0F14] border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#819BFF]" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Autonomous Orchestration Plan Preview
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-300">
                Estimated Cost: <span className="text-emerald-400">{planPreview.totalEstimatedCost.toFixed(2)} USDC</span>
              </span>
            </div>

            <p className="text-xs text-[#9CA3AF]">{planPreview.explanation}</p>

            <div className="space-y-2">
              {planPreview.steps?.map((s: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#11141A] border border-white/[0.06] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#171A22] border border-white/[0.08] text-slate-300 flex items-center justify-center font-mono text-[10px]">
                      {s.stepNumber}
                    </span>
                    <div>
                      <div className="font-semibold text-white">{s.agent.name}</div>
                      <div className="text-[11px] text-[#9CA3AF]">{s.actionType}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-emerald-400 font-medium">
                      +{s.estimatedCost.toFixed(2)} USDC
                    </span>
                    <div className="text-[10px] text-slate-500 font-mono">{s.agent.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error notification */}
        {planningError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-bold block">Validation Constraint:</span>
              <span>{planningError}</span>
            </div>
          </div>
        )}

        {/* Submit Execution Button */}
        <button
          onClick={handleExecute}
          disabled={loading || !description.trim() || Boolean(planningError)}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-[#819BFF] to-[#9B8AFF] hover:from-indigo-500 hover:to-[#9B8AFF] text-white font-bold text-sm shadow-glow-accent transition-all disabled:opacity-50 flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
        >
          {loading ? (
            'Initializing Autonomous Payment Orchestration...'
          ) : (
            <>
              <Cpu className="w-4 h-4" />
              <span>Execute Task on Base Sepolia</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
