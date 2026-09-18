import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  User as UserIcon, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  FileText,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Account, AccountContact } from '../types.ts';
import { apiRequest } from '../lib/api.ts';

interface AccountsViewProps {
  onSelectCostSheet: (id: number) => void;
}

interface ParsedImportAccount {
  name: string;
  industry: string;
  phone: string;
  email: string;
  comments: string;
  contacts: AccountContact[];
}

export const AccountsView: React.FC<AccountsViewProps> = ({ onSelectCostSheet }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Excel Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ParsedImportAccount[]>([]);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/accounts');
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenCreate = () => {
    setEditingAccount({
      name: '',
      industry: 'IT & ITES',
      phone: '',
      email: '',
      comments: '',
      contacts: [
        { name: '', designation: 'Procurement Manager', phone: '', email: '' }
      ]
    });
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount({
      ...acc,
      contacts: acc.contacts && acc.contacts.length > 0 ? acc.contacts : [
        { name: '', designation: '', phone: '', email: '' }
      ]
    });
    setError(null);
    setShowModal(true);
  };

  const handleAddContact = () => {
    if (!editingAccount) return;
    setEditingAccount({
      ...editingAccount,
      contacts: [
        ...(editingAccount.contacts || []),
        { name: '', designation: '', phone: '', email: '' }
      ]
    });
  };

  const handleRemoveContact = (index: number) => {
    if (!editingAccount?.contacts) return;
    const updated = [...editingAccount.contacts];
    updated.splice(index, 1);
    setEditingAccount({ ...editingAccount, contacts: updated });
  };

  const handleContactChange = (index: number, field: keyof AccountContact, val: string) => {
    if (!editingAccount?.contacts) return;
    const updated = [...editingAccount.contacts];
    updated[index] = { ...updated[index], [field]: val };
    setEditingAccount({ ...editingAccount, contacts: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount?.name?.trim()) {
      setError('Account name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingAccount.id) {
        await apiRequest(`/api/accounts/${editingAccount.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingAccount),
        });
      } else {
        await apiRequest('/api/accounts', {
          method: 'POST',
          body: JSON.stringify(editingAccount),
        });
      }
      setShowModal(false);
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this customer account?')) return;
    try {
      await apiRequest(`/api/accounts/${id}`, { method: 'DELETE' });
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  };

  // Download Sample Excel Template
  const handleDownloadSampleTemplate = () => {
    const sampleRows = [
      {
        'Account Name': 'Tata Consultancy Services',
        'Industry': 'IT & ITES',
        'Company Phone': '+91 22 6778 9999',
        'Billing Email': 'procurement@tcs.com',
        'Contact Person': 'Rajesh Sharma',
        'Contact Designation': 'Head of Infrastructure',
        'Contact Phone': '+91 98200 11223',
        'Contact Email': 'rajesh.sharma@tcs.com',
        'Remarks': 'Tier 1 Enterprise client - Net 45 days payment terms'
      },
      {
        'Account Name': 'Infosys Limited',
        'Industry': 'Software & Cloud',
        'Company Phone': '+91 80 2852 0261',
        'Billing Email': 'it-vendor@infosys.com',
        'Contact Person': 'Pooja Verma',
        'Contact Designation': 'Senior Procurement Lead',
        'Contact Phone': '+91 98450 33445',
        'Contact Email': 'pooja.verma@infosys.com',
        'Remarks': 'Quarterly datacenter refresh partner'
      },
      {
        'Account Name': 'HDFC Bank',
        'Industry': 'Banking & Financial Services',
        'Company Phone': '+91 22 2498 8484',
        'Billing Email': 'network-orders@hdfcbank.com',
        'Contact Person': 'Amit Kulkarni',
        'Contact Designation': 'VP Cybersecurity Infrastructure',
        'Contact Phone': '+91 98210 55667',
        'Contact Email': 'amit.k@hdfcbank.com',
        'Remarks': 'Critical security hardware requirement - High priority sign-offs'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts_Template');
    XLSX.writeFile(workbook, 'SHRO_Accounts_Import_Template.xlsx');
  };

  // Handle Excel File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          setImportError('The selected spreadsheet appears to be empty.');
          setImportPreview([]);
          return;
        }

        // Map columns flexibly
        const parsedAccounts: ParsedImportAccount[] = [];

        rawJson.forEach((row: any) => {
          // Find key for account name
          const nameKey = Object.keys(row).find(k => 
            /account\s*name|company\s*name|customer\s*name|client\s*name|^name$/i.test(k.trim())
          );
          const name = nameKey ? String(row[nameKey]).trim() : '';

          if (!name) return; // skip empty rows

          // Find industry
          const industryKey = Object.keys(row).find(k => /industry|sector|vertical/i.test(k.trim()));
          const industry = industryKey ? String(row[industryKey]).trim() : 'IT & ITES';

          // Find phone
          const phoneKey = Object.keys(row).find(k => /company\s*phone|main\s*phone|^phone$|^telephone$/i.test(k.trim()));
          const phone = phoneKey ? String(row[phoneKey]).trim() : '';

          // Find billing email
          const emailKey = Object.keys(row).find(k => /billing\s*email|company\s*email|official\s*email|^email$/i.test(k.trim()));
          const email = emailKey ? String(row[emailKey]).trim() : '';

          // Find remarks / comments
          const remarksKey = Object.keys(row).find(k => /remark|comment|note/i.test(k.trim()));
          const comments = remarksKey ? String(row[remarksKey]).trim() : '';

          // Contacts
          const contactPersonKey = Object.keys(row).find(k => /contact\s*person|contact\s*name|^contact$/i.test(k.trim()));
          const contactPerson = contactPersonKey ? String(row[contactPersonKey]).trim() : '';

          const contactDesigKey = Object.keys(row).find(k => /designation|title|role/i.test(k.trim()));
          const contactDesignation = contactDesigKey ? String(row[contactDesigKey]).trim() : 'Procurement Manager';

          const contactPhoneKey = Object.keys(row).find(k => /contact\s*phone|mobile/i.test(k.trim()));
          const contactPhone = contactPhoneKey ? String(row[contactPhoneKey]).trim() : '';

          const contactEmailKey = Object.keys(row).find(k => /contact\s*email/i.test(k.trim()));
          const contactEmail = contactEmailKey ? String(row[contactEmailKey]).trim() : '';

          const contacts: AccountContact[] = [];
          if (contactPerson) {
            contacts.push({
              name: contactPerson,
              designation: contactDesignation,
              phone: contactPhone,
              email: contactEmail,
            });
          }

          parsedAccounts.push({
            name,
            industry,
            phone,
            email,
            comments,
            contacts,
          });
        });

        if (parsedAccounts.length === 0) {
          setImportError('Could not find any valid account names in the sheet. Please verify the header columns.');
        } else {
          setImportPreview(parsedAccounts);
        }
      } catch (err: any) {
        console.error('Error parsing Excel file:', err);
        setImportError('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit Batch Import
  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const response = await apiRequest('/api/accounts/batch', {
        method: 'POST',
        body: JSON.stringify({ accounts: importPreview }),
      });

      setImportSuccess(response.message || `Successfully imported ${importPreview.length} accounts!`);
      fetchAccounts();
      setTimeout(() => {
        setShowImportModal(false);
        setImportPreview([]);
        setImportFileName(null);
        setImportSuccess(null);
      }, 2500);
    } catch (err: any) {
      setImportError(err.message || 'Failed to complete batch import');
    } finally {
      setImporting(false);
    }
  };

  const filtered = accounts.filter(a => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.industry?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div id="accounts-view-container" className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with Add & Import Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider">
              Client Directory
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
              {accounts.length} Total Accounts
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Customer Accounts & Contacts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise clients, multi-contact stakeholders, and commercial quotation associations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          {/* Import from Excel Button */}
          <button
            id="btn-import-accounts-excel"
            onClick={() => {
              setImportPreview([]);
              setImportFileName(null);
              setImportError(null);
              setImportSuccess(null);
              setShowImportModal(true);
            }}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import from Excel</span>
          </button>

          {/* Add Account Button */}
          <button
            id="btn-add-account"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search accounts by name, industry, or email..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
          Loading accounts directory...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
          No customer accounts found. Click &quot;Add Account&quot; or &quot;Import from Excel&quot; to populate your client database.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((acc) => (
            <div
              key={acc.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">{acc.name}</h3>
                      <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
                        {acc.industry || 'General Industry'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                      title="Edit Account"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Account Details */}
                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  {acc.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{acc.phone}</span>
                    </div>
                  )}
                  {acc.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{acc.email}</span>
                    </div>
                  )}
                  {acc.comments && (
                    <p className="text-[11px] text-slate-500 italic mt-2 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      &ldquo;{acc.comments}&rdquo;
                    </p>
                  )}
                </div>

                {/* Stakeholder Contacts */}
                {acc.contacts && acc.contacts.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Key Contacts ({acc.contacts.length})
                    </p>
                    <div className="space-y-1.5">
                      {acc.contacts.map((c, i) => (
                        <div key={i} className="text-xs bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <p className="font-semibold text-slate-800">{c.name}</p>
                          <p className="text-[10px] text-slate-500">{c.designation || 'Contact'} • {c.phone || c.email || 'No phone'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Excel Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Batch Import Accounts from Excel / CSV</h3>
                  <p className="text-[11px] text-slate-500">Upload existing enterprise accounts spreadsheet</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Template Download Prompt */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-blue-900">Need the standardized format?</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    Download our sample Excel template pre-populated with required headers (Account Name, Industry, Contacts, etc.)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="px-3 py-2 bg-white text-blue-700 hover:bg-blue-100/50 border border-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer transition"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Drag and Drop / File Input Box */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50 hover:bg-emerald-50/30 group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                />
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/60 text-emerald-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {importFileName ? `Selected: ${importFileName}` : 'Click to select or drag and drop your spreadsheet here'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports .xlsx, .xls, and .csv files
                </p>
              </div>

              {/* Status messages */}
              {importError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}

              {/* Parsed Preview Table */}
              {importPreview.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Parsed Preview ({importPreview.length} Accounts Found)</span>
                    </span>
                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                      Ready to batch import
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3">Account Name</th>
                          <th className="py-2.5 px-3">Industry</th>
                          <th className="py-2.5 px-3">Phone</th>
                          <th className="py-2.5 px-3">Primary Contact</th>
                          <th className="py-2.5 px-3">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {importPreview.slice(0, 15).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-900">{row.name}</td>
                            <td className="py-2 px-3 text-slate-600">{row.industry}</td>
                            <td className="py-2 px-3 text-slate-600">{row.phone || '-'}</td>
                            <td className="py-2 px-3 text-slate-800">{row.contacts[0]?.name || '-'}</td>
                            <td className="py-2 px-3 text-slate-500 truncate max-w-[150px]">{row.email || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importPreview.length > 15 && (
                    <p className="text-[11px] text-slate-400 text-center">
                      ...and {importPreview.length - 15} more accounts
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={importing || importPreview.length === 0}
                onClick={handleExecuteImport}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-600/20 disabled:opacity-50"
              >
                <Upload className={`w-3.5 h-3.5 ${importing ? 'animate-spin' : ''}`} />
                <span>{importing ? 'Importing Accounts...' : `Import ${importPreview.length} Accounts`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Add/Edit Modal */}
      {showModal && editingAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAccount.id ? 'Edit Customer Account' : 'New Customer Account'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Account Name *</label>
                  <input
                    type="text"
                    required
                    value={editingAccount.name || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Tata Consultancy Services"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={editingAccount.industry || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, industry: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. IT & Software"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Main Phone</label>
                  <input
                    type="text"
                    value={editingAccount.phone || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, phone: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="+91 22 6777 0000"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Billing / Official Email</label>
                  <input
                    type="email"
                    value={editingAccount.email || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, email: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="procurement@client.com"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
                  <textarea
                    rows={2}
                    value={editingAccount.comments || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, comments: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Special payment terms, account history, etc."
                  />
                </div>
              </div>

              {/* Contacts Editor */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stakeholder Contacts</span>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Contact</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {editingAccount.contacts?.map((c, i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg relative space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Contact Name"
                          value={c.name}
                          onChange={(e) => handleContactChange(i, 'name', e.target.value)}
                          className="text-xs p-1.5 bg-white border border-slate-300 rounded"
                        />
                        <input
                          type="text"
                          placeholder="Designation / Role"
                          value={c.designation || ''}
                          onChange={(e) => handleContactChange(i, 'designation', e.target.value)}
                          className="text-xs p-1.5 bg-white border border-slate-300 rounded"
                        />
                        <input
                          type="text"
                          placeholder="Phone"
                          value={c.phone || ''}
                          onChange={(e) => handleContactChange(i, 'phone', e.target.value)}
                          className="text-xs p-1.5 bg-white border border-slate-300 rounded"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={c.email || ''}
                          onChange={(e) => handleContactChange(i, 'email', e.target.value)}
                          className="text-xs p-1.5 bg-white border border-slate-300 rounded"
                        />
                      </div>
                      {editingAccount.contacts!.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(i)}
                          className="text-[10px] text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove Contact</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
