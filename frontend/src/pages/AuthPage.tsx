import React, { useState } from 'react';
import { useAuth, UserRole } from '../context/AuthContext.js';
import { useSound } from '../context/SoundContext.js';
import {
  Key,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Shield,
  User,
  Sparkles,
} from 'lucide-react';

interface AuthPageProps {
  onNavigate: (screen: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onNavigate }) => {
  const { login, register, loginWithGoogle, resetPassword, demoLogin } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showGoogleSetupModal, setShowGoogleSetupModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClick();
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await login(email, password);
        if (!res.success) throw new Error(res.error);
        playSuccess();
        setMessage({ type: 'success', text: 'Authentication successful! Redirecting to dashboard...' });
        setTimeout(() => onNavigate('customer_overview'), 600);
      } else if (mode === 'signup') {
        const res = await register(email, password, displayName);
        if (!res.success) throw new Error(res.error);
        playSuccess();
        setMessage({
          type: 'success',
          text: 'Account registered successfully as Customer! Redirecting to marketplace...',
        });
        setTimeout(() => onNavigate('customer_overview'), 600);
      } else if (mode === 'forgot') {
        const res = await resetPassword(email);
        if (!res.success) throw new Error(res.error);
        playSuccess();
        setMessage({
          type: 'success',
          text: 'Password recovery instructions sent to your email address.',
        });
      }
    } catch (err: any) {
      playError();
      setMessage({ type: 'error', text: err.message || 'Authentication operation failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    playClick();
    setMessage(null);
    setLoading(true);
    const res = await loginWithGoogle();
    setLoading(false);

    if (res.requiresSetup) {
      playError();
      setShowGoogleSetupModal(true);
      setMessage({ type: 'info', text: res.message || 'Google OAuth credentials setup required.' });
    } else if (!res.success) {
      playError();
      setMessage({ type: 'error', text: res.error || 'Google login failed' });
    }
  };

  const handleDemoSignIn = (role: UserRole) => {
    playClick();
    demoLogin(role);
    playSuccess();
    if (role === 'admin') onNavigate('admin_overview');
    else if (role === 'developer') onNavigate('developer_overview');
    else onNavigate('customer_overview');
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 animate-fade-in">
      <div className="w-full max-w-md p-8 rounded-3xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated relative">
        {/* Glow backdrop */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#819BFF]/15 blur-3xl -z-10 rounded-full" />

        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3">
            <Key className="w-6 h-6 text-[#819BFF]" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {mode === 'signin'
              ? 'Sign In to AgentPay'
              : mode === 'signup'
              ? 'Create Customer Account'
              : 'Reset Your Password'}
          </h2>
          <p className="text-xs text-[#9CA3AF] mt-1">
            {mode === 'signin'
              ? 'Access autonomous agent orchestration & x402 settlements'
              : mode === 'signup'
              ? 'Register to discover, purchase, and deploy AI services'
              : 'Enter your email to receive a secure password recovery link'}
          </p>
        </div>

        {/* Message Alert */}
        {message && (
          <div
            className={`mb-6 p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : message.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        {mode !== 'forgot' && (
          <div className="mb-6 space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#0D0F14] hover:bg-[#171A22] text-[#F3F4F6] border border-white/[0.08] hover:border-white/[0.16] font-semibold text-xs transition-all flex items-center justify-center gap-2.5 shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="h-[1px] flex-1 bg-white/[0.08]" />
              <span className="text-[11px] font-mono text-[#9CA3AF] uppercase">Or with email</span>
              <div className="h-[1px] flex-1 bg-white/[0.08]" />
            </div>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-[#F3F4F6] mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#F3F4F6] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#819BFF]/60 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#F3F4F6] mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="buyer@enterprise.com"
                className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#F3F4F6] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#819BFF]/60 transition-colors"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#F3F4F6]">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setMode('forgot');
                    }}
                    className="text-[11px] text-[#819BFF] hover:text-[#9B8AFF] transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0D0F14] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#F3F4F6] placeholder-[#9CA3AF]/60 focus:outline-none focus:border-[#819BFF]/60 transition-colors"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:from-indigo-500 hover:to-[#819BFF] text-white font-semibold text-xs shadow-glow-accent transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            <span>
              {loading
                ? 'Processing...'
                : mode === 'signin'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Create Customer Account'
                : 'Send Password Reset Link'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Toggle between Sign In / Sign Up / Forgot */}
        <div className="mt-6 text-center text-xs">
          {mode === 'signin' ? (
            <p className="text-[#9CA3AF]">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setMode('signup');
                  setMessage(null);
                }}
                className="text-[#819BFF] hover:text-[#9B8AFF] font-semibold transition-colors"
              >
                Sign Up as Customer
              </button>
            </p>
          ) : (
            <p className="text-[#9CA3AF]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setMode('signin');
                  setMessage(null);
                }}
                className="text-[#819BFF] hover:text-[#9B8AFF] font-semibold transition-colors"
              >
                Sign In
              </button>
            </p>
          )}
        </div>

        {/* Evaluation Demo Account Shortcuts */}
        <div className="mt-8 pt-6 border-t border-white/[0.08]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-[#9CA3AF]">Hackathon Test Accounts</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0D0F14] border border-white/[0.08] text-[#9CA3AF] font-mono">Demo</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleDemoSignIn('customer')}
              className="py-1.5 px-2 rounded-lg bg-[#0D0F14] hover:bg-[#171A22] border border-white/[0.08] text-[11px] font-mono text-cyan-400 transition-colors"
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => handleDemoSignIn('developer')}
              className="py-1.5 px-2 rounded-lg bg-[#0D0F14] hover:bg-[#171A22] border border-white/[0.08] text-[11px] font-mono text-[#819BFF] transition-colors"
            >
              Developer
            </button>
            <button
              type="button"
              onClick={() => handleDemoSignIn('admin')}
              className="py-1.5 px-2 rounded-lg bg-[#0D0F14] hover:bg-[#171A22] border border-white/[0.08] text-[11px] font-mono text-[#9B8AFF] transition-colors"
            >
              Admin
            </button>
          </div>
        </div>
      </div>

      {/* Google OAuth Setup Guide Modal */}
      {showGoogleSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#11141A] border border-white/[0.08] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-card-elevated">
            <div className="flex items-center gap-2 text-[#819BFF]">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white">Google OAuth Setup Instructions</h3>
            </div>
            <p className="text-xs text-[#F3F4F6] leading-relaxed">
              Google OAuth is fully wired through Supabase Auth. To enable it on your live deployment:
            </p>
            <ol className="list-decimal list-inside text-xs text-[#9CA3AF] space-y-2">
              <li>Open Google Cloud Console -&gt; APIs & Services -&gt; Credentials.</li>
              <li>Create an OAuth 2.0 Client ID with Authorized redirect URI: <code className="bg-[#0D0F14] px-1 py-0.5 rounded text-cyan-400 text-[11px] border border-white/[0.08]">https://&lt;project&gt;.supabase.co/auth/v1/callback</code>.</li>
              <li>In your Supabase Dashboard -&gt; Authentication -&gt; Providers -&gt; Google, paste your Client ID and Client Secret, then enable Google sign-in.</li>
            </ol>
            <div className="pt-4 border-t border-white/[0.08] flex justify-end">
              <button
                onClick={() => setShowGoogleSetupModal(false)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:from-indigo-500 hover:to-[#819BFF] text-white text-xs font-semibold shadow-glow-accent transition-all"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
