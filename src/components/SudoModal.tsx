import React from 'react';
import { X, UserCheck } from 'lucide-react';
import { User } from '../types.ts';

interface SudoModalProps {
  users: User[];
  currentUserId: number;
  onSelectUser: (userId: number) => void;
  onClose: () => void;
}

export const SudoModal: React.FC<SudoModalProps> = ({
  users,
  currentUserId,
  onSelectUser,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Admin 'Login As' (Sudo) Mode</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-slate-600">
            Select a user account to assume their identity and troubleshoot review queues or view permissions. You can exit Sudo mode at any time.
          </p>

          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center justify-between"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{u.name}</p>
                  <p className="text-[11px] text-slate-500">@{u.username} • {u.role} ({u.access_level})</p>
                </div>
                <button
                  onClick={() => {
                    onSelectUser(u.id);
                    onClose();
                  }}
                  disabled={u.id === currentUserId}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition disabled:opacity-30 cursor-pointer"
                >
                  {u.id === currentUserId ? 'Active User' : 'Login As'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
