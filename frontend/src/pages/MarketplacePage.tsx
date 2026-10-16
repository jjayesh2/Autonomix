import React, { useState, useEffect } from 'react';
import { api, Agent } from '../lib/api.js';
import { useSound } from '../context/SoundContext.js';
import {
  Search,
  Filter,
  ArrowUpDown,
  Cpu,
  Star,
  Clock,
  Coins,
  ShieldCheck,
  Code,
  X,
  ExternalLink,
  CheckCircle,
} from 'lucide-react';

interface MarketplacePageProps {
  onNavigate: (screen: string) => void;
  onSelectAgentForTask?: (agentName: string) => void;
}

export const MarketplacePage: React.FC<MarketplacePageProps> = ({ onNavigate, onSelectAgentForTask }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [activeModalAgent, setActiveModalAgent] = useState<Agent | null>(null);

  const { playClick } = useSound();

  const loadAgents = async () => {
    setLoading(true);
    try {
      const res = await api.getMarketplaceAgents({
        category: selectedCategory,
        search: searchQuery,
        sort: sortBy,
      });
      setAgents(res.agents || []);
    } catch (err) {
      console.error('Failed to load agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, [selectedCategory, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    loadAgents();
  };

  const openAgentModal = (agent: Agent) => {
    playClick();
    setActiveModalAgent(agent);
  };

  const categories = ['All', 'Data', 'Inference', 'Scraping'];

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-2 border border-cyan-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin-Verified Autonomous Agents</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Agent Marketplace</h1>
          <p className="text-xs text-slate-400 mt-1">
            Discover and purchase verified AI agent endpoints with HTTP 402 micro-settlements on Base Sepolia.
          </p>
        </div>

        <button
          onClick={() => {
            playClick();
            onNavigate('create_task');
          }}
          className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-glow-accent transition-all flex items-center gap-2"
        >
          <Cpu className="w-4 h-4" />
          Create Task with Agents
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="p-4 rounded-2xl bg-[#0F1626] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, skill, or keyword..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </form>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                playClick();
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={sortBy}
            onChange={(e) => {
              playClick();
              setSortBy(e.target.value);
            }}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="rating">Top Rated</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="latency">Fastest Latency</option>
            <option value="calls">Most Called</option>
          </select>
        </div>
      </div>

      {/* Agents Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-20 p-8 rounded-2xl bg-[#0F1626] border border-slate-800">
          <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No agents found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search criteria or reset filters to view all approved active agents.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => openAgentModal(agent)}
              className="p-6 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-indigo-500/50 hover:shadow-glow-accent transition-all cursor-pointer flex flex-col justify-between group"
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
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-sm font-bold">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{agent.price_usdc.toFixed(2)} USDC</span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {agent.name}
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-3">
                  {agent.description}
                </p>

                {/* Capabilities pills */}
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

              {/* Card Footer: Metrics */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1 font-mono text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{agent.metrics?.rating_average ? agent.metrics.rating_average.toFixed(1) : '5.0'}</span>
                  <span className="text-slate-500 text-[11px]">({agent.metrics?.total_calls || 100})</span>
                </div>

                <div className="flex items-center gap-1 font-mono text-slate-400 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>~{agent.metrics?.median_latency_ms || 220}ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Detail Modal */}
      {activeModalAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0F1626] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {activeModalAgent.category} Agent
                </span>
                <h2 className="text-xl font-bold text-white mt-1.5">{activeModalAgent.name}</h2>
                <p className="text-xs text-slate-400 mt-1">{activeModalAgent.description}</p>
              </div>
              <button
                onClick={() => setActiveModalAgent(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price & Endpoint Details */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">Price per Call:</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {activeModalAgent.price_usdc.toFixed(2)} USDC
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Settlement Token:</span>
                <span className="text-white font-mono font-medium">USDC (Base Sepolia)</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Recipient Wallet:</span>
                <span className="text-slate-300 font-mono text-[11px] truncate block">
                  {activeModalAgent.recipient_address}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Endpoint URL:</span>
                <span className="text-cyan-400 font-mono text-[11px] truncate block">
                  {activeModalAgent.endpoint_url}
                </span>
              </div>
            </div>

            {/* Input & Output Schemas */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-indigo-400" />
                  Input JSON Schema
                </h4>
                <pre className="p-3 rounded-xl bg-[#080C14] border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {JSON.stringify(activeModalAgent.input_schema, null, 2)}
                </pre>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Output JSON Schema
                </h4>
                <pre className="p-3 rounded-xl bg-[#080C14] border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                  {JSON.stringify(activeModalAgent.output_schema, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setActiveModalAgent(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setActiveModalAgent(null);
                  playClick();
                  onNavigate('create_task');
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-glow-accent"
              >
                Use in Task Orchestration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
