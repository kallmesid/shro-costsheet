import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Wifi, 
  WifiOff, 
  User as UserIcon, 
  LogOut, 
  ShieldCheck, 
  UserCheck, 
  Check, 
  FileText, 
  X,
  ChevronDown,
  Menu
} from 'lucide-react';
import { User, NotificationItem } from '../types.ts';
import { apiRequest } from '../lib/api.ts';

interface TopBarProps {
  user: User;
  socketConnected: boolean;
  pendingApprovalsCount: number;
  onLogout: () => void;
  onExitSudo: () => void;
  onSelectCostSheet: (id: number) => void;
  onOpenSudoModal: () => void;
  onToggleSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  socketConnected,
  pendingApprovalsCount,
  onLogout,
  onExitSudo,
  onSelectCostSheet,
  onOpenSudoModal,
  onToggleSidebar,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    setLoadingNotifications(true);
    try {
      const data = await apiRequest('/api/uploads/notifications');
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const handleToggleNotifications = () => {
    if (!showNotifications) {
      fetchNotifications();
    }
    setShowNotifications(!showNotifications);
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      try {
        await apiRequest(`/api/uploads/notifications/${notif.id}/read`, { method: 'POST' });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } catch (err) {
        console.error(err);
      }
    }
    setShowNotifications(false);
    if (notif.cost_sheet_id) {
      onSelectCostSheet(notif.cost_sheet_id);
    }
  };

  return (
    <header id="app-topbar" className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between shadow-xs">
      {/* Left side: Menu Toggle, System Branding & Sudo Mode Banner */}
      <div className="flex items-center gap-3">
        <button
          id="topbar-menu-toggle-button"
          onClick={onToggleSidebar}
          title="Open Navigation Menu"
          className="p-2 rounded-lg text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-xs"
        >
          <Menu className="w-5 h-5 text-slate-700" />
          <span className="text-xs font-semibold text-slate-700 hidden sm:inline">Menu</span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
            S
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">SHRO Systems</h1>
            <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">Sales Quotation & Cost Sheet Portal</span>
          </div>
        </div>

        {/* Sudo Mode Warning Banner if active */}
        {user.is_sudo && (
          <div id="sudo-active-banner" className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-300 rounded-full text-amber-800 text-xs font-medium animate-pulse">
            <UserCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>Acting as <strong>{user.name}</strong> (Sudo Mode)</span>
            <button
              onClick={onExitSudo}
              className="ml-1 underline hover:text-amber-950 text-xs font-semibold cursor-pointer"
            >
              Exit Sudo
            </button>
          </div>
        )}
      </div>

      {/* Right side: Sync Status, Notification Bell, User profile */}
      <div className="flex items-center gap-3">
        {/* Sync Status (Websocket indicator) */}
        <div
          id="websocket-sync-status"
          title={socketConnected ? 'Live WebSocket connected - Real-time updates active' : 'Disconnected from WebSocket'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            socketConnected 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {socketConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden md:inline">Sync Status: Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-amber-500" />
              <span className="hidden md:inline">Reconnecting</span>
            </>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            id="notification-bell-button"
            onClick={handleToggleNotifications}
            aria-label="Notifications"
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {pendingApprovalsCount > 0 && (
              <span 
                id="pending-approvals-badge"
                className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-amber-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs animate-bounce"
              >
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div 
              id="notifications-dropdown-menu"
              className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2"
            >
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Workflow Notifications</h3>
                  <p className="text-[11px] text-slate-500">
                    {pendingApprovalsCount} sheet{pendingApprovalsCount !== 1 ? 's' : ''} awaiting your approval
                  </p>
                </div>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {loadingNotifications ? (
                  <div className="p-4 text-center text-xs text-slate-500">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <Check className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                    <p className="text-xs font-medium text-slate-700">All caught up!</p>
                    <p className="text-[11px] text-slate-400">No pending approvals or notifications</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 text-left hover:bg-slate-50 transition cursor-pointer ${
                        !n.is_read ? 'bg-blue-50/40 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-800 truncate font-semibold">{n.title}</p>
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            id="user-profile-menu-button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 pl-2 pr-2.5 rounded-lg hover:bg-slate-100 transition border border-slate-200 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden lg:block">
              <p className="text-xs font-semibold text-slate-800 leading-tight">{user.name}</p>
              <p className="text-[10px] text-slate-500 leading-tight capitalize">{user.role} • {user.access_level}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div 
              id="user-profile-dropdown"
              className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 py-1"
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">{user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold border border-blue-200">
                    {user.role}
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                    {user.access_level}
                  </span>
                </div>
              </div>

              {/* Sudo Mode Option for Admin */}
              {user.access_level === 'Admin' && (
                <button
                  id="sudo-mode-trigger-button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenSudoModal();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 flex items-center gap-2 transition cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Login As (Sudo Mode)...</span>
                </button>
              )}

              {user.is_sudo && (
                <button
                  id="exit-sudo-menu-button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onExitSudo();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Exit Sudo Session</span>
                </button>
              )}

              <button
                id="logout-button"
                onClick={() => {
                  setShowUserMenu(false);
                  onLogout();
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition cursor-pointer border-t border-slate-100"
              >
                <LogOut className="w-3.5 h-3.5 text-red-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
