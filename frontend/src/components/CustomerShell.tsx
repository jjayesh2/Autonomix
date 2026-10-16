import React from 'react';
import { useSound } from '../context/SoundContext.js';
import {
  LayoutDashboard,
  ShoppingBag,
  PlusCircle,
  ListTodo,
  Wallet,
  Settings,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

interface CustomerShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const CustomerShell: React.FC<CustomerShellProps> = ({ currentTab, onTabChange, children }) => {
  const { playClick } = useSound();

  const handleNav = (tab: string) => {
    playClick();
    onTabChange(tab);
  };

  const navItems = [
    { id: 'customer_overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'marketplace', label: 'Agent Marketplace', icon: ShoppingBag },
    { id: 'create_task', label: 'Create Task', icon: PlusCircle },
    { id: 'customer_tasks', label: 'My Tasks', icon: ListTodo },
    { id: 'customer_wallet', label: 'Wallet & Billing', icon: Wallet },
    { id: 'customer_settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 gap-8">
      {/* Sidebar for Customer */}
      <aside className="w-64 shrink-0 hidden md:block">
        <div className="sticky top-20 space-y-6">
          {/* User Mode Indicator */}
          <div className="p-4 rounded-2xl bg-[#0F1626] border border-slate-800">
            <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-400 font-bold block mb-1">
              Customer Portal
            </span>
            <p className="text-xs text-slate-300 font-semibold">Buyer & Task Orchestration</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Pay-per-call on Base Sepolia</p>
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

          {/* Network Health Card */}
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Base Sepolia Testnet</span>
            </div>
            <div className="font-mono text-[10px] text-slate-500">Chain: 84532 (USDC)</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 min-w-0">{children}</section>
    </div>
  );
};
