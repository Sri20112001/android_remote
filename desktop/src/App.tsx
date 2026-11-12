import { useEffect, useState } from 'react';
import { useAppStore } from './stores/useAppStore';
import { HeaderBar } from './components/HeaderBar';
import { NavSidebar } from './components/NavSidebar';
import { SplashScreen } from './components/SplashScreen';
import { Dashboard } from './pages/Dashboard';
import { PairingHub } from './pages/PairingHub';
import { FileInbox } from './pages/FileInbox';
import { SettingsPage } from './pages/Settings';
import { wsService } from './services/websocketService';

export function App() {
  const { currentTab, refreshAgentStatus, fetchPairingData, addActivity } = useAppStore();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Initial fetch
    refreshAgentStatus();
    fetchPairingData();

    // Subscribe to WebSocket activity events
    const unsub = wsService.onActivity((event) => {
      addActivity(event);
    });

    // Background poll for agent status every 4 seconds
    const interval = setInterval(() => {
      refreshAgentStatus();
    }, 4000);

    return () => {
      unsub();
      clearInterval(interval);
      wsService.disconnect();
    };
  }, [refreshAgentStatus, fetchPairingData, addActivity]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden border border-obsidian-800 bg-obsidian-950 text-slate-100 select-none">
      {/* App Splash Screen on Launch */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      {/* Custom Window Header Bar */}
      <HeaderBar />

      {/* Main Workspace (Responsive) */}
      <div className="relative flex flex-1 overflow-hidden">
        <NavSidebar />

        <main className="relative z-10 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1180px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            {currentTab === 'dashboard' && <Dashboard />}
            {currentTab === 'pairing' && <PairingHub />}
            {currentTab === 'files' && <FileInbox />}
            {currentTab === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
