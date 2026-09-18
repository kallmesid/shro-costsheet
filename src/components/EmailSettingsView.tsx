import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Server, 
  Lock, 
  Bell, 
  Info 
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';

export const EmailSettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [testRecipient, setTestRecipient] = useState('');

  const [config, setConfig] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: 'notifications@shrosystems.com',
    smtp_password: '',
    smtp_password_configured: false,
    from_email: 'notifications@shrosystems.com',
    from_name: 'SHRO Portal Notifications',
    notify_on_submission: true,
    notify_on_approval: true,
    notify_on_rejection: true,
    notify_admin_on_error: true,
  });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/config/email');
      if (data && Object.keys(data).length > 0) {
        setConfig(prev => ({
          ...prev,
          ...data,
          smtp_password: data.smtp_password_configured ? '••••••••' : '',
        }));
      }
    } catch (err: any) {
      console.error('Failed to load email config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await apiRequest('/api/config/email', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      setSuccessMsg('Email server configuration saved successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      loadConfig();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMsg(null);
    try {
      const data = await apiRequest('/api/config/email/test', {
        method: 'POST',
        body: JSON.stringify({ recipient: testRecipient || undefined }),
      });
      setTestResult(data.message || 'Test email dispatched successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch test email');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
        Loading email settings...
      </div>
    );
  }

  return (
    <div id="email-settings-container" className="space-y-6 max-w-5xl">
      {/* Overview Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Email Server & SMTP Workflow Notifications</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure automated transactional email notifications for multi-stage approval handoffs, cost sheet status changes, and quote signoffs.
          </p>
        </div>
        <button
          onClick={loadConfig}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          title="Reload settings"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {testResult && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main SMTP Settings Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Server className="w-4 h-4 text-slate-600" />
              <span>Outbound SMTP Server Configuration</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* SMTP Host */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">SMTP Host / Server</label>
                <input
                  type="text"
                  id="email-input-smtp-host"
                  placeholder="smtp.gmail.com or smtp.office365.com"
                  value={config.smtp_host}
                  onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  required
                />
              </div>

              {/* SMTP Port */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Port</label>
                <input
                  type="number"
                  id="email-input-smtp-port"
                  value={config.smtp_port}
                  onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value, 10) || 587 })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* SMTP User */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">SMTP Username / Email</label>
              <input
                type="text"
                id="email-input-smtp-user"
                value={config.smtp_user}
                onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            {/* SMTP Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">SMTP Password / App Key</label>
              <div className="relative">
                <input
                  type="password"
                  id="email-input-smtp-password"
                  placeholder={config.smtp_password_configured ? '••••••••' : 'Enter SMTP password'}
                  value={config.smtp_password}
                  onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
              </div>
              {config.smtp_password_configured && (
                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Password securely saved
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sender From Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">From / Sender Address</label>
              <input
                type="email"
                id="email-input-from-email"
                value={config.from_email}
                onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>

            {/* Sender From Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Sender Display Name</label>
              <input
                type="text"
                id="email-input-from-name"
                value={config.from_name}
                onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Secure SSL/TLS Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="email-toggle-secure"
              checked={config.smtp_secure}
              onChange={(e) => setConfig({ ...config, smtp_secure: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded-sm border-slate-300"
            />
            <label htmlFor="email-toggle-secure" className="text-xs text-slate-700 font-medium cursor-pointer">
              Use SSL / TLS protocol (Enable for Port 465; disable for Port 587 STARTTLS)
            </label>
          </div>

          <hr className="border-slate-100" />

          {/* Workflow Trigger Events */}
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Bell className="w-4 h-4 text-slate-600" />
              <span>Automated Notification Triggers</span>
            </h3>

            <div className="space-y-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notify_on_submission}
                  onChange={(e) => setConfig({ ...config, notify_on_submission: e.target.checked })}
                  className="w-4 h-4 mt-0.5 text-blue-600 rounded-sm border-slate-300"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Sequential Stage Handoff Alert</p>
                  <p className="text-[11px] text-slate-500">
                    Notify designated approvers immediately when a quote transitions to their stage (Finance 1, Presales, Management, Operations, Logistics, Finance 2).
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notify_on_approval}
                  onChange={(e) => setConfig({ ...config, notify_on_approval: e.target.checked })}
                  className="w-4 h-4 mt-0.5 text-blue-600 rounded-sm border-slate-300"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Final Approval Broadcast</p>
                  <p className="text-[11px] text-slate-500">
                    Send quote confirmation to the salesperson and account manager once all 6 sequential sign-offs are completed.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notify_on_rejection}
                  onChange={(e) => setConfig({ ...config, notify_on_rejection: e.target.checked })}
                  className="w-4 h-4 mt-0.5 text-blue-600 rounded-sm border-slate-300"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800">Rejection Notice</p>
                  <p className="text-[11px] text-slate-500">
                    Notify the initiator when a cost sheet is rejected with the approver&apos;s reason remarks.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 cursor-pointer transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Server Config...' : 'Save Email Configuration'}</span>
            </button>
          </div>
        </form>

        {/* Diagnostics & Test Email Card */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Test SMTP Delivery</h3>
            </div>
            <p className="text-xs text-slate-500">
              Send a test email to verify host connectivity and SMTP handshake parameters.
            </p>

            <div className="space-y-2 pt-1">
              <label className="block text-[11px] font-semibold text-slate-600">Test Recipient Email</label>
              <input
                type="email"
                placeholder="your.email@shrosystems.com"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testing}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Send className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Verifying Handshake...' : 'Send Test Notification'}</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Info className="w-4 h-4 text-blue-600" />
              <span>Recommended SMTP Hosts</span>
            </div>
            <ul className="text-[11px] space-y-1 text-slate-500 list-disc list-inside">
              <li><strong>Google Workspace:</strong> smtp.gmail.com (Port 587)</li>
              <li><strong>Microsoft 365:</strong> smtp.office365.com (Port 587)</li>
              <li><strong>Amazon SES:</strong> email-smtp.region.amazonaws.com</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
