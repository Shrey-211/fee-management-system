import React from 'react';
import { ShieldCheck, LogOut, KeyRound, WifiOff } from 'lucide-react';
import collegeLogo from '../assets/college_logo_sm.png';

export default function Navbar({ user, onLogout, onChangePasswordClick }) {
  const roleBadgeColors = {
    admin: 'bg-rose-100 text-rose-800 border-rose-200',
    accountant: 'bg-blue-100 text-blue-800 border-blue-200',
    clerk: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30">
      <div className="w-full px-4 sm:px-6 lg:px-8 min-h-[4.25rem] py-2 flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <img
            src={collegeLogo}
            alt="College Logo"
            className="h-12 w-12 object-contain rounded-xl bg-white p-0.5 shadow-md border border-slate-700 shrink-0"
          />
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white leading-tight">
              Krishna Foundation's Shrimant Jayshreemaladevi Naik Nimbalkar Institute of Management Studies, Phaltan
            </h1>
            <p className="text-[11px] sm:text-xs text-blue-300 font-medium mt-0.5">
              Student Fee Management System <span className="text-slate-400 font-normal">| Designated Counter Station</span>
            </p>
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

