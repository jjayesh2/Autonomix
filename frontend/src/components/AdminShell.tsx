import React from 'react';
import { useSound } from '../context/SoundContext.js';
import {
  LayoutDashboard,
  ShieldCheck,
  Server,
  Users,
  Receipt,
  Activity,
  History,
  Settings,
  ChevronRight,
  Lock,
} from 'lucide-react';

interface AdminShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({ currentTab, onTabChange, children }) => {
  const { playClick } = useSound();

  const handleNav = (tab: string) => {
    playClick();
    onTabChange(tab);
  };

  const navItems = [
    { id: 'admin_overview', label: 'Admin Overview', icon: LayoutDashboard },
    { id: 'admin_reviews', label: 'Review Queue', icon: ShieldCheck },
    { id: 'admin_agents', label: 'All Agents Directory', icon: Server },
    { id: 'admin_users', label: 'Users & Roles', icon: Users },
    { id: 'admin_transactions', label: 'Transactions', icon: Receipt },
    { id: 'admin_monitoring', label: 'Execution Monitoring', icon: Activity },
    { id: 'admin_audit_logs', label: 'Security & Audit', icon: History },
    { id: 'admin_settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 gap-8">
      {/* Sidebar for Admin */}
      <aside className="w-64 shrink-0 hidden md:block">
        <div className="sticky top-20 space-y-6">
          {/* User Mode Indicator */}
          <div className="p-4 rounded-2xl bg-[#11141A] border border-white/[0.08] shadow-card-elevated">
            <span className="text-[10px] uppercase font-mono tracking-wider text-[#9B8AFF] font-bold block mb-1">
              Admin Console
            </span>
            <p className="text-xs text-[#F3F4F6] font-semibold">Governance & Safety</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Platform Auditing & Approvals</p>
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
                      ? 'bg-[#171A22] text-white border-l-2 border-[#9B8AFF] shadow-sm'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171A22]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#9B8AFF]' : 'text-[#9CA3AF]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#9B8AFF]" />}
                </button>
              );
            })}
          </nav>

          {/* Security Status Box */}
          <div className="p-4 rounded-2xl bg-[#0D0F14] border border-white/[0.08] text-[11px] text-[#9CA3AF] space-y-1.5">
            <div className="flex items-center gap-2 text-[#9B8AFF] font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>Restricted Root Role</span>
            </div>
            <p className="text-[10px] text-slate-500">SSRF guards and replay nonce tracking active.</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-1 min-w-0">{children}</section>
    </div>
  );
};
