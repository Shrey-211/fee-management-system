import React from 'react';
import { ShieldCheck, LogOut, KeyRound, WifiOff } from 'lucide-react';

export default function Navbar({ user, onLogout, onChangePasswordClick }) {
  const roleBadgeColors = {
    admin: 'bg-rose-100 text-rose-800 border-rose-200',
    accountant: 'bg-blue-100 text-blue-800 border-blue-200',
    clerk: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg text-white shadow-md">
            ₹
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              Student Fee Management System
            </h1>
            <p className="text-xs text-slate-400">Designated PC Office Installation (Mr. Shrikant's PC)</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-right">
              <div>
                <p className="text-sm font-semibold text-slate-100">{user.full_name}</p>
                <div className="flex items-center justify-end gap-1">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full border ${roleBadgeColors[user.role] || 'bg-slate-800 text-slate-300'}`}>
                    {user.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-700" />

            <button
              onClick={onChangePasswordClick}
              title="Change Password"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <KeyRound className="w-4 h-4" />
            </button>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 hover:text-white hover:bg-rose-600/80 rounded-lg transition border border-rose-500/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

