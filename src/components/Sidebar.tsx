import React from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Building2, 
  BarChart3, 
  ShieldAlert, 
  PlusCircle,
  Clock,
  X,
  Pin,
  PinOff,
  Mail,
  Archive
} from 'lucide-react';
import { User } from '../types.ts';
import { ShroLogo } from './ShroLogo.tsx';

export type NavTab = 'dashboard' | 'cost_sheets' | 'accounts' | 'reports' | 'admin' | 'email' | 'backup';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  user: User;
  onNewCostSheet: () => void;
  pendingApprovalsCount: number;
  isOpen: boolean;
  isPinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  user,
  onNewCostSheet,
  pendingApprovalsCount,
  isOpen,
  isPinned,
  onClose,
  onTogglePin,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'cost_sheets' as NavTab,
      label: 'All Cost Sheets',
      icon: FileSpreadsheet,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null,
    },
    {
      id: 'accounts' as NavTab,
      label: 'Accounts',
      icon: Building2,
      badge: null,
    },
  ];

  // Only Leadership, Management, and Admins can access organizational aggregate reports
  if (['Admin', 'Management', 'TeamLead'].includes(user.access_level)) {
    navItems.push({
      id: 'reports' as NavTab,
      label: 'Reports & Analytics',
      icon: BarChart3,
      badge: null,
    });
  }

  // Admin exclusive sections
  if (user.access_level === 'Admin') {
    navItems.push(
      {
        id: 'admin' as NavTab,
        label: 'Admin Tools',
        icon: ShieldAlert,
        badge: null,
      },
      {
        id: 'email' as NavTab,
        label: 'Email Settings',
        icon: Mail,
        badge: null,
      },
      {
        id: 'backup' as NavTab,
        label: 'Backup Database',
        icon: Archive,
        badge: null,
      }
    );
  }

  const handleSelectTab = (tab: NavTab) => {
    onTabChange(tab);
    if (!isPinned) {
      onClose();
    }
  };

  const handleNewCostSheetClick = () => {
    onNewCostSheet();
    if (!isPinned) {
      onClose();
    }
  };

  // If not pinned and not open, don't show or render offscreen
  return (
    <>
      {/* Backdrop for popup overlay mode */}
      {!isPinned && isOpen && (
        <div 
          id="sidebar-backdrop"
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-40 transition-opacity animate-in fade-in"
          aria-label="Close navigation overlay"
        />
      )}

      <aside 
        id="app-sidebar" 
        className={`
          fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col select-none shadow-2xl transition-transform duration-300 ease-in-out
          ${isPinned ? 'md:static md:translate-x-0 md:shadow-none' : ''}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand Header & Drawer Controls */}
        <div className="h-20 px-5 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
          <div className="bg-white/95 rounded-lg px-2.5 py-1.5 shadow-sm">
            <ShroLogo className="h-8 w-auto" variant="color" />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onTogglePin}
              title={isPinned ? "Unpin sidebar (auto-pop up mode)" : "Pin sidebar to screen"}
              className={`p-1.5 rounded-lg transition text-xs cursor-pointer ${
                isPinned ? 'bg-blue-600/30 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              title="Close panel"
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* New Cost Sheet Primary CTA */}
        <div className="p-4">
          <button
            id="sidebar-new-cost-sheet-button"
            onClick={handleNewCostSheetClick}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Cost Sheet</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-white flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 6 Sequential Stages Reference Guide */}
        <div className="p-4 mx-3 mb-4 rounded-xl bg-slate-800/50 border border-slate-800 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-300 text-[11px] mb-2 uppercase tracking-wider">Sequential Workflow</p>
          <ol className="space-y-1 text-[10px] text-slate-400">
            <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">1</span> Finance 1</li>
            <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">2</span> Presales</li>
            <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">3</span> Management</li>
            <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">4</span> Operations</li>
            <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">5</span> Logistics</li>
            <li className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-[9px]">6</span> Finance 2</li>
          </ol>
        </div>

        {/* User Info footer */}
        <div className="p-4 border-t border-slate-800 text-xs">
          <p className="text-slate-400 text-[11px]">Logged in as:</p>
          <p className="font-semibold text-slate-200 truncate">{user.name}</p>
          <span className="text-[10px] text-slate-500 capitalize">{user.role} • {user.access_level}</span>
        </div>
      </aside>
    </>
  );
};

