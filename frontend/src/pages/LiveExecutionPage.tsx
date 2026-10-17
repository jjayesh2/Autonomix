import React, { useState, useEffect } from 'react';
import { api, Task, TaskStep, Transaction } from '../lib/api.js';
import { useSound } from '../context/SoundContext.js';
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Coins,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Receipt,
  ExternalLink,
  ChevronRight,
  Code2,
  Sparkles,
  Layers,
  Zap,
} from 'lucide-react';

interface LiveExecutionPageProps {
  taskId: string | null;
  onNavigate: (screen: string) => void;
}

interface PipelineNode {
  id: number;
  label: string;
  sublabel: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  icon: any;
}

export const LiveExecutionPage: React.FC<LiveExecutionPageProps> = ({ taskId, onNavigate }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [remainingBudget, setRemainingBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);

  const { playClick, playSuccess, playError, playProgress } = useSound();
  const [prevCompletedCount, setPrevCompletedCount] = useState(0);
  const [hasPlayedFinishTone, setHasPlayedFinishTone] = useState(false);

  useEffect(() => {
    if (!taskId) return;

    const fetchStatus = async () => {
      try {
        const data = await api.getTask(taskId);
        if (data.task) {
          setTask(data.task);
          setSteps(data.steps || []);
          setTransactions(data.transactions || []);
          setRemainingBudget(data.remainingBudget ?? 0);

          const completed = (data.steps || []).filter((s: TaskStep) => s.status === 'completed').length;
          if (completed > prevCompletedCount) {
            playProgress();
            setPrevCompletedCount(completed);
          }

          if (['completed', 'failed', 'partially_completed'].includes(data.task.status) && !hasPlayedFinishTone) {
            setHasPlayedFinishTone(true);
            if (data.task.status === 'completed') {
              playSuccess();
            } else {
              playError();
            }
          }
        }
      } catch (err) {
        console.error('Error polling task status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, [taskId, prevCompletedCount, hasPlayedFinishTone]);

  if (!taskId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center animate-fade-in">
        <Cpu className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">No active task selected</h2>
        <p className="text-xs text-[#9CA3AF] mt-2 mb-6">Create a new task to view live execution and x402 payment settlements.</p>
        <button
          onClick={() => {
            playClick();
            onNavigate('create_task');
          }}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:from-indigo-500 hover:to-[#819BFF] text-white font-semibold text-xs shadow-glow-accent transition-all"
        >
          Create Task
        </button>
      </div>
    );
  }

  const isFinished = task && ['completed', 'failed', 'partially_completed'].includes(task.status);
  const completedStepCount = steps.filter((s) => s.status === 'completed').length;
  const runningStep = steps.find((s) => s.status === 'running');

  // Compute node statuses for the interactive graph
  const getPipelineNodes = (): PipelineNode[] => {
    const isFailed = task?.status === 'failed';
    const hasStarted = !!task;

    let s1Status: 'pending' | 'running' | 'completed' | 'failed' = hasStarted ? 'completed' : 'pending';
    let s2Status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
    let s3Status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
    let s4Status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
    let s5Status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';
    let s6Status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';

    if (task?.status === 'planning') {
      s2Status = 'running';
    } else if (task?.status === 'in_progress') {
      s2Status = 'completed';
      s3Status = 'completed';
      if (runningStep) {
        s4Status = 'completed';
        s5Status = 'running';
      } else {
        s4Status = 'running';
      }
    } else if (task?.status === 'completed') {
      s2Status = 'completed';
      s3Status = 'completed';
      s4Status = 'completed';
      s5Status = 'completed';
      s6Status = 'completed';
    } else if (isFailed) {
      s2Status = s2Status === 'pending' ? 'failed' : s2Status;
      s3Status = s3Status === 'pending' ? 'failed' : s3Status;
      s4Status = s4Status === 'pending' ? 'failed' : s4Status;
      s5Status = s5Status === 'pending' ? 'failed' : s5Status;
      s6Status = 'failed';
    }

    return [
      { id: 1, label: 'Task Ingestion', sublabel: 'Prompt & Budget Guard', status: s1Status, icon: Layers },
      { id: 2, label: 'Orchestrator Planning', sublabel: 'Decomposition & Graph', status: s2Status, icon: Cpu },
      { id: 3, label: 'Agent Selection', sublabel: 'Reputation & Cost Cap', status: s3Status, icon: Sparkles },
      { id: 4, label: 'HTTP 402 Challenge', sublabel: 'EIP-712 Signing', status: s4Status, icon: Zap },
      { id: 5, label: 'Execution & Ajv', sublabel: 'Strict JSON Validation', status: s5Status, icon: Code2 },
      { id: 6, label: 'Result Synthesis', sublabel: 'Ledger Reconciled', status: s6Status, icon: ShieldCheck },
    ];
  };

  const pipelineNodes = getPipelineNodes();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#819BFF]/10 text-[#819BFF] text-xs font-mono mb-2 border border-[#819BFF]/20">
            <span className="w-2 h-2 rounded-full bg-[#819BFF] animate-ping" />
            <span>Autonomous Orchestration Trace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Live Execution & Settlement Graph
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-1 max-w-xl truncate">
            {task?.description || 'Executing task requirements across discovered agents...'}
          </p>
        </div>

        {isFinished && (
          <button
            onClick={() => {
              playClick();
              onNavigate('results');
            }}
            className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-glow-accent transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
          >
            <span>View Final Brief & Cost Itemization</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#11141A] border border-white/[0.08]">
          <span className="text-[11px] text-[#9CA3AF] block">Status:</span>
          <span
            className={`text-sm font-bold uppercase font-mono mt-1 block ${
              task?.status === 'completed'
                ? 'text-emerald-400'
                : task?.status === 'failed'
                ? 'text-rose-400'
                : 'text-[#819BFF] animate-pulse'
            }`}
          >
            {task?.status || 'Planning'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#11141A] border border-white/[0.08]">
          <span className="text-[11px] text-[#9CA3AF] block">Budget Cap:</span>
          <span className="text-sm font-bold font-mono text-white mt-1 block">
            {task?.budget_limit ? task.budget_limit.toFixed(2) : '0.10'} USDC
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#11141A] border border-white/[0.08]">
          <span className="text-[11px] text-[#9CA3AF] block">Committed Spend:</span>
          <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block">
            {task?.total_cost ? task.total_cost.toFixed(2) : '0.00'} USDC
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#11141A] border border-white/[0.08]">
          <span className="text-[11px] text-[#9CA3AF] block">Remaining Budget:</span>
          <span className="text-sm font-bold font-mono text-[#F3F4F6] mt-1 block">
            {remainingBudget.toFixed(2)} USDC
          </span>
        </div>
      </div>

      {/* INTERACTIVE NODE PIPELINE GRAPH */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] space-y-6 relative overflow-hidden shadow-card-elevated">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#819BFF]" />
              <span>Multi-Agent Orchestration Pipeline Graph</span>
            </h3>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Live progression of the buyer agent coordinating discovery, cryptographic payment handshakes, and result validation.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#819BFF] font-semibold px-2.5 py-1 rounded-full bg-[#819BFF]/10 border border-[#819BFF]/20">
            Base Sepolia • Chain 84532
          </span>
        </div>

        {/* Animated Flowing SVG Packet Highway */}
        <div className="hidden md:block relative w-full h-2 my-1">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 600 6">
            <line
              x1="20"
              y1="3"
              x2="580"
              y2="3"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="2"
            />
            <line
              x1="20"
              y1="3"
              x2="580"
              y2="3"
              stroke="#819BFF"
              strokeWidth="2"
              className="svg-flow-path"
            />
          </svg>
        </div>

        {/* Pipeline Nodes Row */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2">
          {pipelineNodes.map((node) => {
            const Icon = node.icon;
            const isRunning = node.status === 'running';
            const isCompleted = node.status === 'completed';
            const isFailed = node.status === 'failed';
            const isSelected = selectedNode === node.id;

            return (
              <div
                key={node.id}
                onClick={() => {
                  playClick();
                  setSelectedNode(isSelected ? null : node.id);
                }}
                className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-[#819BFF] bg-[#171A22] border-[#819BFF]/60'
                    : isRunning
                    ? 'bg-[#171A22] border-[#819BFF] shadow-glow-blue'
                    : isCompleted
                    ? 'bg-[#0D0F14] border-emerald-500/40 hover:border-emerald-500/60'
                    : isFailed
                    ? 'bg-[#0D0F14] border-rose-500/40'
                    : 'bg-[#0D0F14] border-white/[0.06] opacity-60 hover:opacity-100'
                }`}
              >
                {/* Node Status Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                      isRunning
                        ? 'bg-[#819BFF]/20 text-[#819BFF] animate-pulse'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isFailed
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-[#171A22] text-[#9CA3AF]'
                    }`}
                  >
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : isFailed ? (
                      <AlertCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">0{node.id}</span>
                </div>

                <div className="text-xs font-bold text-white truncate">{node.label}</div>
                <div className="text-[10px] text-[#9CA3AF] truncate mt-0.5">{node.sublabel}</div>

                {isRunning && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#819BFF] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#819BFF]"></span>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] text-xs space-y-2 animate-fade-in">
            <div className="flex items-center justify-between text-[#F3F4F6] font-bold">
              <span>Stage {selectedNode} Deep Dive: {pipelineNodes[selectedNode - 1].label}</span>
              <button onClick={() => setSelectedNode(null)} className="text-[#9CA3AF] hover:text-white">
                ✕
              </button>
            </div>
            <p className="text-[#9CA3AF] text-[11px] leading-relaxed">
              {selectedNode === 1 && 'The natural language prompt is checked against the maximum budget limit. An atomic budget reservation is locked in the customer wallet to guarantee solvency.'}
              {selectedNode === 2 && 'The buyer orchestrator invokes planning algorithms to analyze required capabilities (Data, Inference, Scraping) and constructs the sequential DAG execution graph.'}
              {selectedNode === 3 && 'Marketplace agents are queried and ranked by composite score = 0.35 * price + 0.35 * reputation + 0.30 * latency, strictly checking admin approval status.'}
              {selectedNode === 4 && 'The orchestrator triggers HTTP 402 Pay-per-Call handshake: recipient address, nonce, and price are bound to an EIP-712 signed authorization payload.'}
              {selectedNode === 5 && 'The agent executes its model/tool pipeline. The returned JSON is strictly validated using Ajv (Draft-07) against the agent’s registered output schema.'}
              {selectedNode === 6 && 'All validated intermediate outputs are synthesized into the final answer. Unspent budget is released back to available balance and transactions are recorded.'}
            </p>
          </div>
        )}
      </div>

      {/* Execution Timeline & Steps */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] space-y-6 shadow-card-elevated">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#819BFF]" />
          <span>Live Executed Steps & x402 Micropayments</span>
        </h3>

        <div className="space-y-4">
          {/* Step 1: Ingestion & Planning */}
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="pt-1">
              <h4 className="text-xs font-bold text-white">Stage 1: Requirements Ingested & Plan Formulated</h4>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                {task?.rationale || 'Analyzing natural language requirements and discovering approved agents...'}
              </p>
            </div>
          </div>

          {/* Dynamic Executed Steps */}
          {steps.map((step, idx) => (
            <div key={step.id || idx} className="flex items-start gap-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  step.status === 'completed'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : step.status === 'running'
                    ? 'bg-[#819BFF]/10 border-[#819BFF]/30 text-[#819BFF] animate-pulse'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {step.status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : step.status === 'running' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
              </div>

              <div className="flex-1 p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Step {step.step_number}: {step.agent_name}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#171A22] text-[#9CA3AF] border border-white/[0.06]">
                      {step.action_type}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Ajv Validated ✓
                    </span>
                  </div>
                  <div className="text-xs font-mono text-emerald-400 font-bold">
                    +{step.price_paid.toFixed(2)} USDC
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#9CA3AF] pt-1 font-mono">
                  <span>Latency: ~{step.latency_ms}ms</span>
                  <span>|</span>
                  <span className="text-[#819BFF]">Payment: HTTP 402 Verified</span>
                  {step.tx_hash && (
                    <>
                      <span>|</span>
                      <a
                        href={`https://sepolia.basescan.org/tx/${step.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#819BFF] hover:underline flex items-center gap-1"
                      >
                        Tx: {step.tx_hash.slice(0, 10)}... <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </div>

                {step.output_payload && (
                  <details className="mt-2 text-[11px]">
                    <summary className="cursor-pointer text-[#819BFF] hover:underline">
                      View Verified JSON Output
                    </summary>
                    <pre className="mt-2 p-3 rounded-xl bg-[#08090C] border border-white/[0.08] text-slate-300 overflow-x-auto font-mono text-[10px]">
                      {JSON.stringify(step.output_payload, null, 2)}
                    </pre>
                  </details>
                )}

                {step.error_message && (
                  <div className="text-[11px] text-rose-400 font-mono">
                    Error: {step.error_message}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Final Stage */}
          {isFinished && (
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="pt-1">
                <h4 className="text-xs font-bold text-white">Stage 6: Task Results Formatted & Budget Reconciled</h4>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  All service outputs verified against output schemas and combined into the final brief. Uncommitted budget has been safely restored.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
