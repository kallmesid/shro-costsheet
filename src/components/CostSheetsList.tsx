import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  FileDown, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ChevronRight,
  UserCheck,
  Building2,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { CostSheet, User, DropdownOptions } from '../types.ts';
import { STAGE_SHORT_NAMES } from '../lib/constants.ts';
import { apiRequest } from '../lib/api.ts';
import { generateCostSheetPDF } from '../lib/pdfGenerator.ts';

interface CostSheetsListProps {
  onSelectCostSheet: (id: number) => void;
  onNewCostSheet: () => void;
  currentUser: User;
  dropdowns: DropdownOptions;
  salespeople: User[];
}

export const CostSheetsList: React.FC<CostSheetsListProps> = ({
  onSelectCostSheet,
  onNewCostSheet,
  currentUser,
  dropdowns,
  salespeople,
}) => {
  const [costSheets, setCostSheets] = useState<CostSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [buFilter, setBuFilter] = useState('All');
  const [salespersonFilter, setSalespersonFilter] = useState('All');
  const [onlyMyPending, setOnlyMyPending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchCostSheets = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/cost-sheets');
      setCostSheets(data);
    } catch (err) {
      console.error('Failed to load cost sheets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostSheets();
  }, []);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiRequest(`/api/cost-sheets/${id}`, { method: 'DELETE' });
      setCostSheets(prev => prev.filter(cs => cs.id !== id));
      setDeletingId(null);
    } catch (err: any) {
      console.error('Failed to delete cost sheet:', err);
      setDeletingId(null);
    }
  };

  const handleDownloadPDF = (cs: CostSheet, e: React.MouseEvent) => {
    e.stopPropagation();
    generateCostSheetPDF(cs);
  };

  // Filter list
  const filtered = costSheets.filter(cs => {
    if (statusFilter !== 'All' && cs.status !== statusFilter) return false;
    if (buFilter !== 'All' && cs.business_unit !== buFilter) return false;
    if (salespersonFilter !== 'All' && cs.salesperson_id.toString() !== salespersonFilter) return false;
    
    if (onlyMyPending) {
      // Must be pending and current stage approver must be current user (or Admin)
      const stageAssigned = cs.assigned_approvers?.[cs.current_stage?.toString()];
      const isMyTurn = cs.status === 'Pending' && (stageAssigned === currentUser.id || currentUser.access_level === 'Admin');
      if (!isMyTurn) return false;
    }

    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchNumber = cs.cs_number?.toLowerCase().includes(q);
      const matchSubject = cs.subject?.toLowerCase().includes(q);
      const matchCustomer = cs.account_name?.toLowerCase().includes(q);
      const matchSales = cs.salesperson_name?.toLowerCase().includes(q);
      if (!matchNumber && !matchSubject && !matchCustomer && !matchSales) return false;
    }

    return true;
  });

  return (
    <div id="cost-sheets-list-view" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">All Quotation Cost Sheets</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage quotations, line profitability, and track multi-stage sequential approvals.
          </p>
        </div>

        <button
          id="btn-create-quote"
          onClick={onNewCostSheet}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Cost Sheet</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Sheet #, Subject, Customer, or Salesperson..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-2.5 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Business Unit Filter */}
          <div>
            <select
              value={buFilter}
              onChange={(e) => setBuFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-2.5 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Business Units</option>
              {dropdowns.business_unit.map(bu => (
                <option key={bu} value={bu}>{bu}</option>
              ))}
            </select>
          </div>

          {/* Salesperson Filter */}
          <div>
            <select
              value={salespersonFilter}
              onChange={(e) => setSalespersonFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-2.5 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Salespeople</option>
              {salespeople.map(sp => (
                <option key={sp.id} value={sp.id.toString()}>{sp.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter: Awaiting My Approval Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyMyPending}
              onChange={(e) => setOnlyMyPending(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span className="font-semibold text-slate-800">
              Show only quotes awaiting my review
            </span>
          </label>

          <span className="text-slate-500">
            Showing <strong>{filtered.length}</strong> of {costSheets.length} quotes
          </span>
        </div>
      </div>

      {/* Cost Sheets Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Sheet Number</th>
                <th className="py-3 px-4 min-w-[220px]">Subject & Customer</th>
                <th className="py-3 px-4 min-w-[180px]">Sequential Progress</th>
                <th className="py-3 px-4 text-right">Deal Value</th>
                <th className="py-3 px-4 text-right">Profit & Margin</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Loading cost sheets from database...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No cost sheets match your current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((cs) => {
                  const stageAssigned = cs.assigned_approvers?.[cs.current_stage?.toString()];
                  const isMyTurn = cs.status === 'Pending' && (stageAssigned === currentUser.id || currentUser.access_level === 'Admin');

                  return (
                    <tr
                      key={cs.id}
                      onClick={() => onSelectCostSheet(cs.id)}
                      className="hover:bg-blue-50/40 transition cursor-pointer group"
                    >
                      {/* Sheet Number & Date */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-blue-600 group-hover:underline">
                            {cs.cs_number}
                          </span>
                          {isMyTurn && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" title="Awaiting your approval" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {new Date(cs.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </td>

                      {/* Subject, Customer, Rep */}
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800 line-clamp-1">{cs.subject}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          <span className="truncate max-w-[130px] font-medium text-slate-700">
                            {cs.account_name || 'Direct Customer'}
                          </span>
                          <span>•</span>
                          <span className="truncate max-w-[100px]">Rep: {cs.salesperson_name || 'N/A'}</span>
                        </div>
                      </td>

                      {/* 6-Stage Progress Stepper Bar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5, 6].map((stg) => {
                            const isDone = cs.status === 'Approved' || (cs.current_stage > stg);
                            const isCurrent = cs.status === 'Pending' && cs.current_stage === stg;
                            const isFailed = cs.status === 'Rejected' && cs.current_stage === stg;

                            let pillBg = 'bg-slate-200 text-slate-400';
                            if (isDone) pillBg = 'bg-emerald-500 text-white';
                            else if (isFailed) pillBg = 'bg-red-500 text-white';
                            else if (isCurrent) pillBg = 'bg-amber-500 text-white animate-pulse';

                            return (
                              <div
                                key={stg}
                                title={`Stage ${stg}: ${STAGE_SHORT_NAMES[stg]}`}
                                className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] ${pillBg}`}
                              >
                                {stg}
                              </div>
                            );
                          })}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-1">
                          {cs.status === 'Approved' ? 'All 6 stages verified' :
                           cs.status === 'Pending' ? `At Stage ${cs.current_stage}: ${STAGE_SHORT_NAMES[cs.current_stage]}` :
                           cs.status === 'Rejected' ? `Rejected at Stage ${cs.current_stage}` :
                           'Drafting'}
                        </span>
                      </td>

                      {/* Total Sale */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₹{Number(cs.total_sale).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Profit & Margin % */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-semibold text-slate-800 block">
                          ₹{Number(cs.net_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                        <span className={`text-[11px] font-bold ${
                          cs.margin_percentage >= 18 ? 'text-emerald-600' :
                          cs.margin_percentage >= 10 ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {Number(cs.margin_percentage).toFixed(2)}%
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cs.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                          cs.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                          cs.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {cs.status === 'Pending' ? `Stage ${cs.current_stage}` : cs.status}
                        </span>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Landscape PDF Button */}
                          <button
                            onClick={(e) => handleDownloadPDF(cs, e)}
                            title="Download Landscape Branded PDF Quotation"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition cursor-pointer"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          {/* Delete (Draft or Admin) */}
                          {(cs.status === 'Draft' || currentUser.access_level === 'Admin') && (
                            deletingId === cs.id ? (
                              <div className="flex items-center gap-1 bg-red-50 p-1 rounded border border-red-200" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(cs.id, e)}
                                  className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                                  className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] hover:bg-slate-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDeletingId(cs.id); }}
                                title="Delete Cost Sheet"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
