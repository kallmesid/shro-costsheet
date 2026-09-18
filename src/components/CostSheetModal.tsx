import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  Save, 
  Send, 
  Printer, 
  FileDown, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  FileText, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  Percent, 
  User as UserIcon, 
  Layers,
  Paperclip,
  ArrowRight,
  ShieldCheck,
  Check,
  Tag,
  TrendingUp
} from 'lucide-react';
import { CostSheet, LineItem, User, Account, DropdownOptions, UploadedFile } from '../types.ts';
import { STAGE_NAMES, STAGE_SHORT_NAMES, STAGE_DESCRIPTIONS } from '../lib/constants.ts';
import { apiRequest } from '../lib/api.ts';
import { generateCostSheetPDF } from '../lib/pdfGenerator.ts';
import { usePdfLineItemImporter } from '../lib/pdfImporterMvp.ts';

interface CostSheetModalProps {
  costSheetId: number | null; // null means create new
  onClose: () => void;
  onSaved: () => void;
  currentUser: User;
  accounts: Account[];
  salespeople: User[];
  dropdowns: DropdownOptions;
  approverCandidates: { [key: number]: User[] };
}

export const CostSheetModal: React.FC<CostSheetModalProps> = ({
  costSheetId,
  onClose,
  onSaved,
  currentUser,
  accounts,
  salespeople,
  dropdowns,
  approverCandidates,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'line_items' | 'workflow' | 'attachments'>('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Workflow Approval Action State
  const [approvalComment, setApprovalComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // File Upload State
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // MVP PDF Importer (Pure client-side, 100% on-device, no AI/cloud dependencies)
  const { parsingPdf, pdfInputRef, importLineItemsFromPDF } = usePdfLineItemImporter(
    (parsedItems) => {
      const existingCount = sheetData.line_items?.length || 0;
      let replace = true;
      if (existingCount > 0) {
        try {
          replace = window.confirm(
            `Detected ${parsedItems.length} line items in the PDF quote.\n\nClick OK to REPLACE the existing ${existingCount} items.\nClick Cancel to APPEND to existing items.`
          );
        } catch {
          replace = true;
        }
      }
      const updatedList = replace ? parsedItems : [...(sheetData.line_items || []), ...parsedItems];
      setSheetData((prev) => ({
        ...prev,
        line_items: updatedList,
      }));
      setSuccessMsg(`Imported ${parsedItems.length} line item(s) from PDF — unit sale price computed as Total ÷ Qty`);
    },
    (errorMsg) => {
      alert(errorMsg);
      setError(errorMsg);
    }
  );

  // PDF Parser Change Event Handler
  const handlePdfParserUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    await importLineItemsFromPDF(file);
    e.target.value = '';
  };

  // Cost Sheet Form State
  const [sheetData, setSheetData] = useState<Partial<CostSheet>>({
    subject: '',
    account_id: accounts[0]?.id || undefined,
    salesperson_id: currentUser.id,
    business_unit: dropdowns.business_unit[0] || 'Enterprise Solutions',
    oem: dropdowns.oem[0] || 'Cisco Systems',
    distributor: dropdowns.distributor[0] || 'Ingram Micro',
    currency: 'INR',
    discount_type: 'Percentage',
    discount_value: 0,
    consultation_charges: 0,
    freight_charges: 0,
    notes: '',
    assigned_approvers: {
      '1': approverCandidates[1]?.[0]?.id || 2,
      '2': approverCandidates[2]?.[0]?.id || 3,
      '3': approverCandidates[3]?.[0]?.id || 4,
      '4': approverCandidates[4]?.[0]?.id || 5,
      '5': approverCandidates[5]?.[0]?.id || 6,
      '6': approverCandidates[6]?.[0]?.id || 7,
    },
    line_items: [],
  });

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [fullCostSheet, setFullCostSheet] = useState<CostSheet | null>(null);

  // Load existing cost sheet if editing
  useEffect(() => {
    if (costSheetId) {
      loadCostSheet(costSheetId);
    }
  }, [costSheetId]);

  const loadCostSheet = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/api/cost-sheets/${id}`);
      setFullCostSheet(data);
      const normalizedItems = (data.line_items || []).map((item: any) => ({
        ...item,
        unit_purchase: Number(item.unit_purchase) || 0,
        unit_sale: Number(item.unit_sale) || 0,
        quantity: Number(item.quantity) || 1,
        total_purchase: Number(item.total_purchase) || 0,
        total_sale: Number(item.total_sale) || 0,
        margin_percentage: Number(item.margin_percentage) || 0,
      }));
      setSheetData({
        ...data,
        discount_value: Number(data.discount_value) || 0,
        consultation_charges: Number(data.consultation_charges) || 0,
        freight_charges: Number(data.freight_charges) || 0,
        assigned_approvers: data.assigned_approvers || {},
        line_items: normalizedItems,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load cost sheet');
    } finally {
      setLoading(false);
    }
  };

  // Recalculate financial figures whenever line items, discounts, or charges change
  const computeTotals = () => {
    const items = sheetData.line_items || [];
    const totalPurchase = items.reduce((sum, item) => sum + (Number(item.total_purchase) || (Number(item.unit_purchase || 0) * Number(item.quantity || 1))), 0);
    const totalSale = items.reduce((sum, item) => sum + (Number(item.total_sale) || (Number(item.unit_sale || 0) * Number(item.quantity || 1))), 0);

    const discType = sheetData.discount_type || 'Percentage';
    const discVal = Number(sheetData.discount_value) || 0;
    let discountAmount = 0;
    if (discType === 'Percentage') {
      discountAmount = totalPurchase * (discVal / 100);
    } else if (discType === 'Value') {
      discountAmount = discVal;
    } else {
      discountAmount = 0;
    }
    discountAmount = Math.min(discountAmount, totalPurchase);
    const afterDiscount = Math.max(0, totalPurchase - discountAmount);

    const consultation = Number(sheetData.consultation_charges) || 0;
    const freight = Number(sheetData.freight_charges) || 0;

    const netPurchase = Math.max(0, afterDiscount + consultation + freight);
    const netProfit = totalSale - netPurchase;
    const marginPercent = totalSale > 0 ? (netProfit / totalSale) * 100 : 0;

    return {
      totalPurchase: Number(totalPurchase) || 0,
      totalSale: Number(totalSale) || 0,
      discountAmount: Number(discountAmount) || 0,
      afterDiscount: Number(afterDiscount) || 0,
      netPurchase: Number(netPurchase) || 0,
      netProfit: Number(netProfit) || 0,
      marginPercent: Number(marginPercent) || 0,
    };
  };

  const totals = computeTotals();

  // Line Item Handlers
  const handleLineItemChange = (index: number, field: keyof LineItem, val: any) => {
    const updated = [...(sheetData.line_items || [])];
    const current = { ...updated[index], [field]: val };

    const qty = Number(field === 'quantity' ? val : current.quantity) || 1;
    const uPur = Number(field === 'unit_purchase' ? val : current.unit_purchase) || 0;
    const uSale = Number(field === 'unit_sale' ? val : current.unit_sale) || 0;

    const totPur = qty * uPur;
    const subTotal = qty * uSale;
    const marginVal = subTotal - totPur;
    const marginPct = subTotal > 0 ? (marginVal / subTotal) * 100 : 0;

    current.total_purchase = totPur;
    current.total_sale = subTotal; // We treat total_sale as sub_total for backwards compatibility and logic
    current.sub_total = subTotal;
    current.margin_value = marginVal;
    current.margin_percentage = parseFloat(marginPct.toFixed(2));

    const taxRateMatch = current.tax_description?.match(/@(\d+(?:\.\d+)?)%/);
    if (taxRateMatch) {
      const rate = parseFloat(taxRateMatch[1]);
      const taxAmt = subTotal * (rate / 100);
      current.tax_description = current.tax_description?.replace(/:\s*[\d,]+\.\d{2}/, `: ${taxAmt.toFixed(2)}`);
      current.total = subTotal + taxAmt;
    } else {
      current.total = subTotal; // Fallback
    }

    updated[index] = current;
    setSheetData({ ...sheetData, line_items: updated });
  };

  const addLineItem = () => {
    const updated = [
      ...(sheetData.line_items || []),
      {
        description: '',
        quantity: 1,
        unit_purchase: 0,
        unit_sale: 0,
        total_purchase: 0,
        total_sale: 0,
        margin_percentage: 0,
        margin_value: 0,
        sub_total: 0,
        total: 0,
      },
    ];
    setSheetData({ ...sheetData, line_items: updated });
  };

  const clearAllLineItems = () => {
    setSheetData((prev) => ({ ...prev, line_items: [] }));
    setShowClearConfirm(false);
  };

  const removeLineItem = (index: number) => {
    const updated = [...(sheetData.line_items || [])];
    updated.splice(index, 1);
    setSheetData({ ...sheetData, line_items: updated });
  };

  // Approver Assignment change
  const handleApproverChange = (stageNumber: number, userId: number) => {
    setSheetData({
      ...sheetData,
      assigned_approvers: {
        ...(sheetData.assigned_approvers || {}),
        [stageNumber.toString()]: userId,
      },
    });
  };

  // Excel Import Handler (.xlsx / .csv)
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rows.length === 0) {
          alert('No data rows found in the uploaded Excel file.');
          return;
        }

        const importedItems: LineItem[] = rows.map((r, idx) => {
          // Normalize column names
          const desc = r.Description || r.Item || r.Product || r.Particulars || `Item #${idx + 1}`;
          const qty = Number(r.Quantity || r.Qty || r.qty || 1);
          const uPur = Number(r['Purchase Price'] || r.UnitPurchase || r.Purchase || r.Cost || 0);
          const uSale = Number(r['Sale Price'] || r.UnitSale || r.Sale || (uPur > 0 ? uPur * 1.25 : 0));

          const totPur = qty * uPur;
          const totSale = qty * uSale;
          const margin = totSale > 0 ? ((totSale - totPur) / totSale) * 100 : 0;

          return {
            description: String(desc),
            quantity: qty > 0 ? qty : 1,
            unit_purchase: uPur,
            unit_sale: uSale,
            total_purchase: totPur,
            total_sale: totSale,
            margin_percentage: parseFloat(margin.toFixed(2)),
            uom: 'Box',
            margin_value: totSale - totPur,
            sub_total: totSale,
            total: totSale,
          };
        });

        setSheetData({
          ...sheetData,
          line_items: [...(sheetData.line_items || []), ...importedItems],
        });
        setSuccessMsg(`Successfully imported ${importedItems.length} line items from Excel!`);
      } catch (err: any) {
        alert('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Attachment Upload Handler
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fullCostSheet?.id) {
      alert('Please save the cost sheet first before adding attachments.');
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cost_sheet_id', fullCostSheet.id.toString());

      const res = await apiRequest('/api/uploads/attachment', {
        method: 'POST',
        body: formData,
      });

      setSuccessMsg('Attachment uploaded successfully!');
      // Refresh sheet to update files list
      loadCostSheet(fullCostSheet.id);
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = async (fileId: number, fileName: string) => {
    setDeletingAttachmentId(fileId);
    try {
      await apiRequest(`/api/uploads/attachment/${fileId}`, {
        method: 'DELETE',
      });
      setSuccessMsg(`Attachment "${fileName}" deleted successfully.`);
      if (fullCostSheet?.id) {
        loadCostSheet(fullCostSheet.id);
      }
    } catch (err: any) {
      setError('Failed to delete attachment: ' + err.message);
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  // Save Cost Sheet (Draft or Update)
  const handleSave = async (submitNow = false) => {
    setSaving(true);
    setError(null);
    try {
      let savedId = costSheetId;

      if (!sheetData.subject || sheetData.subject.trim() === '') {
        throw new Error('Deal subject is required.');
      }

      if (costSheetId) {
        // Update existing
        await apiRequest(`/api/cost-sheets/${costSheetId}`, {
          method: 'PUT',
          body: JSON.stringify(sheetData),
        });
      } else {
        // Create new
        const created = await apiRequest('/api/cost-sheets', {
          method: 'POST',
          body: JSON.stringify(sheetData),
        });
        savedId = created.id;
      }

      if (submitNow && savedId) {
        setSubmitting(true);
        await apiRequest(`/api/cost-sheets/${savedId}/submit`, {
          method: 'POST',
        });
      }

      setSuccessMsg(submitNow ? 'Cost sheet submitted for approval!' : 'Cost sheet saved successfully!');
      setTimeout(() => {
        onSaved();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to save cost sheet');
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  // Approve Workflow Stage
  const handleApprove = async () => {
    if (!fullCostSheet) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/cost-sheets/${fullCostSheet.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment: approvalComment }),
      });
      setApprovalComment('');
      setSuccessMsg(`Stage ${fullCostSheet.current_stage} approved successfully!`);
      loadCostSheet(fullCostSheet.id);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to approve stage');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Workflow Stage
  const handleReject = async () => {
    if (!fullCostSheet) return;
    if (!approvalComment.trim()) {
      setError('Please provide a reason / comment for rejecting the sheet.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/cost-sheets/${fullCostSheet.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment: approvalComment }),
      });
      setApprovalComment('');
      setSuccessMsg('Cost sheet has been rejected.');
      loadCostSheet(fullCostSheet.id);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to reject stage');
    } finally {
      setActionLoading(false);
    }
  };

  // Check if current user can approve current stage
  const currentStage = fullCostSheet?.current_stage || 1;
  const assignedForCurrent = fullCostSheet?.assigned_approvers?.[currentStage.toString()];
  const canApprove = 
    fullCostSheet?.status === 'Pending' && 
    (currentUser.access_level === 'Admin' || assignedForCurrent === currentUser.id);

  return (
    <div id="cost-sheet-modal-backdrop" className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div id="cost-sheet-modal-container" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {fullCostSheet ? `Cost Sheet: ${fullCostSheet.cs_number}` : 'New Quotation Cost Sheet'}
                </h2>
                {fullCostSheet && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    fullCostSheet.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                    fullCostSheet.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                    fullCostSheet.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {fullCostSheet.status === 'Pending' ? `Stage ${fullCostSheet.current_stage}: Pending` : fullCostSheet.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {sheetData.subject || 'Draft quotation and sequential margin routing'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Generate Branded Landscape PDF */}
            {fullCostSheet && (
              <button
                id="generate-pdf-modal-button"
                onClick={() => generateCostSheetPDF(fullCostSheet)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Download Landscape Branded PDF Quotation"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
                <span>Download PDF</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (3 Main Tabs + Attachments) */}
        <div className="px-6 border-b border-slate-200 bg-white flex gap-6">
          <button
            id="tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Deal Overview & Approvers</span>
          </button>

          <button
            id="tab-line-items"
            onClick={() => setActiveTab('line_items')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'line_items'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>2. Line Items & Profitability</span>
            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-full text-[10px]">
              {sheetData.line_items?.length || 0}
            </span>
          </button>

          <button
            id="tab-workflow"
            onClick={() => setActiveTab('workflow')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'workflow'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>3. Sequential Approval (6 Stages)</span>
            {canApprove && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>

          <button
            id="tab-attachments"
            onClick={() => setActiveTab('attachments')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'attachments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>4. Attachments</span>
            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-full text-[10px]">
              {fullCostSheet?.files?.length || 0}
            </span>
          </button>
        </div>

        {/* Notification Banners */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500">Loading cost sheet details...</div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Deal Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Subject */}
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Deal Subject / Project Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={sheetData.subject || ''}
                        onChange={(e) => setSheetData({ ...sheetData, subject: e.target.value })}
                        placeholder="e.g. Cisco Enterprise Core Switch Refresh & Firewall Setup"
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Customer Account */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Customer Account *
                      </label>
                      <select
                        value={sheetData.account_id || ''}
                        onChange={(e) => setSheetData({ ...sheetData, account_id: parseInt(e.target.value, 10) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.industry || 'General'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Salesperson */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Sales Representative
                      </label>
                      <select
                        value={sheetData.salesperson_id || ''}
                        onChange={(e) => setSheetData({ ...sheetData, salesperson_id: parseInt(e.target.value, 10) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {salespeople.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} ({sp.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Business Unit */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Business Unit
                      </label>
                      <select
                        value={sheetData.business_unit || ''}
                        onChange={(e) => setSheetData({ ...sheetData, business_unit: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {dropdowns.business_unit.map((bu) => (
                          <option key={bu} value={bu}>{bu}</option>
                        ))}
                      </select>
                    </div>

                    {/* OEM */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        OEM
                      </label>
                      <select
                        value={sheetData.oem || ''}
                        onChange={(e) => setSheetData({ ...sheetData, oem: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {dropdowns.oem.map((oem) => (
                          <option key={oem} value={oem}>{oem}</option>
                        ))}
                      </select>
                    </div>

                    {/* Distributor */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Distributor
                      </label>
                      <select
                        value={sheetData.distributor || ''}
                        onChange={(e) => setSheetData({ ...sheetData, distributor: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {dropdowns.distributor.map((dist) => (
                          <option key={dist} value={dist}>{dist}</option>
                        ))}
                      </select>
                    </div>

                    {/* Currency */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={sheetData.currency || 'INR'}
                        onChange={(e) => setSheetData({ ...sheetData, currency: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="INR">INR (₹ - Indian Rupee)</option>
                        <option value="USD">USD ($ - US Dollar)</option>
                        <option value="EUR">EUR (€ - Euro)</option>
                      </select>
                    </div>

                    {/* Notes / Special Terms */}
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Internal Notes & Commercial Observations
                      </label>
                      <textarea
                        rows={2}
                        value={sheetData.notes || ''}
                        onChange={(e) => setSheetData({ ...sheetData, notes: e.target.value })}
                        placeholder="Payment terms, special vendor discounts, warranty terms or delivery lead times..."
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* 6-Stage Approver Selection Grid */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="mb-3">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Assigned Approvers for 6-Stage Sequential Chain
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Designate specific stage reviewers. Stages will be activated sequentially from Stage 1 to 6.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((stageNum) => {
                        const candidates = approverCandidates[stageNum] || [];
                        const currentAssigned = sheetData.assigned_approvers?.[stageNum.toString()];

                        return (
                          <div key={stageNum} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                                Stage {stageNum}
                              </span>
                              <span className="text-xs font-semibold text-slate-800">
                                {STAGE_SHORT_NAMES[stageNum]}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1">
                              {STAGE_DESCRIPTIONS[stageNum]}
                            </p>
                            <select
                              value={currentAssigned || ''}
                              onChange={(e) => handleApproverChange(stageNum, parseInt(e.target.value, 10))}
                              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500"
                            >
                              {candidates.length === 0 ? (
                                <option value="">No users found</option>
                              ) : (
                                candidates.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} ({u.role} - {u.access_level})
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LINE ITEMS & PROFITABILITY */}
              {activeTab === 'line_items' && (
                <div className="space-y-6">
                  {/* Actions Header: Add Product, Excel Import, PDF Parser, Delete All */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addLineItem}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Line Item</span>
                      </button>

                      {/* Excel Import */}
                      <button
                        onClick={() => excelInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title="Import Line Items from .xlsx or .csv"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Import Excel</span>
                      </button>
                      <input
                        ref={excelInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleExcelImport}
                      />

                      {/* PDF Line Item Importer */}
                      <button
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={parsingPdf}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        title="Upload Vendor PDF Quote to parse Line Items"
                      >
                        <FileText className="w-3.5 h-3.5 text-purple-600" />
                        <span>{parsingPdf ? 'Parsing PDF Lines...' : 'PDF Line Item Importer'}</span>
                      </button>
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handlePdfParserUpload}
                      />

                      {/* Delete All Line Items */}
                      {sheetData.line_items && sheetData.line_items.length > 0 && (
                        showClearConfirm ? (
                          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                            <span className="text-xs text-red-700 font-medium">Delete all {sheetData.line_items.length} items?</span>
                            <button
                              type="button"
                              id="btn-confirm-delete-all-items"
                              onClick={clearAllLineItems}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold transition cursor-pointer shadow-sm"
                            >
                              Yes, Delete All
                            </button>
                            <button
                              type="button"
                              id="btn-cancel-delete-all-items"
                              onClick={() => setShowClearConfirm(false)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs font-medium transition cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id="btn-delete-all-items"
                            onClick={() => setShowClearConfirm(true)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                            title="Delete all line items"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            <span>Delete All Items</span>
                          </button>
                        )
                      )}
                    </div>

                    <span className="text-xs text-slate-500">
                      Total Items: <strong>{sheetData.line_items?.length || 0}</strong>
                    </span>
                  </div>

                  {/* Line Items Table or Empty State */}
                  {(!sheetData.line_items || sheetData.line_items.length === 0) ? (
                    <div className="py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                      <p className="text-slate-700 font-semibold text-xs">No line items in this cost sheet</p>
                      <p className="text-slate-500 text-[11px] mt-1 max-w-md mx-auto">
                        Click <strong>Add Line Item</strong> to add items manually, or click <strong>PDF Line Item Importer</strong> to automatically import line items and pricing directly from a vendor PDF quotation.
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <button
                          onClick={addLineItem}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add First Item</span>
                        </button>
                        <button
                          onClick={() => pdfInputRef.current?.click()}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-purple-600" />
                          <span>Import from PDF</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-800 text-white font-semibold">
                            <th className="p-2.5 w-10 text-center">Sr</th>
                            <th className="p-2.5 min-w-[180px]">Description</th>
                            <th className="p-2.5 w-28 text-right">Purchase Price (₹)</th>
                            <th className="p-2.5 w-16 text-center">Qty</th>
                            <th className="p-2.5 w-20 text-center">UOM</th>
                            <th className="p-2.5 w-20 text-center">Margin %</th>
                            <th className="p-2.5 w-28 text-right">Margin Value (₹)</th>
                            <th className="p-2.5 w-28 text-right">Sales Price (₹)</th>
                            <th className="p-2.5 w-28 text-right">Sub-Total (₹)</th>
                            <th className="p-2.5 w-36">Tax</th>
                            <th className="p-2.5 w-28 text-right">Total (₹)</th>
                            <th className="p-2.5 w-10 text-center">Del</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sheetData.line_items.map((item, idx) => {
                            const marginNum = Number(item.margin_percentage) || 0;
                            const marginClass =
                              marginNum >= 15
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : marginNum >= 8
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200';

                            const itemUnitPur = Number(item.unit_purchase) || 0;
                            const itemUnitSale = Number(item.unit_sale) || 0;
                            const itemQty = Number(item.quantity) || 1;
                            const itemTotPur = Number(item.total_purchase) || (itemUnitPur * itemQty);
                            const itemSubTot = Number(item.sub_total || item.total_sale) || (itemUnitSale * itemQty);
                            const itemMarginVal = Number(item.margin_value) || (itemSubTot - itemTotPur);
                            const itemTotal = Number(item.total) || itemSubTot;

                            return (
                              <tr key={idx} className="hover:bg-slate-50 transition">
                                <td className="p-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                                <td className="p-2">
                                  <textarea
                                    rows={2}
                                    placeholder="Item description & part code"
                                    value={item.description || ''}
                                    onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                                    className="w-full text-xs bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none p-1 font-medium resize-y"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={item.unit_purchase !== undefined && item.unit_purchase !== null ? item.unit_purchase : ''}
                                    onChange={(e) => handleLineItemChange(idx, 'unit_purchase', parseFloat(e.target.value) || 0)}
                                    className="w-full text-xs text-right bg-white border border-slate-200 rounded p-1.5 focus:border-blue-500 focus:outline-none font-medium"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={1}
                                    placeholder="1"
                                    value={item.quantity !== undefined && item.quantity !== null ? item.quantity : 1}
                                    onChange={(e) => handleLineItemChange(idx, 'quantity', parseFloat(e.target.value) || 1)}
                                    className="w-full text-xs text-center bg-white border border-slate-200 rounded p-1.5 focus:border-blue-500 focus:outline-none font-semibold"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    placeholder="Box / Each"
                                    value={item.uom || 'Box'}
                                    onChange={(e) => handleLineItemChange(idx, 'uom', e.target.value)}
                                    className="w-full text-xs text-center bg-white border border-slate-200 rounded p-1.5 focus:border-blue-500 focus:outline-none font-medium"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded border ${marginClass}`}>
                                    {marginNum.toFixed(2)}%
                                  </span>
                                </td>
                                <td className="p-2 text-right font-medium text-slate-700">
                                  ₹{itemMarginVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={item.unit_sale !== undefined && item.unit_sale !== null ? item.unit_sale : ''}
                                    onChange={(e) => handleLineItemChange(idx, 'unit_sale', parseFloat(e.target.value) || 0)}
                                    className="w-full text-xs text-right bg-white border border-slate-200 rounded p-1.5 focus:border-blue-500 focus:outline-none font-medium text-blue-700"
                                  />
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-800">
                                  ₹{itemSubTot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    placeholder="CGST @9%: 0.00"
                                    value={item.tax_description || ''}
                                    onChange={(e) => handleLineItemChange(idx, 'tax_description', e.target.value)}
                                    className="w-full text-xs bg-white border border-slate-200 rounded p-1.5 focus:border-blue-500 focus:outline-none font-medium text-slate-600"
                                  />
                                </td>
                                <td className="p-2 text-right font-bold text-slate-900">
                                  ₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    onClick={() => removeLineItem(idx)}
                                    className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                                    title="Remove item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* DISCOUNT SECTION */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      <span>Overall Discount (on Purchase Price)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Discount Type</label>
                        <select
                          value={sheetData.discount_type || 'Percentage'}
                          onChange={(e) => setSheetData({ ...sheetData, discount_type: e.target.value as any })}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="none">No Discount</option>
                          <option value="Percentage">Percentage (%)</option>
                          <option value="Value">Fixed Value (₹)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Discount Value</label>
                        <input
                          type="number"
                          min={0}
                          value={sheetData.discount_value || 0}
                          onChange={(e) => setSheetData({ ...sheetData, discount_value: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-right focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Discount Amount (₹)</label>
                        <div className="w-full text-xs bg-red-50 border border-red-200 text-red-600 font-bold rounded-lg p-2 text-right">
                          -₹{totals.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Net Purchase After Discount (₹)</label>
                        <div className="w-full text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-lg p-2 text-right">
                          ₹{totals.afterDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Consultation Charges (₹) — added after discount</label>
                        <input
                          type="number"
                          min={0}
                          value={sheetData.consultation_charges || 0}
                          onChange={(e) => setSheetData({ ...sheetData, consultation_charges: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-right focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Freight Charges (₹)</label>
                        <input
                          type="number"
                          min={0}
                          value={sheetData.freight_charges || 0}
                          onChange={(e) => setSheetData({ ...sheetData, freight_charges: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-right focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SUMMARY TOTALS */}
                  <div className="flex justify-end">
                    <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Total Purchase</span>
                        <span className="font-semibold text-slate-900">₹{totals.totalPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Discount on Purchase</span>
                        <span className="font-semibold text-red-600">-₹{totals.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Consultation Charges</span>
                        <span className="font-semibold text-slate-900">+₹{(sheetData.consultation_charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Freight Charges</span>
                        <span className="font-semibold text-slate-900">+₹{(sheetData.freight_charges || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 px-2.5 bg-slate-50 rounded-lg font-bold border border-slate-200">
                        <span className="text-slate-800">Final Purchase</span>
                        <span className="text-amber-700">₹{totals.netPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-600">Total Selling</span>
                        <span className="font-semibold text-blue-700">₹{totals.totalSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-2 px-2.5 bg-emerald-50 rounded-lg font-bold border border-emerald-200 text-emerald-800">
                        <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Overall Margin</span>
                        <span className="text-base text-emerald-700">₹{totals.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between py-1.5 px-2.5 bg-emerald-100/60 rounded-lg font-bold text-emerald-900">
                        <span className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5 text-emerald-600" /> Overall Margin %</span>
                        <span className="text-emerald-700">{totals.marginPercent.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: WORKFLOW & COMMENTS */}
              {activeTab === 'workflow' && (
                <div className="space-y-6">
                  {/* 6-Stage Visual Stepper */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                      Sequential Approval Stepper (Stage 1 to 6)
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((stg) => {
                        const log = fullCostSheet?.approval_logs?.find((l) => l.stage_number === stg);
                        const isApproved = log?.decision === 'Approved';
                        const isRejected = log?.decision === 'Rejected';
                        const isCurrent = fullCostSheet?.current_stage === stg && fullCostSheet?.status === 'Pending';
                        const isPendingFuture = (fullCostSheet?.current_stage || 1) < stg;

                        return (
                          <div
                            key={stg}
                            className={`p-3 rounded-xl border text-xs transition relative ${
                              isApproved ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900' :
                              isRejected ? 'bg-red-50/80 border-red-300 text-red-900' :
                              isCurrent ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-400/40' :
                              'bg-white border-slate-200 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-white border">
                                {stg}
                              </span>
                              {isApproved && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                              {isRejected && <XCircle className="w-4 h-4 text-red-600" />}
                              {isCurrent && <Clock className="w-4 h-4 text-amber-600 animate-spin" />}
                            </div>

                            <p className="font-bold text-xs">{STAGE_SHORT_NAMES[stg]}</p>
                            <p className="text-[10px] mt-0.5 opacity-80">
                              {isApproved ? `Approved on ${new Date(log!.timestamp).toLocaleDateString('en-GB')}` :
                               isRejected ? `Rejected` :
                               isCurrent ? `Awaiting Review` :
                               `Upcoming Stage`}
                            </p>

                            {log && (
                              <p className="text-[10px] font-semibold mt-1">
                                By: {log.actor_name || 'Reviewer'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Reviewer Approval / Rejection Action Card */}
                  {canApprove && (
                    <div id="reviewer-action-box" className="p-5 bg-blue-50 border-2 border-blue-400 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                        <span>Action Required: You are the assigned reviewer for Stage {currentStage} ({STAGE_NAMES[currentStage]})</span>
                      </div>
                      <p className="text-xs text-blue-700">
                        Please review deal profitability, line items, and terms. You may approve the quote to advance to the next sequential stage, or reject it back to the initiator.
                      </p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Reviewer Remarks / Feedback (Required if rejecting)
                        </label>
                        <textarea
                          rows={2}
                          value={approvalComment}
                          onChange={(e) => setApprovalComment(e.target.value)}
                          placeholder="Provide approval comments, margin sign-off notes, or rejection reasons..."
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          id="btn-approve-stage"
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{actionLoading ? 'Processing...' : `Approve Stage ${currentStage}`}</span>
                        </button>

                        <button
                          id="btn-reject-stage"
                          onClick={handleReject}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>{actionLoading ? 'Processing...' : 'Reject Cost Sheet'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Chronological Approval Logs Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Approval & Review Audit Trail
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold">
                            <th className="p-2.5">Timestamp</th>
                            <th className="p-2.5">Stage</th>
                            <th className="p-2.5">Reviewer</th>
                            <th className="p-2.5">Decision</th>
                            <th className="p-2.5">Comments</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {fullCostSheet?.approval_logs?.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-400">
                                No review actions have been recorded yet.
                              </td>
                            </tr>
                          ) : (
                            fullCostSheet?.approval_logs?.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-500 whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleString('en-GB')}
                                </td>
                                <td className="p-2.5 font-bold text-slate-800">
                                  Stage {log.stage_number}: {log.stage_name}
                                </td>
                                <td className="p-2.5 font-medium text-slate-700">
                                  {log.actor_name} ({log.actor_role})
                                </td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    log.decision === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {log.decision}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-600 italic">
                                  {log.comment || 'No comment recorded'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ATTACHMENTS */}
              {activeTab === 'attachments' && (
                <div className="space-y-6">
                  <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-slate-800">Upload Deal Documentation</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                      Attach vendor quotations, customer specifications, POs, or scope of work (PDF, DOCX, XLSX). Files are safely stored to `./uploads/`.
                    </p>

                    <button
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={uploadingAttachment}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{uploadingAttachment ? 'Uploading to server...' : 'Choose File to Attach'}</span>
                    </button>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleAttachmentUpload}
                    />
                  </div>

                  {/* Uploaded Files Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Attached Documents ({fullCostSheet?.files?.length || 0})
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold">
                            <th className="p-2.5">File Name</th>
                            <th className="p-2.5">Size</th>
                            <th className="p-2.5">Uploaded Date</th>
                            <th className="p-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(!fullCostSheet?.files || fullCostSheet.files.length === 0) ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400">
                                No attachments uploaded yet.
                              </td>
                            </tr>
                          ) : (
                            fullCostSheet.files.map((f) => (
                              <tr key={f.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-medium text-slate-800 flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                  <span className="truncate max-w-sm">{f.original_name}</span>
                                </td>
                                <td className="p-2.5 text-slate-500">
                                  {(f.file_size / 1024).toFixed(1)} KB
                                </td>
                                <td className="p-2.5 text-slate-500">
                                  {new Date(f.uploaded_at).toLocaleDateString('en-GB')}
                                </td>
                                <td className="p-2.5 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    <a
                                      href={f.file_path}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded font-semibold text-xs transition"
                                    >
                                      View / Download
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAttachment(f.id, f.original_name)}
                                      disabled={deletingAttachmentId === f.id}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                      title={`Delete ${f.original_name}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {fullCostSheet?.status ? `Status: ${fullCostSheet.status}` : 'Status: New Draft'}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>

            {/* Save Draft */}
            <button
              id="save-draft-button"
              onClick={() => handleSave(false)}
              disabled={saving || submitting}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-slate-600" />
              <span>{saving ? 'Saving...' : 'Save Draft'}</span>
            </button>

            {/* Submit for Approval */}
            {(!fullCostSheet || fullCostSheet.status === 'Draft' || fullCostSheet.status === 'Rejected') && (
              <button
                id="submit-approval-button"
                onClick={() => handleSave(true)}
                disabled={saving || submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Submitting...' : 'Submit to Sequential Workflow'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
