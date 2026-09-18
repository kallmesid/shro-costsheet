import React, { useState } from 'react';
import { Shield, Lock, User as UserIcon, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { User } from '../types.ts';
import { ShroLogo } from './ShroLogo.tsx';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('vaibhav.g');
  const [password, setPassword] = useState('Shro@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (data.token) {
        localStorage.setItem('shro_token', data.token);
      }
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoCreds = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="bg-white/95 rounded-2xl p-4 shadow-xl inline-block mx-auto mb-4 border border-slate-700/40">
            <ShroLogo className="h-12 w-auto max-w-[280px]" variant="color" />
          </div>
          <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
            Sales Cost Sheet &amp; 6-Stage Approval Workflow
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-username-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. vaibhav.g"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500"
                />
              </div>
            </div>

            <button
              id="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In to Workflow</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials for Testing */}
          <div className="mt-6 pt-5 border-t border-slate-700/60">
            <p className="text-xs font-medium text-slate-400 mb-2.5">Quick Select Account:</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setDemoCreds('vaibhav.g', 'Shro@2026')}
                className="text-left px-2.5 py-1.5 rounded bg-slate-900/80 hover:bg-slate-700 text-slate-200 border border-slate-700/50 flex items-center justify-between"
              >
                <span>Admin (Vaibhav)</span>
                <span className="text-[10px] text-blue-400">Admin</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCreds('anita.fin', 'User@2026')}
                className="text-left px-2.5 py-1.5 rounded bg-slate-900/80 hover:bg-slate-700 text-slate-200 border border-slate-700/50 flex items-center justify-between"
              >
                <span>Stage 1: Finance</span>
                <span className="text-[10px] text-emerald-400">Fin 1</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCreds('rahul.pre', 'User@2026')}
                className="text-left px-2.5 py-1.5 rounded bg-slate-900/80 hover:bg-slate-700 text-slate-200 border border-slate-700/50 flex items-center justify-between"
              >
                <span>Stage 2: Presales</span>
                <span className="text-[10px] text-purple-400">Pre</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCreds('vikram.mgmt', 'User@2026')}
                className="text-left px-2.5 py-1.5 rounded bg-slate-900/80 hover:bg-slate-700 text-slate-200 border border-slate-700/50 flex items-center justify-between"
              >
                <span>Stage 3: Mgmt</span>
                <span className="text-[10px] text-amber-400">Mgmt</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCreds('sunil.ops', 'User@2026')}
                className="text-left px-2.5 py-1.5 rounded bg-slate-900/80 hover:bg-slate-700 text-slate-200 border border-slate-700/50 flex items-center justify-between"
              >
                <span>Stage 4: Ops</span>
                <span className="text-[10px] text-cyan-400">Ops</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoCreds('sales.ajay', 'User@2026')}
                className="text-left px-2.5 py-1.5 rounded bg-slate-900/80 hover:bg-slate-700 text-slate-200 border border-slate-700/50 flex items-center justify-between"
              >
                <span>Sales: Ajay</span>
                <span className="text-[10px] text-rose-400">Sales</span>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>PostgreSQL Persistent Database • bcrypt 12-round secure</span>
        </div>
      </div>
    </div>
  );
};
