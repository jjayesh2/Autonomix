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
  isInitialMount?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, onRequestDeveloperModal, isInitialMount }) => {
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
    developer: { label: 'Developer', color: 'bg-[#819BFF]/10 text-[#819BFF] border-[#819BFF]/20' },
    admin: { label: 'Admin', color: 'bg-[#9B8AFF]/10 text-[#9B8AFF] border-[#9B8AFF]/20' },
  }[role];

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md bg-[#08090C]/90 border-b border-white/[0.08] px-4 lg:px-8 py-3 transition-all ${isInitialMount ? 'animate-entrance-nav' : ''}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          onClick={() => handleNav(user ? `${role}_overview` : 'landing')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-[#819BFF] to-[#9B8AFF] p-[1px] shadow-glow-blue">
            <div className="w-full h-full bg-[#11141A] rounded-xl flex items-center justify-center group-hover:bg-[#171A22] transition-colors border border-white/[0.06]">
              <Cpu className="w-5 h-5 text-[#819BFF] group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-[#F3F4F6] to-slate-400 bg-clip-text text-transparent">
                AUTONOMIX
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#819BFF]/10 text-[#819BFF] border border-[#819BFF]/20 font-semibold">
                x402 v2
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] tracking-wide font-medium">Pay-per-Call Agent Economy</p>
          </div>
        </div>

        {/* Center / Role Badge (Informational Only) */}
        {user && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D0F14] border border-white/[0.08] text-xs">
            <span className="text-[#9CA3AF] text-[11px]">Workspace:</span>
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
                ? 'bg-[#819BFF]/10 border-[#819BFF]/30 text-[#819BFF] hover:bg-[#819BFF]/20'
                : 'bg-[#11141A] border-white/[0.08] text-[#9CA3AF] hover:text-[#F3F4F6]'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Network Pill (Base Sepolia 84532) */}
          <div className="hidden lg:flex items-center gap-2 bg-[#0D0F14] border border-white/[0.08] px-3 py-1.5 rounded-xl text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[#F3F4F6]">Base Sepolia</span>
            <span className="text-slate-600">|</span>
            <span className="text-[#9CA3AF]">
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
                className="flex items-center gap-2 bg-[#11141A] hover:bg-[#171A22] text-[#F3F4F6] px-3 py-1.5 rounded-xl text-xs font-medium border border-white/[0.08] hover:border-white/[0.16] transition-all"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-indigo-600 to-[#819BFF] text-white flex items-center justify-center font-bold text-[10px]">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate">{user.displayName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated py-2 z-50 text-xs animate-fade-in">
                  <div className="px-4 py-2 border-b border-white/[0.08]">
                    <p className="text-white font-bold truncate">{user.displayName}</p>
                    <p className="text-[#9CA3AF] text-[11px] truncate font-mono">{user.email}</p>
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${roleBadgeConfig.color}`}>
                      {role} Account
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => handleNav(`${role}_settings`)}
                      className="w-full px-4 py-2 text-left text-[#F3F4F6] hover:bg-[#171A22] flex items-center gap-2 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      Settings & Preferences
                    </button>

                    {role === 'customer' && onRequestDeveloperModal && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          playClick();
                          onRequestDeveloperModal();
                        }}
                        className="w-full px-4 py-2 text-left text-[#819BFF] hover:bg-[#171A22] flex items-center gap-2 font-medium transition-colors"
                      >
                        <Code className="w-3.5 h-3.5" />
                        Request Developer Access
                      </button>
                    )}
                  </div>

                  <div className="border-t border-white/[0.08] pt-1">
                    <button
                      onClick={async () => {
                        playClick();
                        setUserDropdownOpen(false);
                        await logout();
                        onNavigate('auth');
                      }}
                      className="w-full px-4 py-2 text-left text-rose-400 hover:bg-[#171A22] flex items-center gap-2 transition-colors"
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
                className="text-xs bg-gradient-to-r from-indigo-600 to-[#819BFF] hover:from-indigo-500 hover:to-[#819BFF] text-white px-3.5 py-1.5 rounded-xl font-semibold shadow-glow-accent transition-all"
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
