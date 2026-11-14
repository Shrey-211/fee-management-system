import React from 'react';
import { 
  LayoutDashboard, Users, Receipt, 
  AlertCircle, Award, FileSpreadsheet, Mail, Settings 
} from 'lucide-react';
import collegeLogo from '../assets/college_logo_sm.png';

export default function Sidebar({ currentTab, setTab, user }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students Directory', icon: Users },
    { id: 'payments', label: 'Payments & Receipts', icon: Receipt },
    { id: 'fines', label: 'Event Fines', icon: AlertCircle },
    { id: 'scholarships', label: 'Scholarships', icon: Award },
    { id: 'reports', label: 'Reports & Excel Export', icon: FileSpreadsheet },
    { id: 'reminders', label: 'Email Reminders', icon: Mail },
    { id: 'settings', label: 'Settings & Backups', icon: Settings, adminOnly: true },
  ];

  const allowedItems = navItems.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    return true;
  });

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navigation Menu
        </div>
        {allowedItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-100 space-y-2.5">
        <div className="flex items-center gap-2.5 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200/80">
          <img src={collegeLogo} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0 shadow-xs" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-800 leading-tight truncate" title="Krishna Foundation's SJNNIMS, Phaltan">
              KF's SJNNIMS
            </p>
            <p className="text-[10px] text-slate-500 truncate">Phaltan, Satara</p>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-500 space-y-1">
          <div className="flex justify-between items-center text-slate-700 font-semibold">
            <span>Offline Localhost</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          </div>
          <p>Database: <span className="font-mono text-slate-700">fees.db</span></p>
          <p>Logged in as: <span className="font-medium text-slate-700">{user?.username}</span></p>
        </div>
      </div>
    </aside>
  );
}
