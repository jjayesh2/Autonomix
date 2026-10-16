import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useSound } from '../context/SoundContext.js';
import {
  Cpu,
  Volume2,
  VolumeX,
  LogOut,
  User,
  Shield,
  Code,
  Sparkles,
  ChevronDown,
  Settings,
  HelpCircle,
} from 'lucide-react';

interface NavbarProps {
  onNavigate: (screen: string) => void;
  onRequestDeveloperModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, onRequestDeveloperModal }) => {
  const { user, role, logout } = useAuth();
  const { soundEnabled, toggleSound, playClick } = useSound();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleNav = (screen: string) => {
    playClick();
    setUserDropdownOpen(false);
    onNavigate(screen);
  };

  const roleBadgeConfig = {
    customer: { label: 'Customer', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
    developer: { label: 'Developer', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    admin: { label: 'Admin', color: 'bg-violet-500/10 text-violet-300 border-violet-500/20' },
  }[role];

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-[#080C14]/90 border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          onClick={() => handleNav(user ? `${role}_overview` : 'landing')}
          className="flex items-center gap-3 cursor-pointer group select-none"
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

        {/* Center / Role Badge (Informational Only - NO DROPDOWN TO CHANGE IDENTITY) */}
        {user && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px]">Workspace:</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase border ${roleBadgeConfig.color}`}>
              {roleBadgeConfig.label}
            </span>
          </div>
        )}

        {/* Right Actions: Sound Toggle, Base Sepolia Network, Account Dropdown */}
        <div className="flex items-center gap-3">
          {/* Sound Toggle (Web Audio tones - No Voice) */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Notification tones enabled (click to mute)' : 'Notification tones muted (click to enable)'}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              soundEnabled
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Network Pill (Base Sepolia 84532) */}
          <div className="hidden lg:flex items-center gap-2 bg-slate-900/70 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">Base Sepolia</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              {user?.walletAddress ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}` : '0x90F...b906'}
            </span>
          </div>

          {/* User Account / Dropdown */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => {
                  playClick();
                  setUserDropdownOpen(!userDropdownOpen);
                }}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-700/80 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate">{user.displayName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0F1626] border border-slate-800 shadow-2xl py-2 z-50 text-xs">
                  <div className="px-4 py-2 border-b border-slate-800">
                    <p className="text-white font-bold truncate">{user.displayName}</p>
                    <p className="text-slate-400 text-[11px] truncate font-mono">{user.email}</p>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${roleBadgeConfig.color}`}>
                      {role} Account
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => handleNav(`${role}_settings`)}
                      className="w-full px-4 py-2 text-left text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      Settings & Preferences
                    </button>

                    {role === 'customer' && onRequestDeveloperModal && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          playClick();
                          onRequestDeveloperModal();
                        }}
                        className="w-full px-4 py-2 text-left text-indigo-400 hover:bg-slate-800 flex items-center gap-2 font-medium"
                      >
                        <Code className="w-3.5 h-3.5" />
                        Request Developer Access
                      </button>
                    )}
                  </div>

                  <div className="border-t border-slate-800 pt-1">
                    <button
                      onClick={async () => {
                        playClick();
                        setUserDropdownOpen(false);
                        await logout();
                        onNavigate('auth');
                      }}
                      className="w-full px-4 py-2 text-left text-rose-400 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleNav('auth')}
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl font-semibold shadow-glow-accent transition-all"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
