import React, { useState } from 'react';
import { 
  LayoutDashboard, Users, Receipt, 
  AlertCircle, Award, FileSpreadsheet, Mail, Settings,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import collegeLogo from '../assets/college_logo_sm.png';

export default function Sidebar({ currentTab, setTab, user }) {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

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
    <aside 
      className={`${
        collapsed ? 'w-16 p-2' : 'w-64 p-4'
      } bg-white border-r border-slate-200 h-full flex flex-col justify-between shrink-0 transition-all duration-200 ease-in-out select-none overflow-y-auto`}
    >
      <div className="space-y-1">
        {/* Collapse Header / Toggle */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 py-2 mb-1`}>
          {!collapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Navigation Menu
            </span>
          )}
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand Sidebar (Wider View)" : "Collapse Sidebar (Full Width Table)"}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shadow-2xs"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-blue-600" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Buttons */}
        {allowedItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-2.5'
              } rounded-lg text-sm font-medium transition group relative ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200/80">
              <img src={collegeLogo} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shrink-0 shadow-xs" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-800 leading-tight truncate" title="Krishna Foundation's SJNNIMS, Phaltan">
                  KF's SJNNIMS
                </p>
                <p className="text-[10px] text-slate-500 truncate">Phaltan, Satara</p>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between items-center text-slate-700 font-semibold text-[11px]">
                <span>Offline Localhost</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              </div>
              <p className="text-[11px]">Database: <span className="font-mono text-slate-700">fees.db</span></p>
              <p className="text-[11px]">User: <span className="font-medium text-slate-700">{user?.username}</span></p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <img src={collegeLogo} alt="Logo" title="Krishna Foundation's SJNNIMS" className="w-7 h-7 rounded-lg object-contain bg-white border border-slate-200 p-0.5 shadow-xs" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" title="Offline Localhost Online"></span>
          </div>
        )}
      </div>
    </aside>
  );
}
