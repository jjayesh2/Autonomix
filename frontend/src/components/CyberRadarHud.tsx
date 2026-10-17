import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Activity, Zap, Radio, Terminal } from 'lucide-react';

interface AgentBlip {
  id: string;
  name: string;
  role: string;
  price: string;
  angleDeg: number;
  distancePct: number;
  color: string;
}

export const CyberRadarHud: React.FC = () => {
  const [blockHeight, setBlockHeight] = useState(14_285_420);
  const [activeLogIndex, setActiveLogIndex] = useState(0);

  const logs = [
    'BASE_SEPOLIA: Block confirmed | Gas: 0.001 Gwei',
    'x402_CHANNEL: EIP-712 cryptographic permit pool ready',
    'ORCHESTRATOR: Gemini 3.5 Flash-Lite schema validator loaded',
    'DATA_AGENT: Live DummyJSON + Binance oracles active',
    'SCRAPER_AGENT: Cheerio DOM parser listening on /api/agents/scraper',
    'LEDGER_GUARD: Atomic budget locks reconciled',
  ];

  useEffect(() => {
    // Increment block height every 3 seconds to show live network heartbeat
    const blockInterval = setInterval(() => {
      setBlockHeight((prev) => prev + 1);
    }, 3000);

    // Rotate telemetry logs
    const logInterval = setInterval(() => {
      setActiveLogIndex((prev) => (prev + 1) % logs.length);
    }, 2400);

    return () => {
      clearInterval(blockInterval);
      clearInterval(logInterval);
    };
  }, []);

  const agents: AgentBlip[] = [
    { id: '1', name: 'AlphaData', role: 'Data Oracle', price: '0.02 USDC', angleDeg: 45, distancePct: 58, color: '#38BDF8' },
    { id: '2', name: 'WebExtract', role: 'Web Scraper', price: '0.03 USDC', angleDeg: 160, distancePct: 68, color: '#A855F7' },
    { id: '3', name: 'CogniSynthesize', role: 'AI Inference', price: '0.04 USDC', angleDeg: 285, distancePct: 50, color: '#06B6D4' },
  ];

  return (
    <div className="relative w-full max-w-4xl mx-auto rounded-3xl p-6 sm:p-8 bg-[#0B101D]/90 border border-indigo-500/30 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Decorative Corner Cyber Brackets */}
      <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
      <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
      <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

      {/* Top Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800/80 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold tracking-wider uppercase text-[10px]">Orchestrator Active</span>
          </div>
          <span className="text-slate-400">
            Chain: <span className="text-white">Base Sepolia (84532)</span>
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline">
            Block: <span className="text-cyan-400 font-bold">#{blockHeight.toLocaleString()}</span>
          </span>
        </div>

        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>0.001 Gwei</span>
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-bold">100% SLA</span>
        </div>
      </div>

      {/* Main HUD Body: Radar + Live Marketplace Node Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-6">
        {/* Left: Animated Radar Display */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full border border-indigo-500/40 bg-[#070B14]/80 flex items-center justify-center shadow-inner overflow-hidden">
            {/* Concentric distance rings */}
            <div className="absolute inset-4 rounded-full border border-indigo-500/20" />
            <div className="absolute inset-12 rounded-full border border-indigo-500/25" />
            <div className="absolute inset-20 rounded-full border border-indigo-500/30" />
            <div className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-glow-cyan" />

            {/* Crosshairs */}
            <div className="absolute inset-x-0 top-1/2 h-px bg-indigo-500/20" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-indigo-500/20" />

            {/* Rotating 360-degree radar beam */}
            <div className="absolute inset-0 origin-center animate-radar-sweep pointer-events-none">
              <div
                className="w-1/2 h-1/2 origin-bottom-right"
                style={{
                  background: 'conic-gradient(from 0deg, rgba(6, 182, 212, 0.45) 0deg, transparent 65deg)',
                }}
              />
            </div>

            {/* Agent Radar Blips */}
            {agents.map((agent) => {
              const rad = (agent.angleDeg * Math.PI) / 180;
              const radius = agent.distancePct * 1.1; // scale to fit inside 120px radius
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;

              return (
                <div
                  key={agent.id}
                  className="absolute group cursor-pointer"
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                  }}
                >
                  <span
                    className="block w-3 h-3 rounded-full animate-ping absolute -inset-0.5 opacity-75"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span
                    className="relative block w-2.5 h-2.5 rounded-full border border-white"
                    style={{ backgroundColor: agent.color }}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center bg-slate-900 border border-slate-700 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap shadow-lg z-20">
                    <span className="font-bold">{agent.name}</span>
                    <span className="text-cyan-400">{agent.price}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>RADAR: 3 Active Seller Nodes Locked</span>
          </div>
        </div>

        {/* Right: Live Agent Node Telemetry Cards */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span>REGISTERED SELLER AGENTS</span>
            <span className="text-indigo-400">HTTP 402 READY</span>
          </div>

          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: agent.color }}
                />
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {agent.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {agent.role} • Sepolia Testnet
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {agent.price}
                </div>
                <div className="text-[9px] font-mono text-slate-500">
                  Per Call
                </div>
              </div>
            </div>
          ))}

          {/* Terminal Real-Time Status Stream */}
          <div className="mt-4 p-3 rounded-xl bg-[#060911] border border-slate-800/90 font-mono text-[11px] text-emerald-400 flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 animate-pulse" />
            <span className="truncate">&gt; {logs[activeLogIndex]}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
