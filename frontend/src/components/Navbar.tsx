import React from 'react';
import { useAuth, UserRole } from '../context/AuthContext.js';
import { useSound } from '../context/SoundContext.js';
import {
  Cpu,
  ShoppingBag,
  PlusCircle,
  Code2,
  ShieldCheck,
  Receipt,
  Settings,
  Volume2,
  VolumeX,
  Wallet,
  UserCheck,
} from 'lucide-react';

interface NavbarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentScreen, onNavigate }) => {
  const { user, role, switchRole, logout } = useAuth();
  const { soundEnabled, toggleSound, playClick } = useSound();

  const handleNav = (screen: string) => {
    playClick();
    onNavigate(screen);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    playClick();
    switchRole(e.target.value as UserRole);
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#080C14]/85 border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          onClick={() => handleNav('landing')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-[1px] shadow-glow-violet">
            <div className="w-full h-full bg-[#080C14] rounded-xl flex items-center justify-center group-hover:bg-[#0D1527] transition-colors">
              <Cpu className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AUTONOMIX
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                x402 v2
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-wide font-medium">Pay-per-Call Agent Economy</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => handleNav('marketplace')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentScreen === 'marketplace'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Marketplace
          </button>

          <button
            onClick={() => handleNav('create_task')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentScreen === 'create_task'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Create Task
          </button>

          {(role === 'developer' || role === 'admin') && (
            <button
              onClick={() => handleNav('developer_dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentScreen === 'developer_dashboard' || currentScreen === 'submit_agent'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              Dev Studio
            </button>
          )}

          {role === 'admin' && (
            <button
              onClick={() => handleNav('admin_dashboard')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentScreen === 'admin_dashboard'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-violet-300" />
              Admin Review
            </button>
          )}

          <button
            onClick={() => handleNav('settings')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentScreen === 'settings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </nav>

        {/* Right Actions: Role Selector, Sound Toggle, Wallet, Account */}
        <div className="flex items-center gap-3">
          {/* Quick Role Switcher (Ideal for hackathon evaluation) */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800 text-xs text-slate-300">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Role:</span>
            <select
              value={role}
              onChange={handleRoleChange}
              className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer capitalize text-indigo-400"
            >
              <option value="customer" className="bg-[#0F1626] text-slate-200">Customer</option>
              <option value="developer" className="bg-[#0F1626] text-slate-200">Developer</option>
              <option value="admin" className="bg-[#0F1626] text-slate-200">Admin</option>
            </select>
          </div>

          {/* Sound Toggle (Web Audio tones - No Voice) */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Notification tones enabled (click to mute)' : 'Notification tones muted (click to enable)'}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              soundEnabled
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Wallet / Network Pill */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-900/70 border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Base Sepolia</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">
              {user?.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : '0x90F...b906'}
            </span>
          </div>

          {/* Auth Button */}
          <button
            onClick={() => handleNav('auth')}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-medium transition-colors border border-slate-700"
          >
            {user ? user.displayName : 'Sign In'}
          </button>
        </div>
      </div>
    </header>
  );
};
