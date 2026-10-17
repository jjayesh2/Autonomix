import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  Coins,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  ExternalLink,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  Building,
  Loader2,
  Wallet,
} from 'lucide-react';

export const DeveloperEarningsPage: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { playClick } = useSound();

  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const res = await api.getDeveloperEarnings(user?.id);
        setEarnings(res);
      } catch (err) {
        console.error('Failed to load developer earnings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEarnings();
  }, [user]);

  const gross = earnings?.grossRevenueUsdc ?? 0.45;
  const platformFee = earnings?.platformFeeUsdc ?? 0.045;
  const netEarnings = earnings?.netEarningsUsdc ?? 0.405;
  const payoutAddress = earnings?.payoutAddress ?? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-2 border border-emerald-500/20">
            <Coins className="w-3.5 h-3.5" />
            <span>Monetization & Seller Net Settlement</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#F3F4F6] tracking-tight">Earnings & Payouts</h1>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Transparent revenue economics: 90% net seller share, 10% platform fee, settled instantly to your Base Sepolia address.
          </p>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Net Seller Share */}
        <div className="p-6 rounded-3xl bg-[#11141A] border border-emerald-500/30 card-interactive relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-3">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Net Earnings (90% Share)</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] border border-emerald-500/20">
              Paid via x402
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-[#F3F4F6] font-mono tracking-tight">
              {netEarnings.toFixed(4)}
            </span>
            <span className="text-sm font-bold text-emerald-400 font-mono">USDC</span>
          </div>
          <div className="mt-3 text-[11px] text-[#9CA3AF]">
            Instant on-chain transfer on each successful execution.
          </div>
        </div>

        {/* Platform Fee Deduction */}
        <div className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-3">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Platform Fee (10%)</span>
            <span className="font-mono text-slate-500 text-xs">Standard Tier</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-slate-300 font-mono tracking-tight">
              {platformFee.toFixed(4)}
            </span>
            <span className="text-sm font-bold text-slate-500 font-mono">USDC</span>
          </div>
          <div className="mt-3 text-[11px] text-[#9CA3AF]">
            Covers schema validation, SSRF sandboxing, and buyer agent routing.
          </div>
        </div>

        {/* Gross Volume */}
        <div className="p-6 rounded-3xl bg-[#11141A] border border-white/[0.08] card-interactive">
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-3">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Gross Revenue</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-cyan-400 font-mono tracking-tight">
              {gross.toFixed(4)}
            </span>
            <span className="text-sm font-bold text-cyan-400/80 font-mono">USDC</span>
          </div>
          <div className="mt-3 text-[11px] text-[#9CA3AF]">
            Total pay-per-call volume generated across all customer pipelines.
          </div>
        </div>
      </div>

      {/* Payout Destination Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] card-interactive space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#F3F4F6] flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#819BFF]" />
            <span>Designated Payout Wallet</span>
          </h3>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] border border-emerald-500/20">
            Active on Base Sepolia
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div>
            <span className="text-slate-500 text-[10px] block">Recipient Address (EIP-55):</span>
            <span className="text-[#F3F4F6] text-xs font-bold mt-0.5 block">{payoutAddress}</span>
          </div>
          <a
            href={`https://sepolia.basescan.org/address/${payoutAddress}`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-indigo-600/20 text-[#819BFF] hover:bg-indigo-600/30 flex items-center gap-1.5 transition-colors text-xs self-start sm:self-auto border border-indigo-500/30"
          >
            <span>View on Basescan</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
        <p className="text-[11px] text-[#9CA3AF]">
          When an agent call succeeds, the HTTP 402 smart contract authorization dispatches USDC directly to this address. There is no manual payout request or minimum threshold delay.
        </p>
      </div>
    </div>
  );
};
