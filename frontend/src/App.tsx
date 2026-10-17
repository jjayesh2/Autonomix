import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { SoundProvider, useSound } from './context/SoundContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';

// Global & Auth Pages
import { LandingPage } from './pages/LandingPage.js';
import { AuthPage } from './pages/AuthPage.js';
import { LiveExecutionPage } from './pages/LiveExecutionPage.js';
import { ResultsPage } from './pages/ResultsPage.js';
import { MarketplacePage } from './pages/MarketplacePage.js';
import { CreateTaskPage } from './pages/CreateTaskPage.js';
import { SubmitAgentPage } from './pages/SubmitAgentPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

// Shells
import { CustomerShell } from './components/CustomerShell.js';
import { DeveloperShell } from './components/DeveloperShell.js';
import { AdminShell } from './components/AdminShell.js';

// Role-Specific Pages
import { CustomerOverviewPage } from './pages/customer/CustomerOverviewPage.js';
import { CustomerTasksPage } from './pages/customer/CustomerTasksPage.js';
import { CustomerWalletPage } from './pages/customer/CustomerWalletPage.js';

import { DeveloperOverviewPage } from './pages/developer/DeveloperOverviewPage.js';
import { DeveloperAgentsPage } from './pages/developer/DeveloperAgentsPage.js';
import { DeveloperExecutionsPage } from './pages/developer/DeveloperExecutionsPage.js';
import { DeveloperEarningsPage } from './pages/developer/DeveloperEarningsPage.js';

import { AdminOverviewPage } from './pages/admin/AdminOverviewPage.js';
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage.js';
import { AdminUsersPage } from './pages/admin/AdminUsersPage.js';
import { AdminExecutionsPage } from './pages/admin/AdminExecutionsPage.js';

