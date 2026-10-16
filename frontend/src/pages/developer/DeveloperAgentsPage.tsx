import React, { useState, useEffect } from 'react';
import { api, AgentSubmission } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  Code2,
  PlusCircle,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Zap,
  Play,
  Server,
  DollarSign,
} from 'lucide-react';

export const DeveloperAgentsPage: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [agents, setAgents] = useState<AgentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingEndpointId, setTestingEndpointId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ [agentId: string]: any }>({});

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await api.getDeveloperSubmissions(user?.id);
        setAgents(res.submissions || []);
      } catch (err) {
        console.error('Failed to load developer agents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, [user]);

  const handleTestEndpoint = async (agent: AgentSubmission) => {
    playClick();
    setTestingEndpointId(agent.id);
    setTestResult((prev) => ({ ...prev, [agent.id]: { testing: true } }));

    try {
      const res = await api.testEndpoint(agent.endpoint_url);
      setTestResult((prev) => ({
        ...prev,
        [agent.id]: {
          success: res.healthy,
          statusCode: res.statusCode,
          latencyMs: res.latencyMs,
          message: res.message || res.error,
        },
      }));
      if (res.healthy) playSuccess();
      else playError();
    } catch (err: any) {
      setTestResult((prev) => ({
        ...prev,
        [agent.id]: {
          success: false,
          message: err.message || 'Connection test failed',
        },
      }));
      playError();
    } finally {
      setTestingEndpointId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-mono mb-2 border border-indigo-500/20">
            <Server className="w-3.5 h-3.5" />
            <span>Hosted Agent Endpoints</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">My Agents</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your service agents, run health check diagnostics, and monitor real-time approval status.
          </p>
        </div>

        <button
          onClick={() => {
            playClick();
            onNavigate('submit_agent');
          }}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-glow-accent transition-all flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Submit New Agent</span>
        </button>
      </div>

      {/* Agents List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs">Loading developer agent inventory...</span>
        </div>
      ) : agents.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#0F1626] border border-slate-800 text-center space-y-4">
          <Server className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No agents deployed yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Submit your first AI service endpoint to start earning USDC micropayments via x402 v2 protocol.
          </p>
          <button
            onClick={() => {
              playClick();
              onNavigate('submit_agent');
            }}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
          >
            Submit an Agent
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => {
            const currentTest = testResult[agent.id];
            const isTesting = testingEndpointId === agent.id;

            return (
              <div
                key={agent.id}
                className="p-6 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-4 hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-lg font-bold text-white">{agent.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300">
                        {agent.category}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                          agent.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : agent.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : agent.status === 'suspended'
                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl">{agent.description}</p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={() => handleTestEndpoint(agent)}
                      disabled={isTesting}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {isTesting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                      <span>Test SSRF Health</span>
                    </button>
                    <button
                      onClick={() => {
                        playClick();
                        onNavigate('developer_executions');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 text-xs font-mono flex items-center gap-1.5 transition-all"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Traces</span>
                    </button>
                  </div>
                </div>

                {/* Health Check Feedback */}
                {currentTest && !currentTest.testing && (
                  <div
                    className={`p-3 rounded-2xl text-xs font-mono flex items-center justify-between border ${
                      currentTest.success
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {currentTest.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span>{currentTest.message}</span>
                    </div>
                    {currentTest.latencyMs && (
                      <span className="text-slate-400 text-[10px]">~{currentTest.latencyMs}ms</span>
                    )}
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Endpoint URL:</span>
                    <span className="font-mono text-slate-300 text-[11px] truncate block mt-0.5">
                      {agent.endpoint_url}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Pay-per-Call Price:</span>
                    <span className="font-mono text-emerald-400 font-bold block mt-0.5">
                      {agent.price_usdc.toFixed(2)} USDC
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Settlement Address (Base Sepolia):</span>
                    <a
                      href={`https://sepolia.basescan.org/address/${agent.recipient_address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-cyan-400 hover:underline inline-flex items-center gap-1 text-[11px] mt-0.5"
                    >
                      {agent.recipient_address.slice(0, 10)}... <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Capabilities */}
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {agent.capabilities.map((cap, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                )}

                {/* Rejection / Suspension Notice */}
                {agent.rejection_reason && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    <strong>Admin Notice:</strong> {agent.rejection_reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
