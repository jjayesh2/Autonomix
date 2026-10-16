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
} from 'lucide-react';

interface LiveExecutionPageProps {
  taskId: string | null;
  onNavigate: (screen: string) => void;
}

export const LiveExecutionPage: React.FC<LiveExecutionPageProps> = ({ taskId, onNavigate }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [remainingBudget, setRemainingBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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
    // Poll every 1.5 seconds while task is active
    const interval = setInterval(fetchStatus, 1500);
    return () => clearInterval(interval);
  }, [taskId, prevCompletedCount, hasPlayedFinishTone]);

  if (!taskId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">No active task selected</h2>
        <p className="text-xs text-slate-400 mt-2 mb-6">Create a new task to view live execution and x402 payment settlements.</p>
        <button
          onClick={() => {
            playClick();
            onNavigate('create_task');
          }}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
        >
          Create Task
        </button>
      </div>
    );
  }

  const isFinished = task && ['completed', 'failed', 'partially_completed'].includes(task.status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-2 border border-cyan-500/20">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Autonomous Execution Trace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Live Task Orchestration
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl truncate">
            {task?.description || 'Executing task requirements...'}
          </p>
        </div>

        {isFinished && (
          <button
            onClick={() => {
              playClick();
              onNavigate('results');
            }}
            className="self-start sm:self-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-glow-accent transition-all flex items-center gap-2"
          >
            <span>View Full Results & Cost Breakdown</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0F1626] border border-slate-800">
          <span className="text-[11px] text-slate-500 block">Status:</span>
          <span
            className={`text-sm font-bold uppercase font-mono mt-1 block ${
              task?.status === 'completed'
                ? 'text-emerald-400'
                : task?.status === 'failed'
                ? 'text-rose-400'
                : 'text-cyan-400 animate-pulse'
            }`}
          >
            {task?.status || 'Planning'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1626] border border-slate-800">
          <span className="text-[11px] text-slate-500 block">Budget Cap:</span>
          <span className="text-sm font-bold font-mono text-white mt-1 block">
            {task?.budget_limit ? task.budget_limit.toFixed(2) : '0.10'} USDC
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1626] border border-slate-800">
          <span className="text-[11px] text-slate-500 block">Committed Spend:</span>
          <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block">
            {task?.total_cost ? task.total_cost.toFixed(2) : '0.00'} USDC
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1626] border border-slate-800">
          <span className="text-[11px] text-slate-500 block">Remaining Budget:</span>
          <span className="text-sm font-bold font-mono text-slate-300 mt-1 block">
            {remainingBudget.toFixed(2)} USDC
          </span>
        </div>
      </div>

      {/* Execution Timeline (Section 6 requirements) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          Autonomous Execution Timeline & x402 Micropayments
        </h3>

        {/* 9-Stage Architecture Overview */}
        <div className="space-y-4">
          {/* Step 1 & 2: Initiation & Planning */}
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="pt-1">
              <h4 className="text-xs font-bold text-white">Stage 1: Requirements Ingested & Plan Formulated</h4>
              <p className="text-xs text-slate-400 mt-0.5">{task?.rationale || 'Analyzing natural language requirements and discovering approved agents...'}</p>
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
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 animate-pulse'
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

              <div className="flex-1 p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      Step {step.step_number}: {step.agent_name}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {step.action_type}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-emerald-400">
                    +{step.price_paid.toFixed(2)} USDC
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1 font-mono">
                  <span>Latency: ~{step.latency_ms}ms</span>
                  <span>|</span>
                  <span>Payment: HTTP 402 Verified</span>
                  {step.tx_hash && (
                    <>
                      <span>|</span>
                      <a
                        href={`https://sepolia.basescan.org/tx/${step.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        Tx: {step.tx_hash.slice(0, 10)}... <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </div>

                {step.output_payload && (
                  <details className="mt-2 text-[11px]">
                    <summary className="cursor-pointer text-indigo-400 hover:underline">
                      View Verified JSON Output
                    </summary>
                    <pre className="mt-2 p-3 rounded-xl bg-[#080C14] border border-slate-800 text-slate-300 overflow-x-auto font-mono text-[10px]">
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
                <h4 className="text-xs font-bold text-white">Stage 9: Task Results Formatted & Budget Reconciled</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  All service outputs have been verified against output schemas and combined into the final brief.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