import { api } from './lib/api.js';
import { Code, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, role, isAuthenticated, loading } = useAuth();
  const { playClick, playSuccess, playError } = useSound();

  const [currentScreen, setCurrentScreen] = useState<string>('landing');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [devOrg, setDevOrg] = useState('');
  const [devReason, setDevReason] = useState('Publish high-availability intelligence agents');
  const [devRequestLoading, setDevRequestLoading] = useState(false);
  const [devRequestSuccess, setDevRequestSuccess] = useState(false);
  const [devRequestError, setDevRequestError] = useState<string | null>(null);

  // Initial startup entrance animation flag (only runs once on website launch)
  const [isInitialMount, setIsInitialMount] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialMount(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // If user signs in, navigate automatically to their role's overview if on landing/auth
  useEffect(() => {
    if (user && (currentScreen === 'landing' || currentScreen === 'auth')) {
      setCurrentScreen(`${user.role}_overview`);
    } else if (!user && currentScreen.includes('_')) {
      // Unauthenticated access to protected screen
      if (!['live_execution', 'results'].includes(currentScreen)) {
        setCurrentScreen('landing');
      }
    }
  }, [user]);

  const handleNavigate = (screen: string) => {
    // Role protection guard: prevent customers from accessing developer or admin views
    if (user) {
      if (user.role === 'customer' && (screen.startsWith('developer_') || screen.startsWith('admin_'))) {
        setCurrentScreen('customer_overview');
        return;
      }
      if (user.role === 'developer' && screen.startsWith('admin_')) {
        setCurrentScreen('developer_overview');
        return;
      }
    }

    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTaskCreated = (taskId: string) => {
    setActiveTaskId(taskId);
    setCurrentScreen('live_execution');
  };

  const handleSelectTask = (taskId: string) => {
    setActiveTaskId(taskId);
    setCurrentScreen('live_execution');
  };

  const handleSubmitDevRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    playClick();
    setDevRequestLoading(true);
    setDevRequestError(null);

    try {
      await api.requestDeveloperAccess({
        userId: user.id,
        organization: devOrg,
        reason: devReason,
      });
      playSuccess();
      setDevRequestSuccess(true);
      setTimeout(() => {
        setIsDevModalOpen(false);
        setDevRequestSuccess(false);
        // Force refresh user session if promoted
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      playError();
      setDevRequestError(err.message || 'Request submission failed.');
    } finally {
      setDevRequestLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col bg-[#08090C] text-[#F3F4F6] selection:bg-[#819BFF]/30 selection:text-white transition-colors duration-500 ${isInitialMount ? 'animate-entrance-bg' : ''}`}>
      <Navbar
        onNavigate={handleNavigate}
        onRequestDeveloperModal={() => setIsDevModalOpen(true)}
        isInitialMount={isInitialMount}
      />

      <main className="flex-1 flex flex-col">
        {/* Public Screens */}
        {currentScreen === 'landing' && <LandingPage onNavigate={handleNavigate} isInitialMount={isInitialMount} />}
        {currentScreen === 'auth' && <AuthPage onNavigate={handleNavigate} />}

        {/* Live Execution & Results Screens (Available to all roles when reviewing a task) */}
        {currentScreen === 'live_execution' && (
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 w-full animate-fade-in">
            <LiveExecutionPage taskId={activeTaskId} onNavigate={handleNavigate} />
          </div>
        )}

        {currentScreen === 'results' && (
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 w-full animate-fade-in">
            <ResultsPage taskId={activeTaskId} onNavigate={handleNavigate} />
          </div>
        )}

        {/* CUSTOMER ROLE SHELL & TABS */}
        {user?.role === 'customer' && !['landing', 'auth', 'live_execution', 'results'].includes(currentScreen) && (
          <CustomerShell currentTab={currentScreen} onTabChange={handleNavigate}>
            {currentScreen === 'customer_overview' && (
              <CustomerOverviewPage onNavigate={handleNavigate} onSelectTask={handleSelectTask} />
            )}
            {currentScreen === 'marketplace' && <MarketplacePage onNavigate={handleNavigate} />}
            {currentScreen === 'create_task' && (
              <CreateTaskPage onNavigate={handleNavigate} onTaskCreated={handleTaskCreated} />
            )}
            {currentScreen === 'customer_tasks' && (
              <CustomerTasksPage onNavigate={handleNavigate} onSelectTask={handleSelectTask} />
            )}
            {currentScreen === 'customer_wallet' && <CustomerWalletPage onNavigate={handleNavigate} />}
            {currentScreen === 'customer_settings' && <SettingsPage onNavigate={handleNavigate} />}
          </CustomerShell>
        )}

        {/* DEVELOPER ROLE SHELL & TABS */}
        {user?.role === 'developer' && !['landing', 'auth', 'live_execution', 'results'].includes(currentScreen) && (
          <DeveloperShell currentTab={currentScreen} onTabChange={handleNavigate}>
            {currentScreen === 'developer_overview' && <DeveloperOverviewPage onNavigate={handleNavigate} />}
            {currentScreen === 'developer_agents' && <DeveloperAgentsPage onNavigate={handleNavigate} />}
            {currentScreen === 'submit_agent' && <SubmitAgentPage onNavigate={handleNavigate} />}
            {currentScreen === 'developer_executions' && <DeveloperExecutionsPage onNavigate={handleNavigate} />}
            {currentScreen === 'developer_earnings' && <DeveloperEarningsPage onNavigate={handleNavigate} />}
            {currentScreen === 'developer_wallet' && <CustomerWalletPage onNavigate={handleNavigate} />}
            {currentScreen === 'developer_settings' && <SettingsPage onNavigate={handleNavigate} />}
          </DeveloperShell>
        )}

        {/* ADMIN ROLE SHELL & TABS */}
        {user?.role === 'admin' && !['landing', 'auth', 'live_execution', 'results'].includes(currentScreen) && (
          <AdminShell currentTab={currentScreen} onTabChange={handleNavigate}>
            {currentScreen === 'admin_overview' && <AdminOverviewPage onNavigate={handleNavigate} />}
            {currentScreen === 'admin_reviews' && <AdminReviewsPage onNavigate={handleNavigate} />}
            {currentScreen === 'admin_agents' && <MarketplacePage onNavigate={handleNavigate} />}
            {currentScreen === 'admin_users' && <AdminUsersPage onNavigate={handleNavigate} />}
            {currentScreen === 'admin_monitoring' && <AdminExecutionsPage onNavigate={handleNavigate} />}
            {currentScreen === 'admin_transactions' && <CustomerWalletPage onNavigate={handleNavigate} />}
            {currentScreen === 'admin_audit_logs' && <AdminOverviewPage onNavigate={handleNavigate} />}
            {currentScreen === 'admin_settings' && <SettingsPage onNavigate={handleNavigate} />}
          </AdminShell>
        )}
      </main>

      {/* DEVELOPER ONBOARDING REQUEST MODAL */}
      {isDevModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-[#11141A] border border-white/[0.08] p-6 sm:p-8 space-y-6 shadow-card-elevated">
            <button
              onClick={() => setIsDevModalOpen(false)}
              className="absolute top-6 right-6 p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#171A22] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {devRequestSuccess ? (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Developer Access Granted!</h3>
                <p className="text-xs text-[#9CA3AF]">
                  Your account has been upgraded to Developer Studio. Refreshing workspace...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitDevRequest} className="space-y-4">
                <div className="flex items-center gap-2 text-[#819BFF] text-xs font-mono font-bold">
                  <Code className="w-4 h-4" />
                  <span>Developer Onboarding</span>
                </div>
                <h3 className="text-xl font-bold text-white">Request Developer Privileges</h3>
                <p className="text-xs text-[#9CA3AF]">
                  Developer accounts can register agent endpoints, configure HTTP 402 payment requirements, and collect 90% net seller revenue.
                </p>

                {devRequestError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{devRequestError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-semibold block">Organization / Team Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Autonomous AI Labs"
                    value={devOrg}
                    onChange={(e) => setDevOrg(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0F14] border border-white/[0.08] text-[#F3F4F6] placeholder:text-[#9CA3AF]/60 text-xs focus:outline-none focus:border-[#819BFF]/60 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-semibold block">Intended Services & Capabilities</label>
                  <textarea
                    rows={3}
                    value={devReason}
                    onChange={(e) => setDevReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0D0F14] border border-white/[0.08] text-[#F3F4F6] placeholder:text-[#9CA3AF]/60 text-xs focus:outline-none focus:border-[#819BFF]/60 transition-colors"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={devRequestLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-glow-accent transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {devRequestLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <span>Submit & Enable Developer Mode</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <SoundProvider>
        <AppContent />
      </SoundProvider>
    </AuthProvider>
  );
};

export default App;
