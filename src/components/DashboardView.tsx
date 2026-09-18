import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  FileText, 
  Filter, 
  RefreshCw, 
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Users,
  User as UserIcon,
  Building2,
  Layers,
  Sparkles,
  Download,
  RotateCcw,
  Tag,
  Briefcase,
  ChevronRight,
  ShieldCheck,
  Maximize2,
  IndianRupee,
  FileEdit
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { User, DropdownOptions, Account } from '../types.ts';
import { DashboardInsightsModal, DrilldownPanelType } from './DashboardInsightsModal.tsx';

interface DashboardViewProps {
  onSelectCostSheet: (id: number) => void;
  onNewCostSheet: () => void;
  dropdowns: DropdownOptions;
  salespeople: User[];
  currentUser?: User;
  accounts?: Account[];
}

type ScopeType = 'all' | 'my' | 'team' | 'user';

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectCostSheet,
  onNewCostSheet,
  dropdowns,
  salespeople,
  currentUser,
  accounts = [],
}) => {
  // Scope Filter: all | my | team | user
  const [scope, setScope] = useState<ScopeType>('all');
  const [selectedUserScopeId, setSelectedUserScopeId] = useState<string>('All');

  // Dimension Slicers
  const [financialYear, setFinancialYear] = useState('All');
  const [quarter, setQuarter] = useState('All');
  const [month, setMonth] = useState('All');
  const [status, setStatus] = useState('All');
  const [businessUnit, setBusinessUnit] = useState('All');
  const [oem, setOem] = useState('All');
  const [distributor, setDistributor] = useState('All');
  const [accountId, setAccountId] = useState('All');
  const [marginBand, setMarginBand] = useState('All');

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // In-Depth Insights Drilldown Modal State
  const [insightsModal, setInsightsModal] = useState<{
    isOpen: boolean;
    panel: DrilldownPanelType;
    targetId?: string;
    targetName?: string;
  } | null>(null);

  const openInsights = (panel: DrilldownPanelType, targetId?: string, targetName?: string) => {
    setInsightsModal({
      isOpen: true,
      panel,
      targetId,
      targetName
    });
  };

  // Active filters count for reset badge
  const activeFiltersCount = [
    scope !== 'all',
    selectedUserScopeId !== 'All',
    financialYear !== 'All',
    quarter !== 'All',
    month !== 'All',
    status !== 'All',
    businessUnit !== 'All',
    oem !== 'All',
    distributor !== 'All',
    accountId !== 'All',
    marginBand !== 'All'
  ].filter(Boolean).length;

  const resetAllFilters = () => {
    setScope('all');
    setSelectedUserScopeId('All');
    setFinancialYear('All');
    setQuarter('All');
    setMonth('All');
    setStatus('All');
    setBusinessUnit('All');
    setOem('All');
    setDistributor('All');
    setAccountId('All');
    setMarginBand('All');
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (scope !== 'all') {
        params.append('scope', scope);
      }
      if (scope === 'user' && selectedUserScopeId !== 'All') {
        params.append('salesperson_id', selectedUserScopeId);
      } else if (selectedUserScopeId !== 'All') {
        params.append('salesperson_id', selectedUserScopeId);
      }

      if (financialYear !== 'All') params.append('financial_year', financialYear);
      if (quarter !== 'All') params.append('quarter', quarter);
      if (month !== 'All') params.append('month', month);
      if (status !== 'All') params.append('status', status);
      if (businessUnit !== 'All') params.append('business_unit', businessUnit);
      if (oem !== 'All') params.append('oem', oem);
      if (distributor !== 'All') params.append('distributor', distributor);
      if (accountId !== 'All') params.append('account_id', accountId);
      if (marginBand !== 'All') params.append('margin_band', marginBand);

      const data = await apiRequest(`/api/reports/dashboard?${params.toString()}`);
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [
    scope, 
    selectedUserScopeId, 
    financialYear, 
    quarter, 
    month, 
    status, 
    businessUnit, 
    oem, 
    distributor, 
    accountId, 
    marginBand
  ]);

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (scope !== 'all') params.append('scope', scope);
      if (selectedUserScopeId !== 'All') params.append('salesperson_id', selectedUserScopeId);
      if (financialYear !== 'All') params.append('financial_year', financialYear);
      if (quarter !== 'All') params.append('quarter', quarter);
      if (month !== 'All') params.append('month', month);
      if (status !== 'All') params.append('status', status);
      if (businessUnit !== 'All') params.append('business_unit', businessUnit);
      if (oem !== 'All') params.append('oem', oem);
      if (distributor !== 'All') params.append('distributor', distributor);
      if (accountId !== 'All') params.append('account_id', accountId);
      if (marginBand !== 'All') params.append('margin_band', marginBand);

      const token = localStorage.getItem('shro_token');
      const response = await fetch(`/api/reports/export-excel?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cost_sheets_export_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Failed to export reports:', err);
    }
  };

  const monthsList = [
    { num: '1', name: 'January' },
    { num: '2', name: 'February' },
    { num: '3', name: 'March' },
    { num: '4', name: 'April' },
    { num: '5', name: 'May' },
    { num: '6', name: 'June' },
    { num: '7', name: 'July' },
    { num: '8', name: 'August' },
    { num: '9', name: 'September' },
    { num: '10', name: 'October' },
    { num: '11', name: 'November' },
    { num: '12', name: 'December' },
  ];

  const kpi = stats?.kpis || { 
    total_deal_value: 0, 
    total_purchase: 0, 
    total_profit: 0, 
    avg_margin: 0, 
    overall_margin: 0,
    total_count: 0,
    draft_count: 0,
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0
  };
  const trend = stats?.monthly_trend || [];
  const salespersonPerf = stats?.salesperson_performance || [];
  const statusDist = stats?.status_distribution || [];
  const buDist = stats?.business_unit_distribution || [];
  const oemDist = stats?.oem_distribution || [];
  const topAccounts = stats?.top_accounts || [];
  const userPerf = stats?.user_performance || [];
  const recentSheets = stats?.recent_sheets || [];

  const fmtCompact = (n: number | string) => {
    const num = Number(n || 0);
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    const trim = (x: number) => {
      const r = Math.round(x * 100) / 100;
      return r % 1 === 0 ? r.toString() : r.toFixed(2).replace(/0$/, '');
    };
    if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
    if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} Lakh`;
    if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)} K`;
    return `${sign}₹${trim(abs)}`;
  };

  // Calculation for Doughnut Chart SVG
  const totalStatusCount = statusDist.reduce((acc: number, curr: any) => acc + parseInt(curr.count, 10), 0) || 1;
  const statusColors: { [key: string]: string } = {
    Approved: '#16a34a',
    Pending: '#d97706',
    Draft: '#64748b',
    Rejected: '#dc2626',
  };

  // Trend Chart Max
  const maxProfit = Math.max(...trend.map((t: any) => parseFloat(t.total_profit) || 0), 100000);
  const maxSale = Math.max(...trend.map((t: any) => parseFloat(t.total_sale) || 0), 200000);

  // Status counts helper
  const approvedItem = statusDist.find((d: any) => d.status === 'Approved');
  const pendingItem = statusDist.find((d: any) => d.status === 'Pending');
  const draftItem = statusDist.find((d: any) => d.status === 'Draft');
  const rejectedItem = statusDist.find((d: any) => d.status === 'Rejected');

  const stageNames: { [key: number]: string } = {
    1: 'Finance 1',
    2: 'Presales',
    3: 'Management',
    4: 'Operations',
    5: 'Logistics',
    6: 'Finance 2',
  };

  return (
    <div id="dashboard-view-container" className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner & Quick Scope Filter Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
              Real-Time Intelligence
            </span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold flex items-center gap-1">
                {activeFiltersCount} Filter{activeFiltersCount > 1 ? 's' : ''} Active
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Executive Performance Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track gross margins, sequential workflow approvals, sales targets, and OEM distributions
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          <button
            id="dashboard-new-sheet-btn"
            onClick={onNewCostSheet}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-blue-600/20 cursor-pointer transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Cost Sheet</span>
          </button>
          <button
            id="dashboard-export-excel-btn"
            onClick={handleExportExcel}
            title="Export filtered cost sheet dataset to Excel"
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export Excel</span>
          </button>
          <button
            id="dashboard-refresh-btn"
            onClick={fetchStats}
            title="Refresh metrics"
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl cursor-pointer transition shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scope Filter Switcher Tabs (My Dashboard / My Team Dashboard / User Dashboard / All) */}
      <div className="bg-slate-900 text-white p-2 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            id="filter-scope-all"
            onClick={() => {
              setScope('all');
              setSelectedUserScopeId('All');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
              scope === 'all'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Company Overview (All)</span>
          </button>

          <button
            id="filter-scope-my"
            onClick={() => {
              setScope('my');
              setSelectedUserScopeId('All');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
              scope === 'my'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>My Dashboard {currentUser ? `(${currentUser.name.split(' ')[0]})` : ''}</span>
          </button>

          <button
            id="filter-scope-team"
            onClick={() => {
              setScope('team');
              setSelectedUserScopeId('All');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
              scope === 'team'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>My Team Dashboard</span>
          </button>

          <button
            id="filter-scope-user"
            onClick={() => setScope('user')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
              scope === 'user'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>User Dashboard</span>
          </button>
        </div>

        {/* User Scope Dropdown when inspecting specific user */}
        {scope === 'user' && (
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 animate-in fade-in">
            <span className="text-[11px] text-slate-400 font-medium">Select Rep:</span>
            <select
              id="filter-user-scope-select"
              value={selectedUserScopeId}
              onChange={(e) => setSelectedUserScopeId(e.target.value)}
              className="bg-slate-900 text-white text-xs border border-slate-700 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="All">Select a User / Salesperson...</option>
              {salespeople.map((sp) => (
                <option key={sp.id} value={sp.id.toString()}>
                  {sp.name} ({sp.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Slicers & Filters Panel */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Multi-Dimensional Slicers</h2>
          </div>
          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              id="dashboard-reset-filters-btn"
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All ({activeFiltersCount})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Financial Year */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Financial Year</label>
            <select
              id="filter-financial-year"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Financial Years</option>
              <option value="2026-27">FY 2026-27</option>
              <option value="2025-26">FY 2025-26</option>
              <option value="2024-25">FY 2024-25</option>
            </select>
          </div>

          {/* Quarter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fiscal Quarter</label>
            <select
              id="filter-quarter"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Quarters</option>
              <option value="Q1">Q1 (Apr - Jun)</option>
              <option value="Q2">Q2 (Jul - Sep)</option>
              <option value="Q3">Q3 (Oct - Dec)</option>
              <option value="Q4">Q4 (Jan - Mar)</option>
            </select>
          </div>

          {/* Month */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Month</label>
            <select
              id="filter-month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Months</option>
              {monthsList.map((m) => (
                <option key={m.num} value={m.num}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Approval Status</label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Business Unit */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Business Unit</label>
            <select
              id="filter-business-unit"
              value={businessUnit}
              onChange={(e) => setBusinessUnit(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Business Units</option>
              {dropdowns.business_unit.map((bu) => (
                <option key={bu} value={bu}>{bu}</option>
              ))}
            </select>
          </div>

          {/* OEM / Brand */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">OEM / Brand</label>
            <select
              id="filter-oem"
              value={oem}
              onChange={(e) => setOem(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All OEMs</option>
              {dropdowns.oem.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* Distributor */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Distributor</label>
            <select
              id="filter-distributor"
              value={distributor}
              onChange={(e) => setDistributor(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Distributors</option>
              {dropdowns.distributor.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Customer Account */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Customer Account</label>
            <select
              id="filter-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id.toString()}>{acc.name}</option>
              ))}
            </select>
          </div>

          {/* Margin Band */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Margin Band</label>
            <select
              id="filter-margin-band"
              value={marginBand}
              onChange={(e) => setMarginBand(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white font-medium"
            >
              <option value="All">All Margins</option>
              <option value="lt_10">&lt; 10% Low Margin</option>
              <option value="10_to_18">10% - 18% Standard</option>
              <option value="gt_18">&gt; 18% Healthy Margin</option>
            </select>
          </div>

          {/* Salesperson Filter if not already locked in User mode */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Representative</label>
            <select
              id="filter-salesperson"
              value={selectedUserScopeId}
              onChange={(e) => setSelectedUserScopeId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500 focus:bg-white"
            >
              <option value="All">All Salespeople</option>
              {salespeople.map((sp) => (
                <option key={sp.id} value={sp.id.toString()}>{sp.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Primary KPI Summary Tiles (8 Tiles matching reference dashboard: Total, Draft, Pending, Approved, Rejected, Total Sale, Total Profit, Margin %) */}
      <div id="dash-summary" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* 1. Total Cost Sheets */}
        <div 
          id="kpi-total-cost-sheets" 
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          onClick={() => openInsights('recent_quotes')}
          title="Total cost sheets in active scope"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Sheets</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-2xs">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-slate-900 tracking-tight">
              {kpi.total_count}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">All records</p>
          </div>
        </div>

        {/* 2. Draft */}
        <div 
          id="kpi-draft-count" 
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          onClick={() => openInsights('draft_deals')}
          title="Draft quotations under preparation"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Draft</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-slate-700 group-hover:text-white transition shadow-2xs">
              <FileEdit className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-slate-700 tracking-tight">
              {kpi.draft_count}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">In progress</p>
          </div>
        </div>

        {/* 3. Pending Approval */}
        <div 
          id="kpi-pending-approvals" 
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-orange-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          onClick={() => openInsights('pending_approvals')}
          title="Cost sheets awaiting sequential approval"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending</span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition shadow-2xs">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-orange-600 tracking-tight">
              {kpi.pending_count}
            </p>
            <p className="text-[10px] text-orange-500 font-medium mt-0.5 truncate">Awaiting sign-off</p>
          </div>
        </div>

        {/* 4. Approved */}
        <div 
          id="kpi-approved-deals" 
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          onClick={() => openInsights('approved_deals')}
          title="Approved and commercially cleared cost sheets"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Approved</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-emerald-600 tracking-tight">
              {kpi.approved_count}
            </p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5 truncate">Fully cleared</p>
          </div>
        </div>

        {/* 5. Rejected */}
        <div 
          id="kpi-rejected-deals" 
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          onClick={() => openInsights('rejected_deals')}
          title="Rejected cost sheets"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rejected</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition shadow-2xs">
              <XCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-rose-600 tracking-tight">
              {kpi.rejected_count}
            </p>
            <p className="text-[10px] text-rose-500 font-medium mt-0.5 truncate">Declined</p>
          </div>
        </div>

        {/* 6. Total Sale */}
        <div 
          id="kpi-total-deal-value" 
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          onClick={() => openInsights('gross_deal_value')}
          title={`Total Sale: ₹${Number(kpi.total_deal_value).toLocaleString('en-IN')}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Sale</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition shadow-2xs">
              <IndianRupee className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-purple-700 tracking-tight">
              {fmtCompact(kpi.total_deal_value)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={`₹${Number(kpi.total_deal_value).toLocaleString('en-IN')}`}>
              ₹{Number(kpi.total_deal_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* 7. Total Profit */}
        <div 
          id="kpi-total-profit" 
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-cyan-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          onClick={() => openInsights('net_profit')}
          title={`Total Profit: ₹${Number(kpi.total_profit).toLocaleString('en-IN')}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Profit</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition shadow-2xs">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-cyan-600 tracking-tight">
              {fmtCompact(kpi.total_profit)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={`₹${Number(kpi.total_profit).toLocaleString('en-IN')}`}>
              ₹{Number(kpi.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* 8. Margin % */}
        <div 
          id="kpi-average-margin" 
          className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-500 hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          onClick={() => openInsights('average_margin')}
          title={`Overall Margin: ${Number(kpi.overall_margin || kpi.avg_margin).toFixed(2)}%, Avg Margin: ${Number(kpi.avg_margin).toFixed(2)}%`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Margin %</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition shadow-2xs">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xl font-extrabold text-amber-600 tracking-tight">
              {Number(kpi.overall_margin || kpi.avg_margin).toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Avg: {Number(kpi.avg_margin).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Grid: Trend, Status Distribution, OEM Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue & Profit Trend (Clickable to open deep insights or inspect specific month) */}
        <div id="chart-monthly-profit-trend" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 flex flex-col justify-between hover:border-blue-300 transition">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Monthly Profit & Revenue Trend</h3>
                <button
                  onClick={() => openInsights('monthly_trend')}
                  className="text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full font-bold border border-blue-200 flex items-center gap-1 transition cursor-pointer"
                  title="Open in-depth monthly trend trajectory analysis"
                >
                  <span>Deep Insights</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Click any bar or the header button to inspect in-depth deal velocity & profit drivers
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-blue-600" />
                <span className="text-slate-600 text-[11px]">Net Profit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-slate-300" />
                <span className="text-slate-600 text-[11px]">Revenue</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full relative flex items-end pt-4 pb-4 px-2">
            {trend.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                No trend data matching active filters
              </div>
            ) : (
              <div className="w-full h-full flex flex-col justify-end">
                <div className="relative h-48 w-full flex items-end gap-3 px-2">
                  {trend.map((t: any, idx: number) => {
                    const profit = parseFloat(t.total_profit) || 0;
                    const sale = parseFloat(t.total_sale) || 0;
                    const heightPercent = Math.max(12, Math.min(95, (profit / maxProfit) * 100));
                    const isSelected = month === t.mo?.toString();

                    return (
                      <div 
                        key={idx} 
                        onClick={() => openInsights('monthly_trend', undefined, t.mo.toString())}
                        className={`flex-1 flex flex-col items-center group relative h-full justify-end cursor-pointer rounded-lg p-1 transition ${
                          isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-slate-50'
                        }`}
                        title={`Click to inspect ${t.month_label} in-depth`}
                      >
                        {/* Hover Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 transition absolute -top-14 bg-slate-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg whitespace-nowrap z-20 pointer-events-none shadow-xl">
                          <p className="font-bold">{t.month_label}</p>
                          <p className="text-emerald-400">Profit: ₹{Number(profit).toLocaleString('en-IN')}</p>
                          <p className="text-slate-300">Revenue: ₹{Number(sale).toLocaleString('en-IN')}</p>
                          <p className="text-blue-300 font-semibold">{t.count} quotes • Click for Deep Insights</p>
                        </div>
                        
                        {/* Bar */}
                        <div 
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[42px] rounded-t-lg transition ${
                            isSelected
                              ? 'bg-blue-600 shadow-md shadow-blue-500/30' 
                              : 'bg-gradient-to-t from-blue-600 to-indigo-500 group-hover:from-blue-500 group-hover:to-indigo-400'
                          }`}
                        />
                        {/* X-axis Label */}
                        <span className="text-[10px] font-semibold text-slate-500 mt-2 truncate w-full text-center">
                          {t.month_label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Distribution (Clickable Doughnut Segments & Legend) */}
        <div id="chart-status-distribution" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-purple-300 transition">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Workflow Sign-off Status</h3>
              <p className="text-xs text-slate-500">Distribution across approval phases</p>
            </div>
            <button
              onClick={() => openInsights('status_distribution')}
              className="text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200 flex items-center gap-1 transition cursor-pointer"
              title="Open quotation workflow funnel insights"
            >
              <span>Funnel Insights</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            <div 
              className="relative w-36 h-36 flex items-center justify-center cursor-pointer group"
              onClick={() => openInsights('status_distribution')}
              title="Click to view Workflow Funnel Insights"
            >
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.91549430918954"
                  fill="transparent"
                  stroke="#e2e8f0"
                  strokeWidth="3.5"
                />
                {(() => {
                  let accumulatedPercent = 0;
                  return statusDist.map((item: any, i: number) => {
                    const count = parseInt(item.count, 10);
                    const percent = (count / totalStatusCount) * 100;
                    const strokeDasharray = `${percent} ${100 - percent}`;
                    const strokeDashoffset = -accumulatedPercent;
                    accumulatedPercent += percent;
                    const color = statusColors[item.status] || '#94a3b8';

                    return (
                      <circle
                        key={i}
                        cx="18"
                        cy="18"
                        r="15.91549430918954"
                        fill="transparent"
                        stroke={color}
                        strokeWidth={status === item.status ? '4.8' : '3.8'}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-300 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInsights('status_distribution');
                        }}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute text-center pointer-events-none group-hover:scale-105 transition">
                <span className="text-xl font-extrabold text-slate-900">{kpi.total_count}</span>
                <span className="block text-[10px] text-purple-600 font-bold">Inspect Funnel</span>
              </div>
            </div>

            {/* Clickable Legend */}
            <div className="w-full mt-4 space-y-1.5">
              {['Approved', 'Pending', 'Draft', 'Rejected'].map((st) => {
                const found = statusDist.find((d: any) => d.status === st);
                const count = found ? parseInt(found.count, 10) : 0;
                const percent = Math.round((count / totalStatusCount) * 100);
                const color = statusColors[st];
                const isActive = status === st;

                return (
                  <button
                    key={st}
                    onClick={() => openInsights('status_distribution')}
                    className={`w-full flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg transition cursor-pointer group ${
                      isActive ? 'bg-slate-100 font-bold border border-slate-300' : 'hover:bg-slate-50'
                    }`}
                    title={`Click to view insights for ${st} quotes`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-slate-700">{st}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">{count} ({percent}%)</span>
                      <ArrowUpRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Analytics Row: Business Unit Revenue, OEM Revenue & Salesperson Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Business Unit Revenue (Clickable to inspect BU) */}
        <div id="chart-bu-distribution" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Business Unit Revenue</h3>
              <p className="text-xs text-slate-500">Revenue contribution per business division</p>
            </div>
            <button
              onClick={() => openInsights('business_unit_distribution')}
              className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1 transition cursor-pointer"
              title="Open Business Unit Revenue Insights"
            >
              <span>BU Insights</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {buDist.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">No Business Unit data available</div>
            ) : (
              buDist.map((item: any, i: number) => {
                const maxBuSale = Math.max(...buDist.map((b: any) => parseFloat(b.total_sale) || 0), 1);
                const width = Math.max(8, Math.min(100, (parseFloat(item.total_sale) / maxBuSale) * 100));
                const isSelected = businessUnit === item.business_unit;

                return (
                  <div 
                    key={i} 
                    onClick={() => openInsights('business_unit_distribution', undefined, item.business_unit)}
                    className={`p-2 rounded-xl transition cursor-pointer group ${
                      isSelected ? 'bg-indigo-50 border border-indigo-300' : 'hover:bg-slate-50'
                    }`}
                    title={`Click to inspect ${item.business_unit} deals in-depth`}
                  >
                    <div className="flex justify-between text-xs font-semibold text-slate-800">
                      <span className="truncate max-w-[200px]" title={item.business_unit}>{item.business_unit}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        ₹{Number(item.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        <ArrowUpRight className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition" />
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-1.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSelected ? 'bg-indigo-600' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{item.count} quote{item.count !== 1 ? 's' : ''}</span>
                      <span className="text-emerald-600 font-medium">Profit: ₹{Number(item.total_profit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Card 2: OEM / Brand Distribution (Clickable to inspect OEM) */}
        <div id="chart-oem-distribution" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-orange-300 transition">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Brand / OEM Revenue</h3>
              <p className="text-xs text-slate-500">Volume per equipment manufacturer</p>
            </div>
            <button
              onClick={() => openInsights('oem_distribution')}
              className="text-[10px] font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200 flex items-center gap-1 transition cursor-pointer"
              title="Open OEM Brand Portfolio Insights"
            >
              <span>OEM Insights</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3 pt-1">
            {oemDist.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">No OEM data available</div>
            ) : (
              oemDist.map((item: any, i: number) => {
                const maxOemSale = Math.max(...oemDist.map((o: any) => parseFloat(o.total_sale) || 0), 1);
                const width = Math.max(8, Math.min(100, (parseFloat(item.total_sale) / maxOemSale) * 100));
                const isSelected = oem === item.oem;

                return (
                  <div 
                    key={i} 
                    onClick={() => openInsights('oem_distribution', undefined, item.oem)}
                    className={`p-2 rounded-xl transition cursor-pointer group ${
                      isSelected ? 'bg-orange-50 border border-orange-300' : 'hover:bg-slate-50'
                    }`}
                    title={`Click to inspect ${item.oem} deals in-depth`}
                  >
                    <div className="flex justify-between text-xs font-semibold text-slate-800">
                      <span className="truncate">{item.oem}</span>
                      <span className="flex items-center gap-1">
                        ₹{Number(item.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        <ArrowUpRight className="w-3 h-3 text-orange-500 opacity-0 group-hover:opacity-100 transition" />
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-1.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isSelected ? 'bg-orange-600' : 'bg-slate-600'
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{item.count} quote{item.count !== 1 ? 's' : ''}</span>
                      <span className="text-orange-600 font-medium">Inspect brand</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Card 3: Salesperson Leaderboard (Clickable to inspect Salesperson) */}
        <div id="chart-salesperson-performance" className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-cyan-300 transition">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Sales Representative Performance</h3>
              <p className="text-xs text-slate-500">Deal volume and profit contribution</p>
            </div>
            <button
              onClick={() => openInsights('salesperson_performance')}
              className="text-[10px] font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-2 py-0.5 rounded-full border border-cyan-200 flex items-center gap-1 transition cursor-pointer"
              title="Open Representative Scorecards"
            >
              <span>Rep Insights</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5 pt-1">
            {salespersonPerf.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">No representative data</div>
            ) : (
              salespersonPerf.map((sp: any, i: number) => {
                const maxDeal = Math.max(...salespersonPerf.map((s: any) => parseFloat(s.total_deal_value) || 0), 1);
                const barWidth = Math.max(8, Math.min(100, (parseFloat(sp.total_deal_value) / maxDeal) * 100));
                const isSelected = selectedUserScopeId === sp.salesperson_id?.toString();

                return (
                  <div 
                    key={i} 
                    onClick={() => openInsights('salesperson_performance', sp.salesperson_id?.toString(), sp.salesperson_name)}
                    className={`p-2 rounded-xl transition cursor-pointer group ${
                      isSelected ? 'bg-cyan-50 border border-cyan-300' : 'hover:bg-slate-50'
                    }`}
                    title={`Click to view in-depth scorecard for ${sp.salesperson_name}`}
                  >
                    <div className="flex justify-between text-xs font-semibold text-slate-800">
                      <span className="truncate max-w-[140px]">{sp.salesperson_name}</span>
                      <span className="text-slate-900 flex items-center gap-1">
                        ₹{Number(sp.total_deal_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        <ArrowUpRight className="w-3 h-3 text-cyan-500 opacity-0 group-hover:opacity-100 transition" />
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-1.5">
                      <div 
                        className="h-full bg-cyan-600 rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{sp.deal_count} deals • Margin: {Number(sp.avg_margin || 0).toFixed(1)}%</span>
                      <span className="text-emerald-600 font-semibold">Profit: ₹{Number(sp.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Side-by-Side Summary Tables: Cost Sheets by Customer & Cost Sheets by Salesperson */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cost Sheets by Customer */}
        <div id="table-cost-sheets-by-customer" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Cost Sheets by Customer</h3>
            </div>
            <button
              onClick={() => openInsights('top_accounts')}
              className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1 transition cursor-pointer"
            >
              <span>Customer Insights</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-3 text-center">Cost Sheets</th>
                  <th className="py-2.5 px-4 text-right">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-xs text-slate-400">No customer records available</td>
                  </tr>
                ) : (
                  topAccounts.slice(0, 8).map((acc: any, i: number) => (
                    <tr 
                      key={i} 
                      onClick={() => openInsights('top_accounts', undefined, acc.account_name)}
                      className="hover:bg-slate-50 transition cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        <span className="truncate max-w-[220px] block group-hover:text-blue-600 transition" title={acc.account_name}>
                          {acc.account_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-semibold">
                        {acc.deal_count}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        ₹{Number(acc.total_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Sheets by Salesperson */}
        <div id="table-cost-sheets-by-salesperson" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Cost Sheets by Salesperson</h3>
            </div>
            <button
              onClick={() => openInsights('salesperson_performance')}
              className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 transition cursor-pointer"
            >
              <span>Rep Insights</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Salesperson</th>
                  <th className="py-2.5 px-3 text-center">Cost Sheets</th>
                  <th className="py-2.5 px-4 text-right">Total Value</th>
                  <th className="py-2.5 px-4 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salespersonPerf.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-slate-400">No salesperson records available</td>
                  </tr>
                ) : (
                  salespersonPerf.slice(0, 8).map((sp: any, i: number) => (
                    <tr 
                      key={i} 
                      onClick={() => openInsights('salesperson_performance', sp.salesperson_id?.toString(), sp.salesperson_name)}
                      className="hover:bg-slate-50 transition cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        <span className="truncate max-w-[180px] block group-hover:text-emerald-600 transition" title={sp.salesperson_name}>
                          {sp.salesperson_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-semibold">
                        {sp.deal_count}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        ₹{Number(sp.total_deal_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-600">
                        ₹{Number(sp.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Performance by User Table (Matching Reference Dashboard) */}
      <div id="table-performance-by-user" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Performance by User</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Track user deal creation, pipeline stages, commercial yield, and active approval responsibilities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs font-medium">
              {userPerf.length} active user{userPerf.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-3">Dept / Role</th>
                <th className="py-3 px-2.5 text-center">Total</th>
                <th className="py-3 px-2.5 text-center">Draft</th>
                <th className="py-3 px-2.5 text-center">Pending</th>
                <th className="py-3 px-2.5 text-center">Approved</th>
                <th className="py-3 px-2.5 text-center">Rejected</th>
                <th className="py-3 px-4 text-right">Total Sale</th>
                <th className="py-3 px-4 text-right">Total Profit</th>
                <th className="py-3 px-3 text-center">Avg Margin</th>
                <th className="py-3 px-4 text-center">Awaiting Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {userPerf.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-xs text-slate-400">
                    No user performance records found
                  </td>
                </tr>
              ) : (
                userPerf.map((u: any) => {
                  const awaitingCount = parseInt(u.awaiting_approval_count || 0, 10);
                  const isCurrent = currentUser?.id === u.user_id;

                  return (
                    <tr 
                      key={u.user_id}
                      onClick={() => openInsights('user_performance', u.user_id?.toString(), u.user_name)}
                      className={`hover:bg-slate-50 transition cursor-pointer group ${
                        isCurrent ? 'bg-blue-50/30' : ''
                      }`}
                      title={`Click to view performance dossier and quotes for ${u.user_name}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition">
                            {u.user_name}
                          </span>
                          {u.access_level === 'Admin' && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200">
                              Admin
                            </span>
                          )}
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
                          {u.dept_role || 'Staff'}
                        </span>
                      </td>
                      <td className="py-3 px-2.5 text-center font-bold text-slate-900">
                        {u.total_count}
                      </td>
                      <td className="py-3 px-2.5 text-center text-slate-500 font-medium">
                        {u.draft_count}
                      </td>
                      <td className="py-3 px-2.5 text-center text-orange-600 font-semibold">
                        {u.pending_count}
                      </td>
                      <td className="py-3 px-2.5 text-center text-emerald-600 font-semibold">
                        {u.approved_count}
                      </td>
                      <td className="py-3 px-2.5 text-center text-rose-600 font-medium">
                        {u.rejected_count}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₹{Number(u.total_sale || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        ₹{Number(u.total_profit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-semibold ${
                          parseFloat(u.avg_margin) < 10 ? 'text-rose-600' : 'text-slate-800'
                        }`}>
                          {Number(u.avg_margin || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {awaitingCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-700" />
                            {awaitingCount} pending
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Cost Sheet Table with ALL Fields and Clickables */}
      <div id="dashboard-recent-quotes" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Active & Recent Cost Sheets</h3>
            <p className="text-xs text-slate-500">
              Click any row or deal number to view details, sign off, or edit
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => openInsights('recent_quotes')}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Open full quotations directory with multi-column filtering and insights"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Deep Pipeline Insights</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs self-start md:self-auto font-medium">
              Showing latest {recentSheets.length} quotes
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">CS Number</th>
                <th className="py-3 px-4">Account & Subject</th>
                <th className="py-3 px-4">Salesperson</th>
                <th className="py-3 px-4">OEM & BU</th>
                <th className="py-3 px-4 text-right">Sale (₹)</th>
                <th className="py-3 px-4 text-right">Profit (₹)</th>
                <th className="py-3 px-4 text-center">Margin %</th>
                <th className="py-3 px-4 text-center">Stage</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {recentSheets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                    No cost sheets match the selected filter combination.
                  </td>
                </tr>
              ) : (
                recentSheets.map((sheet: any) => {
                  const margin = parseFloat(sheet.margin_percentage) || 0;
                  const marginColor = margin >= 18 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                                      margin >= 10 ? 'text-blue-700 bg-blue-50 border-blue-200' :
                                      'text-amber-700 bg-amber-50 border-amber-200';

                  const statusBadgeColor = sheet.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                           sheet.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                                           sheet.status === 'Rejected' ? 'bg-rose-100 text-rose-800' :
                                           'bg-slate-100 text-slate-700';

                  return (
                    <tr 
                      key={sheet.id}
                      className="hover:bg-blue-50/40 transition group cursor-pointer"
                      onClick={() => onSelectCostSheet(sheet.id)}
                    >
                      {/* CS Number Link */}
                      <td className="py-3 px-4 font-bold text-blue-600 group-hover:text-blue-700 flex items-center gap-1">
                        <span>{sheet.cs_number}</span>
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
                      </td>

                      {/* Account & Opportunity Subject */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 truncate max-w-[200px]">
                          {sheet.account_name || 'Direct / General'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate max-w-[220px]">
                          {sheet.subject || 'Standard Cost Sheet'}
                        </p>
                      </td>

                      {/* Salesperson */}
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {sheet.salesperson_name || 'Unassigned'}
                      </td>

                      {/* OEM & BU */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="text-slate-800 font-medium">{sheet.oem || 'Mixed'}</p>
                        <p className="text-[10px] text-slate-500">{sheet.business_unit || 'Enterprise'}</p>
                      </td>

                      {/* Sale Value */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{Number(sheet.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>

                      {/* Net Profit */}
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        ₹{Number(sheet.net_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>

                      {/* Margin % */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${marginColor}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>

                      {/* Sequential Stage */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                          {sheet.current_stage ? `${sheet.current_stage}. ${stageNames[sheet.current_stage] || ''}` : 'Draft'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeColor}`}>
                          {sheet.status}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectCostSheet(sheet.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          View / Sign
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-Depth Drilldown Insights Modal */}
      {insightsModal?.isOpen && (
        <DashboardInsightsModal
          panel={insightsModal.panel}
          targetId={insightsModal.targetId}
          targetName={insightsModal.targetName}
          onClose={() => setInsightsModal(null)}
          onSelectCostSheet={onSelectCostSheet}
          dashboardFilterParams={{
            scope,
            salesperson_id: selectedUserScopeId,
            financial_year: financialYear,
            quarter,
            month,
            status,
            business_unit: businessUnit,
            oem,
            distributor,
            account_id: accountId,
            margin_band: marginBand
          }}
        />
      )}

    </div>
  );
};
