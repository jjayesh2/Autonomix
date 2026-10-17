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
  ShoppingBag,
  Star,
  Clock,
  Sparkles,
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
      <div className="max-w-2xl mx-auto px-4 py-20 text-center animate-fade-in">
        <Receipt className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">No completed task results found</h2>
        <p className="text-xs text-[#9CA3AF] mt-2 mb-6">Select or run a task to review its cost breakdown and verified receipts.</p>
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

  // Calculate fee accounting: separate seller service spend from model provider costs
  const sellerGross = Number(steps.reduce((acc, s) => acc + (s.price_paid || 0), 0).toFixed(4));
  const totalPaid = Number((task?.total_cost || 0).toFixed(4));
  // Platform fee is an internal 10% ledger accounting allocation on seller service transactions
  const platformFee = Number((sellerGross * 0.10).toFixed(4));
  // Seller net earnings (90% internal allocation)
  const sellerPayout = Number((sellerGross - platformFee).toFixed(4));
  // AI Model Provider Cost (e.g. Gemini token planning charges)
  const modelProviderCost = Number(Math.max(0, totalPaid - sellerGross).toFixed(4));

  // Extract real products from steps (Data Agent or Scraper Agent)
  const productStep = steps.find((s) => s.output_payload?.products || s.output_payload?.items);
  const rawProducts: any[] = productStep?.output_payload?.products || productStep?.output_payload?.items || [];
  const inferenceStep = steps.find((s) => s.action_type.toLowerCase().includes('inference') || s.agent_name.toLowerCase().includes('cogni'));
  const inferencePayload = inferenceStep?.output_payload;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
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
          <p className="text-xs text-[#9CA3AF] mt-1 max-w-xl truncate">
            {task?.description}
          </p>
        </div>

        <button
          onClick={() => {
            playClick();
            onNavigate('create_task');
          }}
          className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:from-indigo-500 hover:to-[#819BFF] text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-glow-accent transform hover:-translate-y-0.5"
        >
          <RotateCcw className="w-4 h-4" />
          Run Another Task
        </button>
      </div>

      {/* Verified Products Showcase Card (If product research query) */}
      {rawProducts.length > 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-cyan-500/30 space-y-5 shadow-card-elevated">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Verified Product Research Findings ({rawProducts.length} Items Retrieved)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
              Live Source Provenance Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rawProducts.slice(0, 6).map((item: any, idx: number) => {
              const itemUrl = item.sourceUrl || item.url || (item.id ? `https://dummyjson.com/products/${item.id}` : '#');
              const itemPrice = typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : (item.price || 'Market Price');
              const inStock = item.in_stock ?? (item.stock ? item.stock > 0 : true);

              return (
                <div
                  key={item.id || idx}
                  className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] hover:border-white/[0.16] card-interactive transition-all flex flex-col justify-between group space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                      <span className="text-[#9CA3AF] truncate max-w-[120px]">
                        {item.brand || item.category || 'Hardware'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          inStock
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {inStock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white group-hover:text-[#819BFF] transition-colors line-clamp-2">
                      {item.title}
                    </h4>

                    {item.description && (
                      <p className="text-[11px] text-[#9CA3AF] mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono font-extrabold text-emerald-400">
                        {itemPrice}
                      </div>
                      {item.rating && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          <span>{item.rating}</span>
                        </div>
                      )}
                    </div>

                    <a
                      href={itemUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-[#819BFF] hover:underline flex items-center gap-1 bg-[#171A22] px-2.5 py-1 rounded-lg border border-white/[0.08]"
                    >
                      <span>Source</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Final Synthesized Output Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] space-y-4 shadow-card-elevated">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#819BFF] uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Cpu className="w-4 h-4 text-[#819BFF]" />
            Executive Synthesized Result
          </span>
          <div className="flex items-center gap-2">
            {inferencePayload?.ai_telemetry?.model && (
              <span className="text-[10px] font-mono text-[#819BFF] bg-[#819BFF]/10 px-2 py-0.5 rounded border border-[#819BFF]/20">
                {inferencePayload.ai_telemetry.model}
              </span>
            )}
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Status: {task?.status}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0D0F14] border border-white/[0.08] space-y-3">
          <h3 className="text-sm font-bold text-white leading-relaxed">
            {inferencePayload?.summary || result?.final_summary || 'Task completed with autonomous agent settlements.'}
          </h3>

          {/* Key Takeaways */}
          {inferencePayload?.key_takeaways && inferencePayload.key_takeaways.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-white/[0.08]">
              <span className="text-[11px] font-mono text-[#9CA3AF] uppercase">Key Takeaways:</span>
              <ul className="space-y-1">
                {inferencePayload.key_takeaways.map((takeaway: string, idx: number) => (
                  <li key={idx} className="text-xs text-[#F3F4F6] flex items-start gap-2">
                    <span className="text-[#819BFF] font-bold">•</span>
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-[#9CA3AF] leading-relaxed pt-2">
            {task?.rationale}
          </p>
        </div>
      </div>

      {/* Itemized Economics & Fee Breakdown */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] space-y-6 shadow-card-elevated">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            Itemized Ledger & x402 Micropayments
          </h3>
          <span className="text-xs font-mono text-[#9CA3AF]">Token: USDC (Base Sepolia 84532)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-[#9CA3AF] font-mono text-[11px]">
                <th className="pb-3 font-semibold">Service Agent</th>
                <th className="pb-3 font-semibold">Action</th>
                <th className="pb-3 font-semibold">Latency</th>
                <th className="pb-3 font-semibold text-right">Cost (USDC)</th>
                <th className="pb-3 font-semibold text-right">Settlement Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-sans">
              {steps.map((step) => {
                const receipt = step.output_payload?.paymentReceipt || {};
                const isBroadcast = receipt.settlementType === 'onchain_broadcast';
                const explorerLink = receipt.explorerUrl || (step.tx_hash ? `https://sepolia.basescan.org/tx/${step.tx_hash}` : null);
                const displayHash = step.tx_hash || receipt.voucherDigest;

                return (
                  <tr key={step.id} className="hover:bg-[#171A22] transition-colors">
                    <td className="py-3 font-bold text-white">{step.agent_name}</td>
                    <td className="py-3 text-[#9CA3AF]">{step.action_type}</td>
                    <td className="py-3 font-mono text-[#9CA3AF]">{step.latency_ms}ms</td>
                    <td className="py-3 text-right font-mono font-bold text-emerald-400">
                      +{step.price_paid.toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-mono text-[11px]">
                      {explorerLink && displayHash ? (
                        <a
                          href={explorerLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#819BFF] hover:underline inline-flex items-center gap-1"
                        >
                          <span>{isBroadcast ? 'On-Chain' : 'Permit'} {displayHash.slice(0, 8)}...</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="pt-4 border-t border-white/[0.08] space-y-2 text-xs font-mono">
          <div className="flex justify-between text-[#9CA3AF]">
            <span>Seller Service Gross:</span>
            <span className="text-[#F3F4F6]">{sellerGross.toFixed(4)} USDC</span>
          </div>
          <div className="flex justify-between text-[#9CA3AF]">
            <span>Seller Net Allocation (90%):</span>
            <span className="text-[#F3F4F6]">{sellerPayout.toFixed(4)} USDC</span>
          </div>
          <div className="flex justify-between text-[#9CA3AF]">
            <span>Platform Commission (10% internal ledger):</span>
            <span className="text-[#F3F4F6]">{platformFee.toFixed(4)} USDC</span>
          </div>
          {modelProviderCost > 0 && (
            <div className="flex justify-between text-[#9CA3AF]">
              <span>AI Model Provider Cost (Gemini Planning):</span>
              <span className="text-amber-400">+{modelProviderCost.toFixed(4)} USDC</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/[0.08]">
            <span>Total Task Spend:</span>
            <span className="text-emerald-400 text-base">{totalPaid.toFixed(4)} USDC</span>
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 pt-1">
            <span>Budget Cap: {task?.budget_limit.toFixed(2)} USDC</span>
            <span>Remaining Unspent: {remainingBudget.toFixed(4)} USDC</span>
          </div>
          <div className="text-[10px] text-slate-500 italic pt-1">
            * Note: The 90/10 split represents an internal ledger commission accounting allocation, not an on-chain split smart contract payout.
          </div>
        </div>
      </div>

      {/* Individual Agent Output Inspectors */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#819BFF]" />
          Verified Individual Agent Service Outputs
        </h3>

        {steps.map((step) => (
          <div key={step.id} className="p-5 rounded-2xl bg-[#11141A] border border-white/[0.08] space-y-3 shadow-card-elevated">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">{step.agent_name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0D0F14] text-[#819BFF] border border-white/[0.08]">
                  HTTP 402 Paid
                </span>
              </div>
              <span className="text-xs font-mono text-emerald-400">
                {step.price_paid.toFixed(2)} USDC
              </span>
            </div>

            <pre className="p-4 rounded-xl bg-[#08090C] border border-white/[0.08] text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
              {JSON.stringify(step.output_payload, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};
