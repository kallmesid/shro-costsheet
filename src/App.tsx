import React, { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, Account, DropdownOptions, CostSheet } from './types.ts';
import { apiRequest } from './lib/api.ts';

import { LoginView } from './components/LoginView.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { CostSheetsList } from './components/CostSheetsList.tsx';
import { AccountsView } from './components/AccountsView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { AdminView } from './components/AdminView.tsx';
import { CostSheetModal } from './components/CostSheetModal.tsx';
import { SudoModal } from './components/SudoModal.tsx';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  // Real-time Socket & Notification state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Common master data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [salespeople, setSalespeople] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [approverCandidates, setApproverCandidates] = useState<{ [key: number]: User[] }>({});
  const [dropdowns, setDropdowns] = useState<DropdownOptions>({
    business_unit: ['Enterprise Solutions', 'Cloud & Data Center', 'Cybersecurity', 'Networking & Telecom', 'Managed Services'],
    oem: ['Cisco Systems', 'Fortinet', 'Dell Technologies', 'Hewlett Packard Enterprise', 'Palo Alto Networks', 'Microsoft', 'Check Point'],
    distributor: ['Ingram Micro', 'Redington India', 'Savex Technologies', 'Compuage Infocom'],
  });

  // Modal controllers
  const [selectedCostSheetId, setSelectedCostSheetId] = useState<number | null>(null);
  const [isNewSheetModalOpen, setIsNewSheetModalOpen] = useState(false);
  const [isSudoModalOpen, setIsSudoModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Check initial authentication
  const checkAuth = useCallback(async () => {
    try {
      const data = await apiRequest('/api/auth/me');
      setCurrentUser(data.user);
    } catch {
      localStorage.removeItem('shro_token');
      setCurrentUser(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load Master Data when authenticated
  const loadMasterData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [accs, drop, candidates] = await Promise.all([
        apiRequest('/api/accounts'),
        apiRequest('/api/config/dropdowns'),
        apiRequest('/api/users/approvers'),
      ]);

      setAccounts(accs);
      if (drop.grouped) {
        setDropdowns(drop.grouped);
      }
      setApproverCandidates(candidates);
      setSalespeople(candidates.sales || []);
      setAllUsers(candidates.all || []);
    } catch (err) {
      console.error('Failed to load master metadata:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Compute pending approvals count for current user
  const fetchPendingApprovals = useCallback(async () => {
    if (!currentUser) return;
    try {
      const sheets: CostSheet[] = await apiRequest('/api/cost-sheets');
      const count = sheets.filter(cs => {
        if (cs.status !== 'Pending') return false;
        const assigned = cs.assigned_approvers?.[cs.current_stage?.toString()];
        return assigned === currentUser.id || currentUser.access_level === 'Admin';
      }).length;
      setPendingApprovalsCount(count);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals, refreshTrigger]);

  // Socket.io Real-time connection setup
  useEffect(() => {
    if (!currentUser) return;

    const s = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    s.on('connect', () => {
      setSocketConnected(true);
      s.emit('join', { userId: currentUser.id, role: currentUser.role });
    });

    s.on('disconnect', () => {
      setSocketConnected(false);
    });

    s.on('workflow_update', () => {
      // Trigger background update across views
      setRefreshTrigger(prev => prev + 1);
    });

    s.on('notification', () => {
      setRefreshTrigger(prev => prev + 1);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [currentUser]);

  // Logout Handler
  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    localStorage.removeItem('shro_token');
    setCurrentUser(null);
  };

  // Sudo Login Handler
  const handleSudoLogin = async (targetUserId: number) => {
    try {
      const res = await apiRequest('/api/auth/sudo', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      if (res.token) {
        localStorage.setItem('shro_token', res.token);
      }
      setCurrentUser(res.user);
      setIsSudoModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert('Sudo failed: ' + err.message);
    }
  };

  // Exit Sudo Handler
  const handleExitSudo = async () => {
    try {
      const res = await apiRequest('/api/auth/exit-sudo', { method: 'POST' });
      if (res.token) {
        localStorage.setItem('shro_token', res.token);
      }
      setCurrentUser(res.user);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert('Failed to exit sudo: ' + err.message);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-400">Loading SHRO Systems Portal...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div id="app-root-layout" className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans text-slate-900">
      {/* Pop-up / Hidden-by-default Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        user={currentUser}
        onNewCostSheet={() => setIsNewSheetModalOpen(true)}
        pendingApprovalsCount={pendingApprovalsCount}
        isOpen={isSidebarOpen}
        isPinned={isSidebarPinned}
        onClose={() => setIsSidebarOpen(false)}
        onTogglePin={() => setIsSidebarPinned(prev => !prev)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Bar with Sync Status & Notification Bell */}
        <TopBar
          user={currentUser}
          socketConnected={socketConnected}
          pendingApprovalsCount={pendingApprovalsCount}
          onLogout={handleLogout}
          onExitSudo={handleExitSudo}
          onSelectCostSheet={(id) => setSelectedCostSheetId(id)}
          onOpenSudoModal={() => setIsSudoModalOpen(true)}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        {/* Dynamic Tab Body */}
        <main className="flex-1 overflow-y-auto bg-slate-100 pb-12">
          {currentTab === 'dashboard' && (
            <DashboardView
              key={refreshTrigger}
              onSelectCostSheet={(id) => setSelectedCostSheetId(id)}
              onNewCostSheet={() => setIsNewSheetModalOpen(true)}
              dropdowns={dropdowns}
              salespeople={salespeople}
              currentUser={currentUser}
              accounts={accounts}
            />
          )}

          {currentTab === 'cost_sheets' && (
            <CostSheetsList
              key={refreshTrigger}
              onSelectCostSheet={(id) => setSelectedCostSheetId(id)}
              onNewCostSheet={() => setIsNewSheetModalOpen(true)}
              currentUser={currentUser}
              dropdowns={dropdowns}
              salespeople={salespeople}
            />
          )}

          {currentTab === 'accounts' && (
            <AccountsView
              onSelectCostSheet={(id) => setSelectedCostSheetId(id)}
            />
          )}

          {currentTab === 'reports' && ['Admin', 'Management', 'TeamLead'].includes(currentUser.access_level) && (
            <ReportsView
              dropdowns={dropdowns}
              salespeople={salespeople}
              onSelectCostSheet={(id) => setSelectedCostSheetId(id)}
            />
          )}

          {currentTab === 'admin' && currentUser.access_level === 'Admin' && (
            <AdminView
              currentUser={currentUser}
              onSudoLogin={handleSudoLogin}
              onDropdownsUpdated={loadMasterData}
              dropdowns={dropdowns}
              initialTab="users"
            />
          )}

          {currentTab === 'email' && currentUser.access_level === 'Admin' && (
            <AdminView
              currentUser={currentUser}
              onSudoLogin={handleSudoLogin}
              onDropdownsUpdated={loadMasterData}
              dropdowns={dropdowns}
              initialTab="email"
            />
          )}

          {currentTab === 'backup' && currentUser.access_level === 'Admin' && (
            <AdminView
              currentUser={currentUser}
              onSudoLogin={handleSudoLogin}
              onDropdownsUpdated={loadMasterData}
              dropdowns={dropdowns}
              initialTab="backup"
            />
          )}
        </main>
      </div>

      {/* Cost Sheet Form / Detail Modal (Create or Edit) */}
      {(selectedCostSheetId !== null || isNewSheetModalOpen) && (
        <CostSheetModal
          costSheetId={selectedCostSheetId}
          onClose={() => {
            setSelectedCostSheetId(null);
            setIsNewSheetModalOpen(false);
          }}
          onSaved={() => {
            setSelectedCostSheetId(null);
            setIsNewSheetModalOpen(false);
            setRefreshTrigger(prev => prev + 1);
          }}
          currentUser={currentUser}
          accounts={accounts}
          salespeople={salespeople}
          dropdowns={dropdowns}
          approverCandidates={approverCandidates}
        />
      )}

      {/* Sudo Modal for Admin */}
      {isSudoModalOpen && (
        <SudoModal
          users={allUsers}
          currentUserId={currentUser.id}
          onSelectUser={handleSudoLogin}
          onClose={() => setIsSudoModalOpen(false)}
        />
      )}
    </div>
  );
}
