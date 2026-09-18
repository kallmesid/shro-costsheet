import React, { useState, useRef, useEffect } from 'react';
import { 
  Archive, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  FileArchive, 
  RefreshCw, 
  Database, 
  FolderArchive, 
  FileText, 
  ShieldAlert, 
  Layers, 
  ChevronDown,
  Check,
  HardDrive
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';

export type BackupScope = 'both' | 'db' | 'files';

interface InspectionData {
  valid: boolean;
  hasDatabase?: boolean;
  hasFiles?: boolean;
  metadata?: {
    format_version?: string;
    scope?: string;
    exported_at?: string;
    exported_by?: {
      name?: string;
      username?: string;
      email?: string;
    };
    system?: string;
    stats?: Record<string, any>;
  };
  tableCounts: Record<string, number>;
  filesCount: number;
  filesTotalBytes: number;
  filesFormatted: string;
  sampleFiles: { name: string; size: number }[];
}

interface RestoreStats {
  cost_sheets?: number;
  line_items?: number;
  accounts?: number;
  users?: number;
  teams?: number;
  team_members?: number;
  dropdown_options?: number;
  approval_logs?: number;
  uploaded_files?: number;
  notifications?: number;
  physical_files_extracted?: number;
}

export const BackupRestoreView: React.FC = () => {
  // Export State
  const [exportScope, setExportScope] = useState<BackupScope>('both');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import / Inspect State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectionData, setInspectionData] = useState<InspectionData | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Restore State
  const [restoreScope, setRestoreScope] = useState<BackupScope>('both');
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [confirmSafety, setConfirmSafety] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<{ message: string; mode: string; stats: RestoreStats } | null>(null);

  // Scroll indicator state for right panel
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check scroll position of right panel to display visual cues
  const checkScroll = () => {
    if (!rightPanelRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = rightPanelRef.current;
    setCanScrollDown(scrollHeight - scrollTop - clientHeight > 30);
  };

  useEffect(() => {
    checkScroll();
  }, [inspectionData, selectedFile, restoreResult]);

  // Handle Export Backup (.zip) with chosen scope
  const handleExportBackup = async (scopeToUse: BackupScope = exportScope) => {
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const blob = await apiRequest(`/api/backup/export?scope=${scopeToUse}`);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `shro-portal-backup-${scopeToUse}-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const scopeLabel = 
        scopeToUse === 'both' ? 'Full system package (DB + Files)' :
        scopeToUse === 'db' ? 'Database package only' : 'Uploaded PDFs & files only';

      setExportSuccess(`${scopeLabel} (${(blob.size / (1024 * 1024)).toFixed(2)} MB) downloaded successfully.`);
    } catch (err: any) {
      setExportError(err.message || 'Failed to generate backup archive');
    } finally {
      setExporting(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setInspectError('Please select a valid .zip backup archive.');
        return;
      }
      setSelectedFile(file);
      setInspectionData(null);
      setInspectError(null);
      setRestoreResult(null);
      setRestoreError(null);
      setConfirmSafety(false);
    }
  };

  // Inspect Selected Archive
  const handleInspectFile = async () => {
    if (!selectedFile) return;
    setInspecting(true);
    setInspectError(null);
    setInspectionData(null);
    setRestoreResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const data: InspectionData = await apiRequest('/api/backup/inspect', {
        method: 'POST',
        body: formData
      });
      setInspectionData(data);

      // Auto-select smart scope based on archive contents
      if (data.hasDatabase && !data.hasFiles) {
        setRestoreScope('db');
      } else if (!data.hasDatabase && data.hasFiles) {
        setRestoreScope('files');
      } else {
        setRestoreScope('both');
      }
    } catch (err: any) {
      setInspectError(err.message || 'Failed to inspect backup file');
    } finally {
      setInspecting(false);
    }
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!selectedFile) return;
    if (!confirmSafety) {
      return;
    }

    if (restoreMode === 'replace') {
      const confirmed = window.confirm(
        'WARNING: Clean Replacement will replace existing records/files with this backup snapshot. Continue?'
      );
      if (!confirmed) return;
    }

    setRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('mode', restoreMode);
    formData.append('scope', restoreScope);

    try {
      const result = await apiRequest('/api/backup/restore', {
        method: 'POST',
        body: formData
      });
      setRestoreResult(result);
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to restore backup');
    } finally {
      setRestoring(false);
    }
  };

  const scrollToBottom = () => {
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTo({
        top: rightPanelRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Archive className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold tracking-tight">System Backup & Granular Disaster Recovery</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Create and restore backups for your entire system, database tables only, or uploaded PDF quotations & attachments.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-export-backup-hero"
              onClick={() => handleExportBackup(exportScope)}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow transition disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Backup
                </>
              )}
            </button>
          </div>
        </div>

        {exportSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
        )}
        {exportError && (
          <div className="mt-4 p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Card 1: System Export Details */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Export Backup Package</h3>
                <p className="text-xs text-slate-500">Choose which components to include in your backup package</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full border border-blue-200">
              Granular Export
            </span>
          </div>

          {/* Granular Scope Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Choose Backup Scope
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {/* Option 1: Both */}
              <label 
                className={`p-3.5 rounded-lg border-2 cursor-pointer transition flex items-start justify-between ${
                  exportScope === 'both' 
                    ? 'border-blue-600 bg-blue-50/50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="exportScope"
                    value="both"
                    checked={exportScope === 'both'}
                    onChange={() => setExportScope('both')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      Both Database & Uploaded PDFs (Full System)
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Complete snapshot containing all 10 SQL tables plus the entire uploads directory with PDFs, BOMs, and vendor quotes.
                    </p>
                  </div>
                </div>
              </label>

              {/* Option 2: Database Only */}
              <label 
                className={`p-3.5 rounded-lg border-2 cursor-pointer transition flex items-start justify-between ${
                  exportScope === 'db' 
                    ? 'border-blue-600 bg-blue-50/50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="exportScope"
                    value="db"
                    checked={exportScope === 'db'}
                    onChange={() => setExportScope('db')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-emerald-600" />
                      Database Only (Lightweight)
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Users, accounts, cost sheets, deals, 6-stage logs, line items, and configurations. Excludes heavy attachments.
                    </p>
                  </div>
                </div>
              </label>

              {/* Option 3: Uploaded PDFs Only */}
              <label 
                className={`p-3.5 rounded-lg border-2 cursor-pointer transition flex items-start justify-between ${
                  exportScope === 'files' 
                    ? 'border-blue-600 bg-blue-50/50' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="exportScope"
                    value="files"
                    checked={exportScope === 'files'}
                    onChange={() => setExportScope('files')}
                    className="mt-1 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <FolderArchive className="w-3.5 h-3.5 text-amber-600" />
                      Uploaded PDFs & Attachments Only
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Physical document files organised per cost sheet folder (`uploads/SHRO_.../`), including BOM spreadsheets and vendor PDFs.
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-export-backup-card"
              onClick={() => handleExportBackup(exportScope)}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow transition disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating & Packaging Archive...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  Download Selected Backup Package (.zip)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Restore from Backup (Right Access Panel) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm relative flex flex-col">
          <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Import & Restore Backup</h3>
                <p className="text-xs text-slate-500">Restore database records and/or uploaded files</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full border border-amber-200">
              Admin Only
            </span>
          </div>

          {/* Scrollable Container with Smooth Scrollbar */}
          <div 
            ref={rightPanelRef}
            onScroll={checkScroll}
            className="p-6 space-y-6 max-h-[640px] overflow-y-auto pr-3 scroll-smooth"
          >
            {/* Step 1: File Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Select Backup Archive (.zip)
              </label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/60 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
              >
                <FileArchive className="w-8 h-8 text-blue-500" />
                {selectedFile ? (
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800">{selectedFile.name}</p>
                    <p className="text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    <p className="font-semibold text-blue-600">Click to browse or drag & drop</p>
                    <p>Select any SHRO backup archive (.zip)</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {selectedFile && !inspectionData && (
                <div className="flex justify-end pt-1">
                  <button
                    id="btn-inspect-backup"
                    type="button"
                    onClick={handleInspectFile}
                    disabled={inspecting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    {inspecting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Verifying Archive...
                      </>
                    ) : (
                      <>
                        <Layers className="w-3.5 h-3.5" />
                        Inspect Archive Contents
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {inspectError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{inspectError}</span>
              </div>
            )}

            {/* Inspection Results Section */}
            {inspectionData && (
              <div className="space-y-5 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">Archive Verified</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {inspectionData.metadata?.exported_at ? new Date(inspectionData.metadata.exported_at).toLocaleDateString() : 'Ready'}
                  </span>
                </div>

                {/* Content detection chips */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    inspectionData.hasDatabase !== false 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <Database className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="font-bold">Database Tables</div>
                      <div className="text-[11px] opacity-80">
                        {inspectionData.hasDatabase !== false ? `${inspectionData.tableCounts.cost_sheets || 0} Cost Sheets` : 'Not in archive'}
                      </div>
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                    inspectionData.hasFiles !== false && inspectionData.filesCount > 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <FolderArchive className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="font-bold">Uploaded PDFs</div>
                      <div className="text-[11px] opacity-80">
                        {inspectionData.filesCount > 0 ? `${inspectionData.filesCount} files (${inspectionData.filesFormatted})` : '0 files'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Choose Restore Scope */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    2. Select Restore Target
                  </label>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <label 
                      className={`p-3 rounded-lg border-2 cursor-pointer transition flex items-center justify-between ${
                        restoreScope === 'both' 
                          ? 'border-blue-600 bg-blue-50/40' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="restoreScope"
                          value="both"
                          checked={restoreScope === 'both'}
                          onChange={() => setRestoreScope('both')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold text-slate-800">Restore Both Database & Uploaded PDFs</span>
                      </div>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Complete</span>
                    </label>

                    <label 
                      className={`p-3 rounded-lg border-2 cursor-pointer transition flex items-center justify-between ${
                        restoreScope === 'db' 
                          ? 'border-blue-600 bg-blue-50/40' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="restoreScope"
                          value="db"
                          checked={restoreScope === 'db'}
                          onChange={() => setRestoreScope('db')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold text-slate-800">Restore Database Tables Only</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">DB Only</span>
                    </label>

                    <label 
                      className={`p-3 rounded-lg border-2 cursor-pointer transition flex items-center justify-between ${
                        restoreScope === 'files' 
                          ? 'border-blue-600 bg-blue-50/40' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="restoreScope"
                          value="files"
                          checked={restoreScope === 'files'}
                          onChange={() => setRestoreScope('files')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold text-slate-800">Restore Uploaded PDFs & Files Only</span>
                      </div>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">Files Only</span>
                    </label>
                  </div>
                </div>

                {/* Step 3: Choose Restoration Mode */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    3. Restoration Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className={`p-3 rounded-lg border cursor-pointer ${
                      restoreMode === 'replace' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 bg-white'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="restoreMode"
                          value="replace"
                          checked={restoreMode === 'replace'}
                          onChange={() => setRestoreMode('replace')}
                          className="text-blue-600"
                        />
                        <span className="font-bold text-slate-900">Clean Replace</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                        Overwrites existing target data with backup state.
                      </p>
                    </label>

                    <label className={`p-3 rounded-lg border cursor-pointer ${
                      restoreMode === 'merge' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 bg-white'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="restoreMode"
                          value="merge"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="text-blue-600"
                        />
                        <span className="font-bold text-slate-900">Safe Merge</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                        Keeps current records and appends missing ones.
                      </p>
                    </label>
                  </div>
                </div>

                {/* Step 4: Confirmation & Execution */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <input
                      id="chk-confirm-restore"
                      type="checkbox"
                      checked={confirmSafety}
                      onChange={(e) => setConfirmSafety(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <label htmlFor="chk-confirm-restore" className="text-xs text-slate-700 cursor-pointer">
                      I authorize this restoration operation ({restoreScope.toUpperCase()} scope, {restoreMode} mode).
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setInspectionData(null);
                      }}
                      className="px-3 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition"
                    >
                      Reset
                    </button>
                    <button
                      id="btn-execute-restore"
                      type="button"
                      onClick={handleExecuteRestore}
                      disabled={restoring || !confirmSafety}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                    >
                      {restoring ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Restoring...
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Execute Restoration
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {restoreError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}

            {restoreResult && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <h4 className="text-xs font-bold">{restoreResult.message}</h4>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Restore mode: <strong>{restoreResult.mode.toUpperCase()}</strong>. Target scope applied successfully.
                </p>
              </div>
            )}
          </div>

          {/* Visual Scroll Affordance when more content is below */}
          {canScrollDown && (
            <div 
              onClick={scrollToBottom}
              className="border-t border-slate-200 bg-slate-50/95 hover:bg-slate-100 p-2 text-center text-xs font-semibold text-blue-600 cursor-pointer flex items-center justify-center gap-1.5 transition rounded-b-xl shadow-inner"
            >
              <span>Scroll down for restore options & execution</span>
              <ChevronDown className="w-4 h-4 animate-bounce" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
