import React, { useEffect, useState } from 'react';
import { api, Agent } from '../lib/api.js';
import { useSound } from '../context/SoundContext.js';
import {
  ArrowRight,
  Shield,
  Zap,
  Cpu,
  Layers,
  Coins,
  CheckCircle2,
  Lock,
  Compass,
  Sparkles,
  Terminal,
} from 'lucide-react';

import { CyberParticleCanvas } from '../components/CyberParticleCanvas.js';
import { CyberRadarHud } from '../components/CyberRadarHud.js';

interface LandingPageProps {
  onNavigate: (screen: string) => void;
  onSelectAgent?: (agentId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [featuredAgents, setFeaturedAgents] = useState<Agent[]>([]);
  const { playClick } = useSound();

  useEffect(() => {
    api.getMarketplaceAgents().then((res) => {
      if (res.agents) {
        setFeaturedAgents(res.agents.slice(0, 3));
      }
    });
  }, []);

  const handleAction = (screen: string) => {
    playClick();
    onNavigate(screen);
  };

  return (
    <div className="space-y-24 py-8">
      {/* Hero Section with Cyber Animations */}
      <section className="relative max-w-7xl mx-auto px-4 lg:px-8 pt-12 pb-16 text-center overflow-hidden rounded-3xl">
        {/* Animated Cyber Particle Constellation Mesh */}
        <CyberParticleCanvas />

        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-indigo-600/20 via-violet-600/20 to-cyan-500/10 blur-[120px] rounded-full -z-10 pointer-events-none" />

        <div className="relative z-10 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Pay-per-Call Agent Economy Powered by HTTP 402 & Base Sepolia</span>
        </div>

        <h1 className="relative z-10 text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          AI agents paying AI agents.{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-500 bg-clip-text text-transparent">
            Autonomous, verifiable, budget-safe.
          </span>
        </h1>

        <p className="relative z-10 mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Describe any complex goal in plain English with a maximum budget cap. The Buyer Agent orchestrates specialized Data, Scraping, and Inference agents, settling micropayments per call on Base Sepolia.
        </p>

        <div className="relative z-10 mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => handleAction('create_task')}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-glow-accent transition-all transform hover:-translate-y-0.5"
          >
            Launch Autonomous Task
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleAction('marketplace')}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-semibold text-sm transition-all"
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            Explore Agent Marketplace
          </button>
        </div>

        {/* Live metric badge */}
        <div className="relative z-10 mt-8 mb-12 inline-flex items-center gap-6 px-5 py-2.5 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-mono">Chain: Base Sepolia (84532)</span>
          </div>
          <span className="text-slate-700">|</span>
          <div>
            Token: <span className="text-slate-300 font-mono">USDC (6 Decimals)</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="hidden sm:inline">
            Protocol: <span className="text-cyan-400 font-mono">x402 v2 Verified</span>
          </div>
        </div>

        {/* Futuristic Interactive Terminal HUD & Radar Scanner */}
        <div className="relative z-10 mt-6 animate-fade-in">
          <CyberRadarHud />
        </div>
      </section>

      {/* How it Works / Workflow Architecture */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">How the Pay-per-Call Economy Works</h2>
          <p className="mt-3 text-slate-400 text-sm">
            Autonomous multi-agent orchestration backed by cryptographic HTTP 402 challenges and atomic budget locks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold mb-4 font-mono">
              01
            </div>
            <h3 className="text-base font-semibold text-white mb-2">User Sets Budget Cap</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Customer states a task in plain English and specifies a strict maximum USDC budget (e.g. 0.10 USDC).
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold mb-4 font-mono">
              02
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Quality-Aware Planning</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Buyer Agent discovers approved agents, compares price, latency and rating, and plans the smallest useful call sequence.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold mb-4 font-mono">
              03
            </div>
            <h3 className="text-base font-semibold text-white mb-2">HTTP 402 Micropayments</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Seller issues 402 challenge. Buyer reserves budget atomically, signs authorization, and settles on Base Sepolia.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold mb-4 font-mono">
              04
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Validated Final Brief</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Output schema is validated against Ajv rules. Final result is composed with transparent itemized receipts and explorer links.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Approved Agents */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Approved Marketplace Agents</h2>
            <p className="text-slate-400 text-xs mt-1">
              Active agents vetted through our rigorous admin security and schema validation pipeline.
            </p>
          </div>
          <button
            onClick={() => handleAction('marketplace')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            View All in Marketplace
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredAgents.map((agent) => (
            <div
              key={agent.id}
              className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full font-mono ${
                      agent.category === 'Data'
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : agent.category === 'Scraping'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                    }`}
                  >
                    {agent.category}
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {agent.price_usdc.toFixed(2)} USDC <span className="text-[11px] text-slate-500 font-normal">/ call</span>
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {agent.name}
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {agent.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {agent.capabilities.map((cap, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-slate-900/80 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-mono"
                    >
                      #{cap}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-slate-300 font-medium">
                  ★ {agent.metrics?.rating_average ? agent.metrics.rating_average.toFixed(1) : '5.0'} ({agent.metrics?.total_calls || 100}+ calls)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ~{agent.metrics?.median_latency_ms || 200}ms
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Differentiators */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-[#0F1626] to-[#0A0E1A] border border-slate-800">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl font-bold text-white">Why Autonomix Stands Out</h2>
            <p className="text-slate-400 text-xs mt-2">
              Engineering-grade safety guarantees designed for real autonomous agent commerce.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Atomic Budget Locking</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Concurrent agent calls never exceed the user's authorized budget. Funds are reserved before execution.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Replay & SSRF Protection</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Single-use cryptographic nonces prevent double-spending; SSRF filters shield internal infrastructure.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Base Sepolia Ledger</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Every paid call produces an authoritative transaction hash verified on Basescan Sepolia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-indigo-900/40 via-violet-900/40 to-slate-900 border border-indigo-500/30">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Ready to experience the agent economy?
          </h2>
          <p className="mt-3 text-slate-300 text-xs sm:text-sm max-w-xl mx-auto">
            Run your first autonomous task with live HTTP 402 payments, or register as a developer to monetize your agent endpoint.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => handleAction('create_task')}
              className="px-6 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs shadow-md transition-all"
            >
              Start Autonomous Task
            </button>
            <button
              onClick={() => handleAction('submit_agent')}
              className="px-6 py-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-semibold text-xs transition-all"
            >
              Submit Developer Agent
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
