import React, { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Clock, 
  CheckCircle2, 
  BarChart3, 
  PieChart, 
  Tag, 
  Users, 
  Building2, 
  Layers, 
  ArrowUpRight, 
  Download, 
  Search, 
  AlertTriangle, 
  CheckCircle,
  FileText,
  ChevronRight,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  FileEdit,
  XCircle,
  Briefcase
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';

export type DrilldownPanelType = 
  | 'gross_deal_value'
  | 'net_profit'
  | 'average_margin'
  | 'pending_approvals'
  | 'approved_deals'
  | 'draft_deals'
  | 'rejected_deals'
  | 'monthly_trend'
  | 'status_distribution'
  | 'business_unit_distribution'
  | 'oem_distribution'
  | 'salesperson_performance'
  | 'top_accounts'
  | 'user_performance'
  | 'recent_quotes';

interface DashboardInsightsModalProps {
  panel: DrilldownPanelType;
  targetId?: string;
  targetName?: string;
  onClose: () => void;
  onSelectCostSheet: (id: number) => void;
  dashboardFilterParams: Record<string, string>;
  onApplyFilter?: (key: string, value: string) => void;
}

export const DashboardInsightsModal: React.FC<DashboardInsightsModalProps> = ({
  panel,
  targetId,
  targetName,
  onClose,
  onSelectCostSheet,
  dashboardFilterParams,
  onApplyFilter,
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(dashboardFilterParams);
      params.set('panel', panel);
      if (targetId) params.set('target_id', targetId);
      if (targetName) params.set('target_name', targetName);

      const res = await apiRequest(`/api/reports/drilldown?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load drilldown insights:', err);
      setError(err.message || 'Failed to load panel insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [panel, targetId, targetName]);

  const getPanelIcon = () => {
    switch (panel) {
      case 'gross_deal_value': return <DollarSign className="w-5 h-5 text-blue-600" />;
      case 'net_profit': return <TrendingUp className="w-5 h-5 text-emerald-600" />;
      case 'average_margin': return <Percent className="w-5 h-5 text-indigo-600" />;
      case 'pending_approvals': return <Clock className="w-5 h-5 text-amber-600" />;
      case 'approved_deals': return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'monthly_trend': return <BarChart3 className="w-5 h-5 text-blue-600" />;
      case 'status_distribution': return <PieChart className="w-5 h-5 text-purple-600" />;
      case 'oem_distribution': return <Tag className="w-5 h-5 text-orange-600" />;
      case 'salesperson_performance': return <Users className="w-5 h-5 text-cyan-600" />;
      case 'top_accounts': return <Building2 className="w-5 h-5 text-indigo-600" />;
      case 'draft_deals': return <FileEdit className="w-5 h-5 text-slate-600" />;
      case 'rejected_deals': return <XCircle className="w-5 h-5 text-rose-600" />;
      case 'business_unit_distribution': return <Briefcase className="w-5 h-5 text-indigo-600" />;
      case 'user_performance': return <Users className="w-5 h-5 text-cyan-600" />;
      default: return <Layers className="w-5 h-5 text-slate-600" />;
    }
  };

  const stageNames: { [key: number]: string } = {
    1: 'Finance 1',
    2: 'Presales',
    3: 'Management',
    4: 'Operations',
    5: 'Logistics',
    6: 'Finance 2',
  };

  const filteredSheets = (data?.sheets || []).filter((s: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.cs_number?.toLowerCase().includes(q) ||
      s.account_name?.toLowerCase().includes(q) ||
      s.subject?.toLowerCase().includes(q) ||
      s.salesperson_name?.toLowerCase().includes(q) ||
      s.oem?.toLowerCase().includes(q) ||
      s.status?.toLowerCase().includes(q)
    );
  });

  const exportCurrentTableToCSV = () => {
    if (!filteredSheets || filteredSheets.length === 0) return;
    const headers = ['Cost Sheet No', 'Account', 'Subject', 'Salesperson', 'OEM', 'BU', 'Total Sale (INR)', 'Net Profit (INR)', 'Margin %', 'Stage', 'Status'];
    const rows = filteredSheets.map((s: any) => [
      `"${s.cs_number}"`,
      `"${s.account_name || ''}"`,
      `"${s.subject || ''}"`,
      `"${s.salesperson_name || ''}"`,
      `"${s.oem || ''}"`,
      `"${s.business_unit || ''}"`,
      Number(s.total_sale || 0),
      Number(s.net_profit || 0),
      Number(s.margin_percentage || 0).toFixed(1),
      s.current_stage ? `Stage ${s.current_stage}` : 'Completed',
      s.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `insights_${panel}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              {getPanelIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {data?.title || 'In-Depth Panel Intelligence'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                  Deep Insights
                </span>
                {targetName && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-semibold">
                    {targetName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {data?.subtitle || 'Interactive drilldown, analytical breakdown, and matching quotation directory.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchInsights}
              title="Refresh Insights"
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-xs font-medium">Computing in-depth panel insights & drilldown data...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Primary Aggregate KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Quotes in Scope</span>
                  <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">{data?.total_count || 0}</span>
                  <span className="text-[10px] text-slate-400">Matching active criteria</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Combined Deal Value</span>
                  <span className="text-xl font-extrabold text-blue-700 mt-0.5 block">
                    ₹{Number(data?.total_sale || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] text-slate-400">Total gross sell value</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Net Realized Profit</span>
                  <span className="text-xl font-extrabold text-emerald-600 mt-0.5 block">
                    ₹{Number(data?.total_profit || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[10px] text-slate-400">After purchase costs & charges</span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Weighted Average Margin</span>
                  <span className={`text-xl font-extrabold mt-0.5 block ${
                    Number(data?.avg_margin || 0) >= 18 ? 'text-emerald-600' :
                    Number(data?.avg_margin || 0) >= 10 ? 'text-blue-600' : 'text-amber-600'
                  }`}>
                    {Number(data?.avg_margin || 0).toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-400">Margin yield on revenue</span>
                </div>
              </div>

              {/* Analytical Highlights & Executive Takeaways */}
              {data?.insights_bullets && data.insights_bullets.length > 0 && (
                <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Executive Observations & Key Takeaways</h3>
                  </div>
                  <ul className="space-y-1 text-xs text-blue-950 pl-5 list-disc marker:text-blue-500">
                    {data.insights_bullets.map((bullet: string, idx: number) => (
                      <li key={idx} className="leading-relaxed">{bullet}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Panel-Specific Deep Visualizations & Breakdowns */}
              
              {/* 1. Pending Approvals: Sequential Stage Breakdown */}
              {panel === 'pending_approvals' && data?.stages && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <span>Sequential Approval Pipeline Breakdown</span>
                    <span className="text-[11px] font-normal text-slate-500">6-Stage Validation Flow</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                    {[1, 2, 3, 4, 5, 6].map((stNum) => {
                      const stData = data.stages.find((s: any) => s.stage === stNum) || {
                        stage: stNum,
                        stage_name: stageNames[stNum],
                        count: 0,
                        total_sale: 0,
                        total_profit: 0
                      };
                      const isCongested = stData.count > 0;
                      return (
                        <div 
                          key={stNum} 
                          className={`p-2.5 rounded-xl border transition ${
                            isCongested ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-200 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-600">Stage {stNum}</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                              isCongested ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {stData.count}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-800 truncate mt-1">{stageNames[stNum]}</p>
                          <p className="text-[10px] text-slate-500 mt-1">₹{Number(stData.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Net Profit: Margin Health Tiers */}
              {panel === 'net_profit' && data?.tiers && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Profitability & Margin Health Tiers
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {data.tiers.map((tier: any, idx: number) => {
                      const isHealthy = tier.tier.includes('Healthy');
                      const isThin = tier.tier.includes('Thin');
                      return (
                        <div 
                          key={idx}
                          className={`p-3.5 rounded-xl border ${
                            isHealthy ? 'bg-emerald-50 border-emerald-200' :
                            isThin ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <span className={`text-xs font-bold block ${
                            isHealthy ? 'text-emerald-800' :
                            isThin ? 'text-rose-800' : 'text-blue-800'
                          }`}>
                            {tier.tier}
                          </span>
                          <span className="text-lg font-extrabold text-slate-900 mt-1 block">
                            ₹{Number(tier.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-[11px] text-slate-600 mt-0.5 block">
                            {tier.count} quote{tier.count !== 1 ? 's' : ''} • Deal Value: ₹{Number(tier.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Gross Deal Value: BU & OEM Breakdown */}
              {panel === 'gross_deal_value' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data?.bu_breakdown && (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Business Unit Breakdown</h3>
                      <div className="space-y-1.5">
                        {data.bu_breakdown.map((bu: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                            <span className="font-semibold text-slate-700">{bu.business_unit || 'Enterprise'}</span>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 block">₹{Number(bu.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              <span className="text-[10px] text-slate-400">{bu.count} quotes • {Number(bu.avg_margin).toFixed(1)}% margin</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data?.oem_breakdown && (
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Top OEMs / Brands</h3>
                      <div className="space-y-1.5">
                        {data.oem_breakdown.map((o: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg">
                            <span className="font-semibold text-slate-700">{o.oem}</span>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 block">₹{Number(o.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              <span className="text-[10px] text-slate-400">{o.count} quotes</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. Monthly Trend: Trajectory Table */}
              {panel === 'monthly_trend' && data?.trend_table && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Month-over-Month Velocity Table</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                          <th className="py-2 px-3">Period</th>
                          <th className="py-2 px-3 text-right">Quotes</th>
                          <th className="py-2 px-3 text-right">Gross Deal Value</th>
                          <th className="py-2 px-3 text-right">Net Profit</th>
                          <th className="py-2 px-3 text-center">Avg Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.trend_table.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-800">{row.month_label}</td>
                            <td className="py-2 px-3 text-right text-slate-600">{row.count}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">₹{Number(row.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 px-3 text-right font-semibold text-emerald-600">₹{Number(row.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                                {Number(row.avg_margin).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5. Salesperson Leaderboard Matrix */}
              {panel === 'salesperson_performance' && data?.rep_matrix && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Sales Representative Scorecard</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                          <th className="py-2 px-3">Salesperson</th>
                          <th className="py-2 px-3 text-center">Deals (Appr / Pend)</th>
                          <th className="py-2 px-3 text-right">Total Deal Value</th>
                          <th className="py-2 px-3 text-right">Net Profit</th>
                          <th className="py-2 px-3 text-center">Avg Margin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.rep_matrix.map((r: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-900">{r.salesperson_name}</td>
                            <td className="py-2 px-3 text-center text-slate-600">
                              <span className="font-bold text-slate-800">{r.total_deals}</span>
                              <span className="text-[10px] text-slate-400 ml-1">({r.approved_deals} / {r.pending_deals})</span>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">₹{Number(r.total_deal_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 px-3 text-right font-semibold text-emerald-600">₹{Number(r.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                {Number(r.avg_margin).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. OEM & Brand Matrix */}
              {panel === 'oem_distribution' && data?.oem_matrix && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">OEM & Brand Portfolio Performance</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                          <th className="py-2 px-3">Brand / OEM</th>
                          <th className="py-2 px-3 text-center">Quotes</th>
                          <th className="py-2 px-3 text-right">Total Revenue</th>
                          <th className="py-2 px-3 text-right">Net Profit</th>
                          <th className="py-2 px-3 text-center">Avg Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.oem_matrix.map((om: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-900">{om.oem}</td>
                            <td className="py-2 px-3 text-center text-slate-600">{om.count}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">₹{Number(om.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 px-3 text-right font-semibold text-emerald-600">₹{Number(om.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                                {Number(om.avg_margin).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 7. Key Accounts Matrix */}
              {panel === 'top_accounts' && data?.account_matrix && (
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Enterprise Accounts Portfolio</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                          <th className="py-2 px-3">Client Account</th>
                          <th className="py-2 px-3 text-center">Deals (Approved)</th>
                          <th className="py-2 px-3 text-right">Total Spend</th>
                          <th className="py-2 px-3 text-right">Net Profit</th>
                          <th className="py-2 px-3 text-center">Avg Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.account_matrix.map((acc: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-900">{acc.account_name}</td>
                            <td className="py-2 px-3 text-center text-slate-600">
                              <span className="font-bold text-slate-800">{acc.deal_count}</span>
                              <span className="text-[10px] text-slate-400 ml-1">({acc.approved_count} appr)</span>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">₹{Number(acc.total_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 px-3 text-right font-semibold text-emerald-600">₹{Number(acc.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                {Number(acc.avg_margin).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Quotations Drilldown Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden space-y-0">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Matching Cost Sheets ({filteredSheets.length})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Click any row to open the complete cost sheet, view commercial breakdown, or sign off
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search CS#, account, OEM..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg w-48 sm:w-56 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      onClick={exportCurrentTableToCSV}
                      title="Download as CSV"
                      className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span className="hidden sm:inline">Export</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 sticky top-0 z-10 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">CS Number</th>
                        <th className="py-2.5 px-3">Account & Subject</th>
                        <th className="py-2.5 px-3">Salesperson</th>
                        <th className="py-2.5 px-3">Brand / OEM</th>
                        <th className="py-2.5 px-3 text-right">Sale (₹)</th>
                        <th className="py-2.5 px-3 text-right">Profit (₹)</th>
                        <th className="py-2.5 px-3 text-center">Margin %</th>
                        <th className="py-2.5 px-3 text-center">Stage</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSheets.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                            No cost sheets found matching this insight slice.
                          </td>
                        </tr>
                      ) : (
                        filteredSheets.map((s: any) => {
                          const margin = parseFloat(s.margin_percentage) || 0;
                          return (
                            <tr 
                              key={s.id} 
                              onClick={() => {
                                onClose();
                                onSelectCostSheet(s.id);
                              }}
                              className="hover:bg-blue-50/50 cursor-pointer transition"
                            >
                              <td className="py-2.5 px-3 font-bold text-blue-600 flex items-center gap-1">
                                <span>{s.cs_number}</span>
                                <ArrowUpRight className="w-3 h-3 text-blue-400" />
                              </td>
                              <td className="py-2.5 px-3 max-w-[180px]">
                                <span className="font-semibold text-slate-800 block truncate">{s.account_name || 'Direct'}</span>
                                <span className="text-[10px] text-slate-500 block truncate">{s.subject || 'Standard'}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{s.salesperson_name || 'N/A'}</td>
                              <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{s.oem || 'Mixed'}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                ₹{Number(s.total_sale).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 whitespace-nowrap">
                                ₹{Number(s.net_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  margin >= 18 ? 'bg-emerald-100 text-emerald-800' :
                                  margin >= 10 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {margin.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                                  {s.current_stage ? `${s.current_stage}. ${stageNames[s.current_stage] || ''}` : 'Draft'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  s.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                  s.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                                  s.status === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    onClose();
                                    onSelectCostSheet(s.id);
                                  }}
                                  className="px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition cursor-pointer"
                                >
                                  Open
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
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            SHRO Systems • Real-time Executive Intelligence
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close Insights
          </button>
        </div>

      </div>
    </div>
  );
};
