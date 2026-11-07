import React from 'react';
import { AlertTriangle, Banknote, ArrowRight } from 'lucide-react';

export default function CashAlertBanner({ cashStatus, onBatchClick }) {
  if (!cashStatus || cashStatus.alert_level === 'NORMAL' || cashStatus.total_undeposited_cash <= 0) {
    return null;
  }

  const isCritical = cashStatus.alert_level === 'CRITICAL';

  return (
    <div className={`mb-6 p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm transition ${
      isCritical 
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-900' 
        : 'bg-blue-500/10 border-blue-500/30 text-blue-900'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${isCritical ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold flex items-center gap-2">
            <span>Cash in Hand Advisory:</span>
            <span className="font-mono text-base font-extrabold">₹{Number(cashStatus.total_undeposited_cash).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </h4>
          <p className="text-xs opacity-90">
            {cashStatus.alert_message} ({cashStatus.unbatched_payments_count} physical cash receipts accumulated)
          </p>
        </div>
      </div>

      <button
        onClick={onBatchClick}
        className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition whitespace-nowrap ${
          isCritical
            ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        <Banknote className="w-4 h-4" />
        Deposit Cash to Bank Now
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
