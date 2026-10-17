import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useSound } from '../context/SoundContext.js';
import {
  Code2,
  ShieldCheck,
  Coins,
  Send,
  Activity,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';

interface SubmitAgentPageProps {
  onNavigate: (screen: string) => void;
}

export const SubmitAgentPage: React.FC<SubmitAgentPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Data' | 'Inference' | 'Scraping'>('Data');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [priceUsdc, setPriceUsdc] = useState('0.02');
  const [recipientAddress, setRecipientAddress] = useState(user?.walletAddress || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
  const [capabilities, setCapabilities] = useState('financial_oracle, crypto_metrics, base_sepolia');
  const [inputSchemaText, setInputSchemaText] = useState(
    JSON.stringify(
      {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
      null,
      2
    )
  );
  const [outputSchemaText, setOutputSchemaText] = useState(
    JSON.stringify(
      {
        type: 'object',
        properties: {
          asset: { type: 'string' },
          price_usd: { type: 'number' },
        },
        required: ['asset', 'price_usd'],
      },
      null,
      2
    )
  );

  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [endpointTestResult, setEndpointTestResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTestEndpoint = async () => {
    if (!endpointUrl) return;
    playClick();
    setTestingEndpoint(true);
    setEndpointTestResult(null);

    try {
      const res = await api.testEndpoint(endpointUrl);
      setEndpointTestResult(res);
      if (res.healthy) playSuccess();
      else playError();
    } catch (err: any) {
      playError();
      setEndpointTestResult({ healthy: false, error: err.message });
    } finally {
      setTestingEndpoint(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    setSubmitting(true);
    setFeedback(null);

    try {
      let inputSchema = {};
      let outputSchema = {};
      try {
        inputSchema = JSON.parse(inputSchemaText);
        outputSchema = JSON.parse(outputSchemaText);
      } catch {
        throw new Error('Input or output schema is not valid JSON');
      }

      const capArray = capabilities
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const res = await api.submitAgent({
        developerId: user?.id,
        name,
        description,
        category,
        endpointUrl,
        priceUsdc: parseFloat(priceUsdc),
        recipientAddress,
        capabilities: capArray,
        inputSchema,
        outputSchema,
      });

      if (res.error) throw new Error(res.error);

      playSuccess();
      setFeedback({
        type: 'success',
        text: 'Agent submitted successfully! It is now pending admin review before appearing in the marketplace.',
      });

      setTimeout(() => {
        onNavigate('developer_dashboard');
      }, 1500);
    } catch (err: any) {
      playError();
      setFeedback({ type: 'error', text: err.message || 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back button */}
      <button
        onClick={() => {
          playClick();
          onNavigate('developer_dashboard');
        }}
        className="text-xs text-[#9CA3AF] hover:text-[#F3F4F6] flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Developer Studio
      </button>

      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-[#819BFF] text-xs font-mono mb-2 border border-indigo-500/20">
          <Code2 className="w-3.5 h-3.5" />
          <span>New Agent Onboarding</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#F3F4F6] tracking-tight">Submit Agent for Review</h1>
        <p className="text-xs text-[#9CA3AF] mt-1">
          Provide endpoint details, schemas, and payment recipient for admin verification.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-2.5 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] card-interactive space-y-6">
        {/* Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Agent Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. DeFi Yield Oracle"
              className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-[#F3F4F6] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#819BFF]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-[#F3F4F6] focus:outline-none focus:border-[#819BFF]"
            >
              <option value="Data">Data (Structured retrieval / feeds)</option>
              <option value="Inference">Inference (LLM reasoning / synthesis)</option>
              <option value="Scraping">Scraping (Sandboxed web extraction)</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
          <textarea
            rows={3}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what tasks this agent performs, reliability guarantees, and supported parameters..."
            className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl p-3 text-xs text-[#F3F4F6] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#819BFF]"
          />
        </div>

        {/* Endpoint URL & SSRF Test */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Service Endpoint URL (HTTP/HTTPS)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              required
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="http://localhost:5000/api/agents/data or https://api.yourservice.com/v1"
              className="flex-1 bg-[#0D0F14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-[#F3F4F6] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#819BFF] font-mono text-[11px]"
            />
            <button
              type="button"
              onClick={handleTestEndpoint}
              disabled={testingEndpoint || !endpointUrl}
              className="px-4 py-2.5 rounded-xl bg-[#171A22] hover:bg-[#1e222d] text-slate-200 text-xs font-semibold shrink-0 border border-white/[0.08] transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              {testingEndpoint ? 'Testing...' : 'Test Endpoint'}
            </button>
          </div>

          {endpointTestResult && (
            <div
              className={`mt-2 p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                endpointTestResult.healthy
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {endpointTestResult.healthy ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>
                {endpointTestResult.healthy
                  ? `Endpoint healthy! Status: ${endpointTestResult.statusCode} (~${endpointTestResult.latencyMs}ms)`
                  : `Endpoint check failed: ${endpointTestResult.error || 'Unreachable'}`}
              </span>
            </div>
          )}
        </div>

        {/* Pricing & Recipient Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Service Price (USDC / call)
            </label>
            <input
              type="number"
              step="0.005"
              min="0.005"
              max="0.50"
              required
              value={priceUsdc}
              onChange={(e) => setPriceUsdc(e.target.value)}
              className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-[#F3F4F6] font-mono focus:outline-none focus:border-[#819BFF]"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">Configurable cap: 0.50 USDC</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Payment Recipient Wallet (Base Sepolia)
            </label>
            <input
              type="text"
              required
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-[#F3F4F6] font-mono text-[11px] focus:outline-none focus:border-[#819BFF]"
            />
          </div>
        </div>

        {/* Capabilities */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Supported Capabilities (Comma-separated)
          </label>
          <input
            type="text"
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
            placeholder="market_feed, crypto_rates, normalized_json"
            className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-[#F3F4F6] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#819BFF] font-mono text-[11px]"
          />
        </div>

        {/* Schemas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Input JSON Schema
            </label>
            <textarea
              rows={6}
              value={inputSchemaText}
              onChange={(e) => setInputSchemaText(e.target.value)}
              className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl p-3 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-[#819BFF]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Output JSON Schema
            </label>
            <textarea
              rows={6}
              value={outputSchemaText}
              onChange={(e) => setOutputSchemaText(e.target.value)}
              className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl p-3 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-[#819BFF]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:opacity-95 text-[#F3F4F6] font-bold text-xs shadow-glow-blue transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{submitting ? 'Submitting to Admin Queue...' : 'Submit Agent for Admin Review'}</span>
        </button>
      </form>
    </div>
  );
};
