import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext.js';
import { SoundProvider } from './context/SoundContext.js';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';

import { LandingPage } from './pages/LandingPage.js';
import { AuthPage } from './pages/AuthPage.js';
import { MarketplacePage } from './pages/MarketplacePage.js';
import { CreateTaskPage } from './pages/CreateTaskPage.js';
import { LiveExecutionPage } from './pages/LiveExecutionPage.js';
import { ResultsPage } from './pages/ResultsPage.js';
import { DeveloperDashboardPage } from './pages/DeveloperDashboardPage.js';
import { SubmitAgentPage } from './pages/SubmitAgentPage.js';
import { AdminDashboardPage } from './pages/AdminDashboardPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<string>('landing');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTaskCreated = (taskId: string) => {
    setActiveTaskId(taskId);
    setCurrentScreen('live_execution');
  };

  return (
    <AuthProvider>
      <SoundProvider>
        <div className="min-h-screen flex flex-col bg-[#080C14] text-slate-100 selection:bg-indigo-500 selection:text-white">
          <Navbar currentScreen={currentScreen} onNavigate={handleNavigate} />

          <main className="flex-1">
            {currentScreen === 'landing' && <LandingPage onNavigate={handleNavigate} />}
            {currentScreen === 'auth' && <AuthPage onNavigate={handleNavigate} />}
            {currentScreen === 'marketplace' && <MarketplacePage onNavigate={handleNavigate} />}
            {currentScreen === 'create_task' && (
              <CreateTaskPage onNavigate={handleNavigate} onTaskCreated={handleTaskCreated} />
            )}
            {currentScreen === 'live_execution' && (
              <LiveExecutionPage taskId={activeTaskId} onNavigate={handleNavigate} />
            )}
            {currentScreen === 'results' && (
              <ResultsPage taskId={activeTaskId} onNavigate={handleNavigate} />
            )}
            {currentScreen === 'developer_dashboard' && (
              <DeveloperDashboardPage onNavigate={handleNavigate} />
            )}
            {currentScreen === 'submit_agent' && (
              <SubmitAgentPage onNavigate={handleNavigate} />
            )}
            {currentScreen === 'admin_dashboard' && (
              <AdminDashboardPage onNavigate={handleNavigate} />
            )}
            {currentScreen === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
          </main>

          <Footer />
        </div>
      </SoundProvider>
    </AuthProvider>
  );
};

export default App;
