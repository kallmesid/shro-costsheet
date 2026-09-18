import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  UserCheck, 
  ListFilter, 
  ShieldAlert, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  CheckCircle, 
  AlertCircle,
  KeyRound,
  UserPlus,
  Archive,
  Mail,
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  CheckSquare,
  Square,
  AlertTriangle
} from 'lucide-react';
import { User, DropdownOptions, Team } from '../types.ts';
import { apiRequest } from '../lib/api.ts';
import { BackupRestoreView } from './BackupRestoreView.tsx';
import { EmailSettingsView } from './EmailSettingsView.tsx';

export type AdminTab = 'users' | 'sudo' | 'dropdowns' | 'teams' | 'email' | 'backup';

interface AdminViewProps {
  currentUser: User;
  onSudoLogin: (targetUserId: number) => void;
  onDropdownsUpdated: () => void;
  dropdowns: DropdownOptions;
  initialTab?: AdminTab;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  onSudoLogin,
  onDropdownsUpdated,
  dropdowns,
  initialTab = 'users',
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== ('branding' as any)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Bulk User Selection & Action state
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // User form modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Excel User Import modal
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelResult, setExcelResult] = useState<any | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Dropdown option form
  const [dropdownCategory, setDropdownCategory] = useState<'business_unit' | 'oem' | 'distributor'>('business_unit');
  const [newOptionName, setNewOptionName] = useState('');
  const [addingOption, setAddingOption] = useState(false);

  // Team create form
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamLeadId, setTeamLeadId] = useState<number | ''>('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  const fetchUsersAndTeams = async () => {
    setLoading(true);
    try {
      const [usersData, teamsData] = await Promise.all([
        apiRequest('/api/users'),
        apiRequest('/api/users/teams'),
      ]);
      setUsers(usersData);
      setTeams(teamsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndTeams();
  }, []);

  // Helper to format email as name.shrosystems.com
  const formatShroEmail = (nameOrUser: string) => {
    const clean = nameOrUser.toLowerCase().trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    return clean ? `${clean}@shrosystems.com` : '';
  };

  const handleOpenCreateUser = () => {
    setEditingUser({
      name: '',
      username: '',
      email: '',
      password: '',
      role: 'Finance',
      access_level: 'User',
      status: 'Active',
      report_to_id: null,
    });
    setUserError(null);
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser({
      ...u,
      password: '', // leave empty to keep unchanged
    });
    setUserError(null);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSaving(true);
    setUserError(null);

    // Ensure email ends with @shrosystems.com if typed without @
    let normalizedEmail = (editingUser.email || '').trim();
    if (normalizedEmail && !normalizedEmail.includes('@')) {
      normalizedEmail = `${normalizedEmail}@shrosystems.com`;
    }

    const payload = {
      ...editingUser,
      email: normalizedEmail
    };

    try {
      if (editingUser.id) {
        await apiRequest(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowUserModal(false);
      fetchUsersAndTeams();
    } catch (err: any) {
      setUserError(err.message || 'Failed to save user');
    } finally {
      setUserSaving(false);
    }
  };

  // Bulk Operations
  const handleToggleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.id));
    }
  };

  const handleToggleUserSelect = (id: number) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkUpdate = async (fields: { status?: string; role?: string; access_level?: string }) => {
    if (selectedUserIds.length === 0) return;
    setBulkActionLoading(true);
    setBulkFeedback(null);
    try {
      const res = await apiRequest('/api/users/bulk-update', {
        method: 'POST',
        body: JSON.stringify({
          userIds: selectedUserIds,
          ...fields
        })
      });
      setBulkFeedback({ type: 'success', message: res.message || 'Users updated successfully' });
      await fetchUsersAndTeams();
    } catch (err: any) {
      setBulkFeedback({ type: 'error', message: err.message || 'Bulk update failed' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.length === 0) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete or deactivate ${selectedUserIds.length} selected user(s)? Users linked to historical cost sheets will be safely set to Inactive to preserve audit trails.`
    );
    if (!confirmDelete) return;

    setBulkActionLoading(true);
    setBulkFeedback(null);
    try {
      const res = await apiRequest('/api/users/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ userIds: selectedUserIds })
      });
      setBulkFeedback({ 
        type: 'success', 
        message: `${res.message} (${res.deletedCount || 0} deleted, ${res.deactivatedCount || 0} set to Inactive)` 
      });
      setSelectedUserIds([]);
      await fetchUsersAndTeams();
    } catch (err: any) {
      setBulkFeedback({ type: 'error', message: err.message || 'Bulk delete failed' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Excel Import Handler
  const handleExcelImport = async () => {
    if (!excelFile) return;
    setExcelImporting(true);
    setExcelError(null);
    setExcelResult(null);

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const res = await apiRequest('/api/users/import-excel', {
        method: 'POST',
        body: formData
      });
      setExcelResult(res);
      await fetchUsersAndTeams();
    } catch (err: any) {
      setExcelError(err.message || 'Failed to import users from spreadsheet');
    } finally {
      setExcelImporting(false);
    }
  };

  // Download Sample Template
  const handleDownloadSampleTemplate = () => {
    const csvContent = "Name,Username,Email,Role,Access Level,Status,Password\n" +
      "Arun Kumar,arun.kumar,arun.kumar@shrosystems.com,Sales,User,Active,Password@123\n" +
      "Priya Sharma,priya.sharma,priya.sharma@shrosystems.com,Presales,TeamLead,Active,Password@123\n" +
      "Vikram Malhotra,vikram.malhotra,vikram.malhotra@shrosystems.com,Finance,Management,Active,Password@123\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'shrosystems_users_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddDropdownOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionName.trim()) return;
    setAddingOption(true);
    try {
      await apiRequest('/api/config/dropdowns', {
        method: 'POST',
        body: JSON.stringify({ category: dropdownCategory, name: newOptionName.trim() }),
      });
      setNewOptionName('');
      onDropdownsUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to add option');
    } finally {
      setAddingOption(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    try {
      await apiRequest('/api/users/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: teamName.trim(),
          lead_id: teamLeadId || null,
          member_ids: selectedMembers,
        }),
      });
      setShowTeamModal(false);
      setTeamName('');
      setTeamLeadId('');
      setSelectedMembers([]);
      fetchUsersAndTeams();
    } catch (err: any) {
      alert(err.message || 'Failed to create team');
    }
  };

  return (
    <div id="admin-view-container" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Administration Tools</h1>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            User directory with bulk management & Excel import, Sudo troubleshooting, master dropdowns, and database backups.
          </p>
        </div>

        {activeTab === 'users' && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              id="btn-import-excel-users"
              onClick={() => {
                setExcelFile(null);
                setExcelResult(null);
                setExcelError(null);
                setShowExcelModal(true);
              }}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import Excel</span>
            </button>

            <button
              id="btn-add-user"
              onClick={handleOpenCreateUser}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-200/60 rounded-xl">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'users' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('teams')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'teams' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Teams & Hierarchy</span>
        </button>

        <button
          onClick={() => setActiveTab('dropdowns')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'dropdowns' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>Dropdown Editor</span>
        </button>

        <button
          id="tab-admin-email"
          onClick={() => setActiveTab('email')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'email' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email & SMTP</span>
        </button>

        <button
          id="tab-admin-backup"
          onClick={() => setActiveTab('backup')}
          className={`flex-1 min-w-[160px] py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'backup' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Backup Database</span>
        </button>

        <button
          onClick={() => setActiveTab('sudo')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'sudo' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>'Login As'</span>
        </button>
      </div>

      {/* Bulk Feedback Banner */}
      {bulkFeedback && (
        <div className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 border ${
          bulkFeedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {bulkFeedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{bulkFeedback.message}</span>
          </div>
          <button onClick={() => setBulkFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Bulk Action Bar (Visible when users selected) */}
          {selectedUserIds.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded-lg text-xs">
                  {selectedUserIds.length} Selected
                </span>
                <span className="text-xs text-blue-900 font-medium">Batch Operations:</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status Dropdown */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdate({ status: e.target.value });
                      e.target.value = '';
                    }
                  }}
                  disabled={bulkActionLoading}
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:border-blue-400 cursor-pointer"
                >
                  <option value="">Set Status...</option>
                  <option value="Active">Mark Active</option>
                  <option value="Inactive">Mark Inactive</option>
                  <option value="Suspended">Mark Suspended</option>
                </select>

                {/* Role Dropdown */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdate({ role: e.target.value });
                      e.target.value = '';
                    }
                  }}
                  disabled={bulkActionLoading}
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:border-blue-400 cursor-pointer"
                >
                  <option value="">Set Role / Dept...</option>
                  <option value="Sales">Sales</option>
                  <option value="Presales">Presales</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Services">Services</option>
                  <option value="Finance">Finance</option>
                  <option value="Management">Management</option>
                  <option value="Director">Director</option>
                </select>

                {/* Access Level Dropdown */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkUpdate({ access_level: e.target.value });
                      e.target.value = '';
                    }
                  }}
                  disabled={bulkActionLoading}
                  className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:border-blue-400 cursor-pointer"
                >
                  <option value="">Set Access Level...</option>
                  <option value="User">User</option>
                  <option value="TeamLead">TeamLead</option>
                  <option value="Management">Management</option>
                  <option value="Admin">Admin</option>
                </select>

                {/* Bulk Delete Button */}
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>

                {/* Clear Selection */}
                <button
                  onClick={() => setSelectedUserIds([])}
                  className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={users.length > 0 && selectedUserIds.length === users.length}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Name & Username</th>
                    <th className="py-3 px-4">Email (@shrosystems.com)</th>
                    <th className="py-3 px-4">Role (Department)</th>
                    <th className="py-3 px-4">Access Level</th>
                    <th className="py-3 px-4">Reports To</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading users...</td></tr>
                  ) : (
                    users.map((u) => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <tr 
                          key={u.id} 
                          className={`transition ${isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleUserSelect(u.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            {u.name}
                            <span className="block text-[10px] text-slate-400 font-normal">@{u.username}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">{u.email}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px]">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">{u.access_level}</td>
                          <td className="py-3 px-4 text-slate-500">{u.report_to_name || 'None'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                              u.status === 'Suspended' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded font-semibold text-xs transition cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onSudoLogin(u.id)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded font-semibold text-xs transition cursor-pointer"
                                title="Login as this user (Sudo troubleshooting)"
                              >
                                Sudo
                              </button>
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
      )}

      {/* TAB 2: SUDO MODE */}
      {activeTab === 'sudo' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <UserCheck className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Administrator 'Login As' (Sudo) Mode
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Simulate any user's view, inspect pending quotes assigned to their department stage, or troubleshoot approval bottlenecks.
                All Sudo actions are logged to the security audit trail.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-100 transition"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{u.name}</h4>
                  <p className="text-[11px] text-slate-500">@{u.username} • {u.role} ({u.access_level})</p>
                </div>
                <button
                  onClick={() => onSudoLogin(u.id)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Login As</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DROPDOWNS */}
      {activeTab === 'dropdowns' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Configure Cost Sheet Dropdowns</h3>
              <p className="text-xs text-slate-500">Add or manage standard business units, OEMs, and distributors.</p>
            </div>

            <form onSubmit={handleAddDropdownOption} className="flex items-center gap-2">
              <select
                value={dropdownCategory}
                onChange={(e: any) => setDropdownCategory(e.target.value)}
                className="text-xs p-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="business_unit">Business Unit</option>
                <option value="oem">OEM</option>
                <option value="distributor">Distributor</option>
              </select>
              <input
                type="text"
                placeholder="Option name..."
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                className="text-xs p-2 border border-slate-300 rounded-lg w-48"
              />
              <button
                type="submit"
                disabled={addingOption || !newOptionName.trim()}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Business Units */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span>Business Units</span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full">{dropdowns.business_unit.length}</span>
              </h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {dropdowns.business_unit.map((item, idx) => (
                  <div key={idx} className="p-2 bg-white rounded border border-slate-200 text-xs text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* OEMs */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span>OEMs (Brands)</span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full">{dropdowns.oem.length}</span>
              </h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {dropdowns.oem.map((item, idx) => (
                  <div key={idx} className="p-2 bg-white rounded border border-slate-200 text-xs text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Distributors */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                <span>Distributors</span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full">{dropdowns.distributor.length}</span>
              </h4>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {dropdowns.distributor.map((item, idx) => (
                  <div key={idx} className="p-2 bg-white rounded border border-slate-200 text-xs text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEAMS */}
      {activeTab === 'teams' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Organizational Teams & Hierarchy</h3>
              <p className="text-xs text-slate-500">Group sales reps and presales engineers under team leads.</p>
            </div>
            <button
              onClick={() => setShowTeamModal(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Team</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((t) => (
              <div key={t.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                    {t.member_count} Members
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Lead: </span>
                  {t.lead_name || 'Unassigned'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: EMAIL SETTINGS */}
      {activeTab === 'email' && (
        <EmailSettingsView />
      )}

      {/* TAB 6: BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <BackupRestoreView />
      )}

      {/* User Create/Edit Modal */}
      {showUserModal && editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingUser.id ? `Edit User: ${editingUser.name}` : 'Create New User'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600 rounded cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {userError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200">
                  {userError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingUser.name || ''}
                    onChange={(e) => {
                      const newName = e.target.value;
                      const updates: any = { ...editingUser, name: newName };
                      if (!editingUser.id) {
                        const autoEmail = formatShroEmail(newName);
                        const autoUsername = newName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '.');
                        updates.email = autoEmail;
                        updates.username = autoUsername;
                      }
                      setEditingUser(updates);
                    }}
                    placeholder="e.g. Ramesh Chandra"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser.id}
                    value={editingUser.username || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email (@shrosystems.com) *</label>
                  <input
                    type="text"
                    required
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    placeholder="name@shrosystems.com"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg font-mono text-[11px]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password {editingUser.id ? '(Leave blank to retain current)' : '*'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser.id}
                    value={editingUser.password || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role (Department) *</label>
                  <select
                    value={editingUser.role || 'Finance'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Presales">Presales</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Services">Services</option>
                    <option value="Management">Management</option>
                    <option value="Operations">Operations</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Access Level *</label>
                  <select
                    value={editingUser.access_level || 'User'}
                    onChange={(e) => setEditingUser({ ...editingUser, access_level: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="User">User</option>
                    <option value="TeamLead">TeamLead</option>
                    <option value="Management">Management</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingUser.status || 'Active'}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reports To (Manager)</label>
                  <select
                    value={editingUser.report_to_id || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, report_to_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="">None (Top level)</option>
                    {users.filter(u => u.id !== editingUser.id).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{userSaving ? 'Saving...' : 'Save User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel User Import Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Import Users from Excel / CSV</h3>
              </div>
              <button 
                onClick={() => setShowExcelModal(false)} 
                className="text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Upload a spreadsheet (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">.xlsx, .xls, .csv</code>) to create or update users in bulk. Emails will automatically be set to the <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">@shrosystems.com</code> corporate domain.
              </p>

              {/* Sample Template Download */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Download Template</span>
                  <span className="text-[11px] text-slate-500">Includes recognized column headers and sample data</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download Sample</span>
                </button>
              </div>

              {/* Drag & drop / file picker */}
              <div 
                onClick={() => excelInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/50 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                {excelFile ? (
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">{excelFile.name}</p>
                    <p className="text-slate-500">{(excelFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    <p className="font-semibold text-emerald-700">Click to browse or drop spreadsheet file here</p>
                    <p>Supports .xlsx, .xls, and .csv files</p>
                  </div>
                )}
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setExcelFile(e.target.files[0]);
                      setExcelResult(null);
                      setExcelError(null);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {excelError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{excelError}</span>
                </div>
              )}

              {excelResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{excelResult.message}</span>
                  </div>
                  <p className="text-emerald-700">
                    Processed {excelResult.importedCount} user accounts. Any existing usernames were updated with new roles and status.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowExcelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleExcelImport}
                  disabled={!excelFile || excelImporting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {excelImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Import Users</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Create New Team</h3>
              <button onClick={() => setShowTeamModal(false)} className="text-slate-400 hover:text-slate-600 rounded cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. West Region Enterprise Sales"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Team Lead</label>
                <select
                  value={teamLeadId}
                  onChange={(e) => setTeamLeadId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                >
                  <option value="">Select a Lead</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Members</label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMembers([...selectedMembers, u.id]);
                          else setSelectedMembers(selectedMembers.filter(id => id !== u.id));
                        }}
                      />
                      <span>{u.name} ({u.role})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
