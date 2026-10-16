import React, { useState, useEffect } from 'react';
import { api, Task, TaskStep, Transaction } from '../lib/api.js';
import { useSound } from '../context/SoundContext.js';
import {
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ExternalLink,
  Coins,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface ResultsPageProps {
  taskId: string | null;
  onNavigate: (screen: string) => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ taskId, onNavigate }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [result, setResult] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [remainingBudget, setRemainingBudget] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const { playClick } = useSound();

  useEffect(() => {
    if (!taskId) return;
    api.getTask(taskId).then((data) => {
      if (data.task) {
        setTask(data.task);
        setSteps(data.steps || []);
        setResult(data.result);
        setTransactions(data.transactions || []);
        setRemainingBudget(data.remainingBudget ?? 0);
      }
      setLoading(false);
    });
  }, [taskId]);

  if (!taskId || (!loading && !task)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">No completed task results found</h2>
        <p className="text-xs text-slate-400 mt-2 mb-6">Select or run a task to review its cost breakdown and verified receipts.</p>
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

  // Calculate platform fee vs seller payout
  const totalPaid = task?.total_cost || 0;
  const platformFee = Number((totalPaid * 0.10).toFixed(4));
  const sellerPayout = Number((totalPaid - platformFee).toFixed(4));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-2 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Task Execution Complete & Ledger Reconciled</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Results & Verified Cost Breakdown
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl truncate">
            {task?.description}
          </p>
        </div>

        <button
          onClick={() => {
            playClick();
            onNavigate('create_task');
          }}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Run Another Task
        </button>
      </div>

      {/* Final Synthesized Output Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Executive Synthesized Result
          </span>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Status: {task?.status}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-white">
            {result?.final_summary || 'Task completed with autonomous agent settlements.'}
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {task?.rationale}
          </p>
        </div>
      </div>

      {/* Itemized Economics & Fee Breakdown */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            Itemized Ledger & x402 Micropayments
          </h3>
          <span className="text-xs font-mono text-slate-400">Token: USDC (Base Sepolia)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="pb-3 font-semibold">Service Agent</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Action</th>
                <th className="pb-3 font-semibold">Latency</th>
                <th className="pb-3 font-semibold text-right">Cost (USDC)</th>
                <th className="pb-3 font-semibold text-right">On-Chain Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {steps.map((step) => (
                <tr key={step.id} className="hover:bg-slate-900/40">
                  <td className="py-3 font-bold text-white">{step.agent_name}</td>
                  <td className="py-3 text-slate-400">{step.action_type}</td>
                  <td className="py-3 font-mono text-slate-300">{step.status}</td>
                  <td className="py-3 font-mono text-slate-400">{step.latency_ms}ms</td>
                  <td className="py-3 text-right font-mono font-bold text-emerald-400">
                    +{step.price_paid.toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono text-[11px]">
                    {step.tx_hash ? (
                      <a
                        href={`https://sepolia.basescan.org/tx/${step.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                      >
                        {step.tx_hash.slice(0, 8)}... <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Seller Net Payout (90%):</span>
            <span className="text-slate-200">{sellerPayout.toFixed(4)} USDC</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Platform Commission (10%):</span>
            <span className="text-slate-200">{platformFee.toFixed(4)} USDC</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
            <span>Total Amount Paid:</span>
            <span className="text-emerald-400 text-base">{totalPaid.toFixed(4)} USDC</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 pt-1">
            <span>Budget Cap: {task?.budget_limit.toFixed(2)} USDC</span>
            <span>Remaining Unspent: {remainingBudget.toFixed(4)} USDC</span>
          </div>
        </div>
      </div>

      {/* Individual Agent Output Inspectors */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          Verified Individual Agent Service Outputs
        </h3>

        {steps.map((step) => (
          <div key={step.id} className="p-5 rounded-2xl bg-[#0F1626] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{step.agent_name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-800">
                  HTTP 402 Paid
                </span>
              </div>
              <span className="text-xs font-mono text-emerald-400">
                {step.price_paid.toFixed(2)} USDC
              </span>
            </div>

            <pre className="p-4 rounded-xl bg-[#080C14] border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              {JSON.stringify(step.output_payload, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};
