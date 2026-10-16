import React from 'react';
import { useSound } from '../context/SoundContext.js';
import {
  LayoutDashboard,
  Code2,
  PlusCircle,
  Activity,
  Coins,
  Wallet,
  Settings,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface DeveloperShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const DeveloperShell: React.FC<DeveloperShellProps> = ({ currentTab, onTabChange, children }) => {
  const { playClick } = useSound();

  const handleNav = (tab: string) => {
    playClick();
    onTabChange(tab);
  };

  const navItems = [
    { id: 'developer_overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'developer_agents', label: 'My Agents', icon: Code2 },
    { id: 'submit_agent', label: 'Submit New Agent', icon: PlusCircle },
    { id: 'developer_executions', label: 'Agent Executions', icon: Activity },
    { id: 'developer_earnings', label: 'Earnings & Payouts', icon: Coins },
    { id: 'developer_wallet', label: 'Wallet & Payouts', icon: Wallet },
    { id: 'developer_settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 gap-8">
      {/* Sidebar for Developer */}
      <aside className="w-64 shrink-0 hidden md:block">
        <div className="sticky top-20 space-y-6">
          {/* User Mode Indicator */}
          <div className="p-4 rounded-2xl bg-[#0F1626] border border-slate-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-bold block mb-1">
              Developer Studio
            </span>
            <p className="text-xs text-slate-300 font-semibold">Agent Service Monetization</p>
            <p className="text-[11px] text-slate-500 mt-0.5">HTTP 402 Pay-per-Call Endpoints</p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-glow-accent'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white" />}
                </button>
              );
            })}
          </nav>

          {/* Developer Commission Info */}
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span>Seller Net Share</span>
              <span className="text-emerald-400 font-mono">90%</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 text-[10px]">
              <span>Platform Commission</span>
              <span className="font-mono">10%</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 min-w-0">{children}</section>
    </div>
  );
};
