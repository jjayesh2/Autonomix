import React, { useState } from 'react';
import { useAuth, UserRole } from '../context/AuthContext.js';
import { useSound } from '../context/SoundContext.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';
import { Shield, Key, Mail, User, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuthPageProps {
  onNavigate: (screen: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onNavigate }) => {
  const { user, role, switchRole, login, logout } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(role);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    setStatusMessage(null);
    setLoading(true);

    try {
      if (isSupabaseConfigured && supabase) {
        if (mode === 'signup') {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { role: selectedRole } },
          });
          if (error) throw error;
          setStatusMessage({ type: 'success', text: 'Account created! Please check your email or proceed.' });
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          setStatusMessage({ type: 'success', text: 'Successfully authenticated with Supabase!' });
        }
      }

      await login(email || `${selectedRole}@autonomix.network`, selectedRole);
      playSuccess();
      setTimeout(() => {
        onNavigate('marketplace');
      }, 700);
    } catch (err: any) {
      playError();
      setStatusMessage({ type: 'error', text: err.message || 'Authentication failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (r: UserRole) => {
    playClick();
    switchRole(r);
    playSuccess();
    onNavigate(r === 'admin' ? 'admin_dashboard' : r === 'developer' ? 'developer_dashboard' : 'marketplace');
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="p-8 rounded-3xl bg-[#0F1626] border border-slate-800 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3">
            <Key className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {user ? 'Account Management' : mode === 'signin' ? 'Sign In to Autonomix' : 'Create an Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isSupabaseConfigured
              ? 'Connected to Supabase PostgreSQL Auth'
              : 'Development Sandbox Session Mode'}
          </p>
        </div>

        {statusMessage && (
          <div
            className={`mb-6 p-3 rounded-xl border flex items-center gap-2 text-xs ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {user ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="text-slate-400">Signed in as:</div>
              <div className="text-white font-bold text-sm">{user.email}</div>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-slate-500">Role:</span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold uppercase text-[10px]">
                  {user.role}
                </span>
              </div>
              <div className="text-slate-500 truncate">Wallet: {user.walletAddress}</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-medium">Switch Active Role:</div>
              <div className="grid grid-cols-3 gap-2">
                {(['customer', 'developer', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleQuickDemoLogin(r)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold capitalize border transition-all ${
                      role === r
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={async () => {
                playClick();
                await logout();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@autonomix.network"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Select Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="customer">Customer (Run Tasks & Pay Agents)</option>
                <option value="developer">Developer (Submit & Monetize Agents)</option>
                <option value="admin">Admin (Review & Approve Submissions)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-glow-accent transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
              >
                {mode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </div>

            {/* Quick Demo Role Picker for Judges */}
            <div className="pt-6 border-t border-slate-800/80">
              <p className="text-[11px] text-slate-400 text-center mb-3">
                Quick Hackathon Evaluation Switcher:
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('customer')}
                  className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-cyan-400 transition-colors"
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('developer')}
                  className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-indigo-400 transition-colors"
                >
                  Developer
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('admin')}
                  className="py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-violet-400 transition-colors"
                >
                  Admin
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
