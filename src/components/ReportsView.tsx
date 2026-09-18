import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Filter, 
  Search, 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  Percent,
  CheckCircle,
  FileDown
} from 'lucide-react';
import { CostSheet, DropdownOptions, User } from '../types.ts';
import { apiRequest } from '../lib/api.ts';

interface ReportsViewProps {
  dropdowns: DropdownOptions;
  salespeople: User[];
  onSelectCostSheet: (id: number) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  dropdowns,
  salespeople,
  onSelectCostSheet,
}) => {
  const [status, setStatus] = useState('All');
  const [businessUnit, setBusinessUnit] = useState('All');
  const [salespersonId, setSalespersonId] = useState('All');
  const [month, setMonth] = useState('All');
  const [financialYear, setFinancialYear] = useState('All');

  const [sheets, setSheets] = useState<CostSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/cost-sheets');
      setSheets(data);
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'All') params.append('status', status);
      if (businessUnit !== 'All') params.append('business_unit', businessUnit);
      if (salespersonId !== 'All') params.append('salesperson_id', salespersonId);
      if (month !== 'All') params.append('month', month);
      if (financialYear !== 'All') params.append('financial_year', financialYear);

      const blob = await apiRequest(`/api/reports/export-excel?${params.toString()}`);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SHRO_Cost_Sheets_Report_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const filtered = sheets.filter((cs) => {
    if (status !== 'All' && cs.status !== status) return false;
    if (businessUnit !== 'All' && cs.business_unit !== businessUnit) return false;
    if (salespersonId !== 'All' && cs.salesperson_id.toString() !== salespersonId) return false;
    if (financialYear !== 'All' && !cs.cs_number.includes(financialYear)) return false;
    if (month !== 'All') {
      const m = new Date(cs.created_at).getMonth() + 1;
      if (m.toString() !== month) return false;
    }
    return true;
  });

  const totalSale = filtered.reduce((acc, curr) => acc + Number(curr.total_sale), 0);
  const totalPurchase = filtered.reduce((acc, curr) => acc + Number(curr.net_purchase), 0);
  const totalProfit = filtered.reduce((acc, curr) => acc + Number(curr.net_profit), 0);
  const avgMargin = totalSale > 0 ? (totalProfit / totalSale) * 100 : 0;

  return (
    <div id="reports-view-container" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Executive Reports & Excel Export</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit profitability reports, deal margin distributions, and download formal spreadsheet archives.
          </p>
        </div>

        {/* Export to Excel (.xlsx) */}
        <button
          id="btn-export-excel"
          onClick={handleExportExcel}
          disabled={exporting}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>{exporting ? 'Generating .xlsx...' : 'Export to Excel (.xlsx)'}</span>
        </button>
      </div>

      {/* Slicers & Summary */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Business Unit</label>
            <select
              value={businessUnit}
              onChange={(e) => setBusinessUnit(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Business Units</option>
              {dropdowns.business_unit.map((bu) => (
                <option key={bu} value={bu}>{bu}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Salesperson</label>
            <select
              value={salespersonId}
              onChange={(e) => setSalespersonId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Salespeople</option>
              {salespeople.map((sp) => (
                <option key={sp.id} value={sp.id.toString()}>{sp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Financial Year</label>
            <select
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Years</option>
              <option value="2026-27">FY 2026-27</option>
              <option value="2025-26">FY 2025-26</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Months</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>
        </div>

        {/* Filtered Summary KPIs */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Filtered Deal Value:</span>
            <span className="text-base font-bold text-slate-900">
              ₹{totalSale.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-slate-500 block text-[11px]">Net Purchase Cost:</span>
            <span className="text-base font-bold text-slate-900">
              ₹{totalPurchase.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
            <span className="text-emerald-700 block text-[11px] font-semibold">Total Net Profit:</span>
            <span className="text-base font-bold text-emerald-700">
              ₹{totalProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
            <span className="text-indigo-700 block text-[11px] font-semibold">Weighted Margin %:</span>
            <span className="text-base font-bold text-indigo-700">
              {avgMargin.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Sheet No</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Rep</th>
                <th className="py-3 px-4">BU & OEM</th>
                <th className="py-3 px-4 text-right">Total Sale</th>
                <th className="py-3 px-4 text-right">Net Profit</th>
                <th className="py-3 px-4 text-right">Margin %</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    Loading report metrics...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No records found for current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((cs) => (
                  <tr
                    key={cs.id}
                    onClick={() => onSelectCostSheet(cs.id)}
                    className="hover:bg-slate-50 transition cursor-pointer"
                  >
                    <td className="py-2.5 px-4 font-bold text-blue-600">{cs.cs_number}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800 truncate max-w-[180px]">{cs.subject}</td>
                    <td className="py-2.5 px-4 text-slate-600 truncate max-w-[140px]">{cs.account_name || 'N/A'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{cs.salesperson_name || 'N/A'}</td>
                    <td className="py-2.5 px-4 text-slate-500">{cs.business_unit} • {cs.oem}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                      ₹{Number(cs.total_sale).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-emerald-600">
                      ₹{Number(cs.net_profit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-800">
                      {Number(cs.margin_percentage).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cs.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                        cs.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                        cs.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {cs.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
