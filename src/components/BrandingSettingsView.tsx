import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Building2, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Globe, 
  Mail, 
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { ShroLogo } from './ShroLogo.tsx';

export const BrandingSettingsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [branding, setBranding] = useState({
    portal_name: 'SHRO Systems',
    portal_tagline: 'Sales Quotation & Cost Sheet Portal',
    logo_url: '',
    primary_color: '#2563eb',
    company_website: 'https://shrosystems.com',
    support_email: 'support@shrosystems.com',
    footer_text: '© 2026 SHRO Systems Pvt Ltd. Confidential enterprise pricing and commercial cost sheets.',
  });

  const loadBranding = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/config/branding');
      if (data && Object.keys(data).length > 0) {
        setBranding(prev => ({ ...prev, ...data }));
      }
    } catch (err: any) {
      console.error('Failed to load branding:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await apiRequest('/api/config/branding', {
        method: 'POST',
        body: JSON.stringify(branding),
      });
      setSuccessMsg('Branding configuration saved successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const presetColors = [
    { name: 'SHRO Classic Blue', hex: '#2563eb' },
    { name: 'Executive Navy', hex: '#1e3a8a' },
    { name: 'Enterprise Indigo', hex: '#4f46e5' },
    { name: 'Emerald Profit', hex: '#059669' },
    { name: 'Slate Modern', hex: '#334155' },
    { name: 'Crimson Tech', hex: '#b91c1c' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
        Loading branding settings...
      </div>
    );
  }

  return (
    <div id="branding-settings-container" className="space-y-6 max-w-5xl">
      {/* Overview Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Enterprise Portal Branding & Theme</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Customize the system identity, portal titles, official corporate logos, and client-facing report themes.
          </p>
        </div>
        <button
          onClick={loadBranding}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Inputs */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Portal Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Portal Title / Organization</label>
              <input
                type="text"
                id="branding-input-portal-name"
                value={branding.portal_name}
                onChange={(e) => setBranding({ ...branding, portal_name: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                required
              />
            </div>

            {/* Tagline */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Portal Subtitle / Tagline</label>
              <input
                type="text"
                id="branding-input-tagline"
                value={branding.portal_tagline}
                onChange={(e) => setBranding({ ...branding, portal_tagline: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Primary Theme Accent Color */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Corporate Primary Accent Color</label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {presetColors.map((color) => (
                <button
                  type="button"
                  key={color.hex}
                  onClick={() => setBranding({ ...branding, primary_color: color.hex })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    branding.primary_color.toLowerCase() === color.hex.toLowerCase()
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="color"
                value={branding.primary_color}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={branding.primary_color}
                onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                className="w-32 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
              />
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Custom Brand Logo URL (Optional)</label>
            <div className="relative">
              <input
                type="url"
                id="branding-input-logo-url"
                placeholder="https://example.com/logo.png (leave blank for default SHRO logo)"
                value={branding.logo_url}
                onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              <ImageIcon className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Supports transparent PNG, SVG, or WebP. When empty, standard SHRO vectorized branding is rendered.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Company Website */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Company Website</label>
              <div className="relative">
                <input
                  type="url"
                  value={branding.company_website}
                  onChange={(e) => setBranding({ ...branding, company_website: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
                <Globe className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
              </div>
            </div>

            {/* Support Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Portal Support Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={branding.support_email}
                  onChange={(e) => setBranding({ ...branding, support_email: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-8 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-2.5 top-3" />
              </div>
            </div>
          </div>

          {/* Footer Text */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Confidentiality Disclaimer / Footer Text</label>
            <textarea
              rows={2}
              value={branding.footer_text}
              onChange={(e) => setBranding({ ...branding, footer_text: e.target.value })}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 cursor-pointer transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Branding...' : 'Save Branding Changes'}</span>
            </button>
          </div>
        </form>

        {/* Live Visual Preview Card */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live TopBar & Header Preview</h3>
            </div>

            {/* Mock Topbar Preview */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs space-y-3">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                {branding.logo_url ? (
                  <img 
                    src={branding.logo_url} 
                    alt="Logo" 
                    className="h-8 max-w-[120px] object-contain" 
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                ) : (
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-xs"
                    style={{ backgroundColor: branding.primary_color }}
                  >
                    {branding.portal_name.charAt(0) || 'S'}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{branding.portal_name || 'Portal Name'}</p>
                  <p className="text-[10px] text-slate-500 truncate">{branding.portal_tagline || 'Portal Tagline'}</p>
                </div>
              </div>

              {/* Mock Badge & CTA button preview */}
              <div className="space-y-2 pt-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Button & Theme Accent:</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    style={{ backgroundColor: branding.primary_color }}
                    className="px-3 py-1.5 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    + New Cost Sheet
                  </button>
                  <span 
                    style={{ color: branding.primary_color }}
                    className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50"
                  >
                    18.5% Margin
                  </span>
                </div>
              </div>

              {/* Mock Footer text */}
              <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                <p className="truncate">{branding.footer_text}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-xs text-blue-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Multi-Tenant Ready</span>
            </div>
            <p className="text-[11px] text-blue-800">
              Branding changes apply across the user interface, PDF exports, and executive email summaries in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
