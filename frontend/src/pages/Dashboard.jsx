import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  Banknote, Receipt, AlertCircle, Users, 
  TrendingUp, ArrowUpRight, Plus, Download, Clock 
} from 'lucide-react';
import CashAlertBanner from '../components/CashAlertBanner';

export default function Dashboard({ setTab, onNewPaymentClick, onNewFineClick }) {
  const [cashStatus, setCashStatus] = useState(null);
  const [students, setStudents] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [cash, studs, pays] = await Promise.all([
        api.getCashStatus(),
        api.getStudents(),
        api.getPayments({ limit: 8 })
      ]);
      setCashStatus(cash);
      setStudents(studs);
      setRecentPayments(pays.slice(0, 8));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalOutstanding = students.reduce((acc, s) => acc + Number(s.overall_balance || 0), 0);
  const totalCollected = students.reduce((acc, s) => acc + Number(s.total_fee_paid || 0), 0);
  const totalFinesDue = students.reduce((acc, s) => acc + Number(s.total_fines_balance || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-500 text-sm animate-pulse">Loading dashboard records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CashAlertBanner cashStatus={cashStatus} onBatchClick={() => setTab('batches')} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash in Hand */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Cash in Safe / Hand</span>
            <div className={`p-2 rounded-lg ${cashStatus?.total_undeposited_cash >= 40000 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <Banknote className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            ₹{Number(cashStatus?.total_undeposited_cash || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Threshold: ₹40k - ₹50k</span>
            <button onClick={() => setTab('batches')} className="text-blue-600 hover:underline font-semibold flex items-center">
              Batch Bank <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Total Collected */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Fees Collected</span>
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
            ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-2 text-xs text-slate-500">Across all active academic profiles</p>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Balance Due</span>
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2 font-mono">
            ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Includes ₹{totalFinesDue.toLocaleString('en-IN')} in fines</span>
            <button onClick={() => setTab('reports')} className="text-blue-600 hover:underline font-semibold">
              View Dues
            </button>
          </div>
        </div>

        {/* Active Students */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Enrolled Students</span>
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2 font-mono">{students.length}</p>
          <p className="mt-2 text-xs text-slate-500">Eligible for academic fee tracking</p>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold">Counter Operations</h3>
          <p className="text-xs text-slate-400">Quick entry for daily cash register lookups & receipt logging</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewPaymentClick}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            Enter Fee Payment
          </button>
          <button
            onClick={onNewFineClick}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Levy Event Fine
          </button>
          <button
            onClick={() => api.downloadDailyReportExcel(new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0])}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export Today's Excel
          </button>
        </div>
      </div>

      {/* Recent Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Recent Payment Transactions</h3>
          </div>
          <button
            onClick={() => setTab('payments')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            View All Payments →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Receipt Date</th>
                <th className="px-4 py-3">Manual Receipt #</th>
                <th className="px-4 py-3">System #</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Deposit Status</th>
                <th className="px-4 py-3 text-right">Amount Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {recentPayments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-slate-400">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 text-slate-600">{p.payment_date}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{p.physical_receipt_no}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono">{p.internal_receipt_no}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.student_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.deposit_status === 'DEPOSITED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.deposit_status === 'DEPOSITED' ? 'Banked' : 'Cash In Safe'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(p.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
