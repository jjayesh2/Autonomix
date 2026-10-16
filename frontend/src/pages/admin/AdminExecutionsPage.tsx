import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { useSound } from '../../context/SoundContext.js';
import {
  Activity,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Lock,
} from 'lucide-react';

export const AdminExecutionsPage: React.FC<{ onNavigate: (screen: string) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { playClick } = useSound();

  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrace, setSelectedTrace] = useState<any | null>(null);

  const fetchExecutions = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminExecutions(statusFilter !== 'all' ? statusFilter : undefined);
      setExecutions(res.executions || []);
    } catch (err) {
      console.error('Failed to load admin executions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutions();
  }, [statusFilter]);

  const filtered = executions.filter((ex) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (ex.agent_name || '').toLowerCase().includes(q) ||
      (ex.task_id || '').toLowerCase().includes(q) ||
      (ex.action_type || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 text-xs font-mono mb-2 border border-violet-500/20">
            <Activity className="w-3.5 h-3.5" />
            <span>Platform-wide Autonomous Traces</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Execution Monitoring</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time observability into all agent calls, latencies, HTTP 402 settlement signatures, and schema verifications across the entire ecosystem.
          </p>
        </div>

        <button
          onClick={() => {
            playClick();
            fetchExecutions();
          }}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Traces</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-[#0F1626] border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search all executions by agent, task..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#080C14] border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-violet-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Payment Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              playClick();
              setStatusFilter(e.target.value);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#080C14] border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-violet-500"
          >
            <option value="all">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          <span className="text-xs">Fetching global execution traces...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#0F1626] border border-slate-800 text-center space-y-3">
          <Activity className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">No platform executions found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Execution telemetry will appear as customer tasks are orchestrated.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-[#0F1626] border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 font-mono border-b border-slate-800 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Agent Name</th>
                  <th className="py-3 px-4">Task ID</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Fee Paid</th>
                  <th className="py-3 px-4">x402 Status</th>
                  <th className="py-3 px-4">Ajv Schema</th>
                  <th className="py-3 px-4">Base Sepolia Tx</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((trace) => (
                  <tr key={trace.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {trace.agent_name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {trace.task_id.slice(0, 8)}...
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 text-[11px]">
                      {trace.action_type}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {trace.latency_ms} ms
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                      +{trace.price_paid.toFixed(2)} USDC
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                          trace.payment_status === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : trace.payment_status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {trace.payment_status === 'confirmed' && <CheckCircle2 className="w-3 h-3" />}
                        {trace.payment_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          trace.schema_valid
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {trace.schema_valid ? 'Pass ✓' : 'Fail ✕'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {trace.tx_hash ? (
                        <a
                          href={`https://sepolia.basescan.org/tx/${trace.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          {trace.tx_hash.slice(0, 8)}... <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          playClick();
                          setSelectedTrace(trace);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-violet-300 font-mono text-[10px] transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* INSPECTOR MODAL */}
      {selectedTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-[#0F1626] border border-violet-500/30 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-violet-400 block mb-1">
                  Global Execution Trace: {selectedTrace.id}
                </span>
                <h3 className="text-xl font-bold text-white">{selectedTrace.agent_name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Task ID: {selectedTrace.task_id} • Recorded: {new Date(selectedTrace.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedTrace(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] block">Latency:</span>
                <span className="text-white font-bold">{selectedTrace.latency_ms} ms</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Gross Price:</span>
                <span className="text-emerald-400 font-bold">{selectedTrace.price_paid.toFixed(2)} USDC</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Ajv Result:</span>
                <span className={selectedTrace.schema_valid ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {selectedTrace.schema_valid ? 'Pass (Valid)' : 'Schema Error'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Input Payload:</span>
              <pre className="p-3.5 rounded-xl bg-[#080C14] border border-slate-800 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-40">
                {JSON.stringify(selectedTrace.input_payload || {}, null, 2)}
              </pre>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300">Output Payload:</span>
              <pre className="p-3.5 rounded-xl bg-[#080C14] border border-slate-800 text-emerald-300 font-mono text-[10px] overflow-x-auto max-h-48">
                {JSON.stringify(selectedTrace.output_payload || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
