import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useSound } from '../context/SoundContext.js';
import { api, Transaction } from '../lib/api.js';
import {
  Settings,
  Volume2,
  VolumeX,
  Wallet,
  Network,
  Shield,
  Receipt,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Cpu,
  RefreshCw,
  LogOut,
} from 'lucide-react';

interface SettingsPageProps {
  onNavigate: (screen: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const { user, role, logout } = useAuth();
  const { soundEnabled, toggleSound, playClick, playSuccess, playError, playProgress } = useSound();

  const [health, setHealth] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [h, txs] = await Promise.all([api.getHealth(), api.getTransactions()]);
      setHealth(h);
      setTransactions(txs.transactions || []);
    } catch (err) {
      console.error('Failed to load settings diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-mono mb-2 border border-indigo-500/20">
            <Settings className="w-3.5 h-3.5" />
            <span>Account & Web3 Configuration</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Settings & Diagnostics</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage notification tones, inspect Base Sepolia network connection, and review all ledger settlements.
          </p>
        </div>

        <button
          onClick={loadData}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-800 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          Refresh Diagnostics
        </button>
      </div>

      {/* Profile & Role Management */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          User Profile & Security Access
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[11px]">User Account:</span>
            <span className="text-white font-bold text-sm block mt-1">{user?.email}</span>
            <span className="text-indigo-400 text-[10px] uppercase font-semibold mt-1 inline-block">
              Role: {user?.role}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-slate-500 block text-[11px]">Wallet Address (Public Only):</span>
            <span className="text-emerald-400 font-mono text-[11px] block mt-1 truncate">
              {user?.walletAddress || '0x90F79bf6EB2c4f870365E785982E1f101E93b906'}
            </span>
            <span className="text-slate-500 text-[10px] mt-1 block">
              Private keys are never exposed in UI or client bundles.
            </span>
          </div>
        </div>

        {/* Verified Server Role */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-300 font-semibold block">Active Security Role</span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Assigned and verified server-side via Supabase Auth & Row Level Security.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {role}
          </span>
        </div>
      </div>

      {/* Audio & Notification Preferences (Section 4 Compliance) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              Notification Sound Settings
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Short, pleasant Web Audio synthesizer tones for task milestones. Absolutely no voice or speech synthesis.
            </p>
          </div>

          <button
            onClick={toggleSound}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              soundEnabled
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-slate-900 border border-slate-800 text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Enabled' : 'Muted'}</span>
          </button>
        </div>

        {/* Audio test buttons */}
        <div>
          <span className="text-xs text-slate-400 block mb-2 font-medium">Test Notification Tones:</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={playClick}
              className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-800"
            >
              Action Click
            </button>
            <button
              onClick={playProgress}
              className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-800"
            >
              Progress Ping
            </button>
            <button
              onClick={playSuccess}
              className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 text-xs font-mono border border-slate-800"
            >
              Success Chime
            </button>
            <button
              onClick={playError}
              className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 text-xs font-mono border border-slate-800"
            >
              Error Blip
            </button>
          </div>
        </div>
      </div>

      {/* Network & Infrastructure Health */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          Base Sepolia & Database Health Diagnostics
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-slate-500 block text-[11px]">Database Engine:</span>
            <div className="flex items-center gap-2 text-white font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{health?.database?.provider || 'Supabase PostgreSQL'}</span>
            </div>
            <span className="text-slate-400 text-[10px] block">{health?.database?.mode}</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-slate-500 block text-[11px]">Web3 Network:</span>
            <div className="flex items-center gap-2 text-white font-semibold">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>Base Sepolia (Chain {health?.web3?.chainId || 84532})</span>
            </div>
            <span className="text-cyan-400 text-[10px] block truncate">
              USDC: {health?.web3?.usdcContract}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 col-span-1 sm:col-span-2">
            <span className="text-slate-500 block text-[11px]">x402 Signing Mode:</span>
            <div className="text-slate-300">{health?.web3?.signingMode}</div>
            <div className="text-slate-500 text-[11px]">
              Platform Commission: {health?.web3?.platformFeePercent}% to Treasury {health?.web3?.platformTreasury?.slice(0, 10)}...
            </div>
          </div>
        </div>
      </div>

      {/* Global Transaction Ledger */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0F1626] border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          Global x402 Micropayment Ledger
        </h3>

        {transactions.length === 0 ? (
          <p className="text-xs text-slate-400">No recorded on-chain settlements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-[11px]">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Explorer Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {transactions.slice(0, 8).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 text-slate-500 text-[10px]">
                      {new Date(tx.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 font-bold text-emerald-400">
                      {tx.amount_usdc.toFixed(2)} USDC
                    </td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400">
                        {tx.payment_status}
                      </span>
                    </td>
                    <td className="py-2.5 text-[11px]">
                      {tx.tx_hash ? (
                        <a
                          href={tx.explorer_url || `https://sepolia.basescan.org/tx/${tx.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                        >
                          {tx.tx_hash.slice(0, 10)}... <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="pt-4 flex justify-end">
        <button
          onClick={async () => {
            playClick();
            await logout();
            onNavigate('landing');
          }}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 border border-slate-800 text-xs font-medium flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out of Account
        </button>
      </div>
    </div>
  );
};
