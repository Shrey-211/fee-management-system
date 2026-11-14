import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  Receipt, AlertCircle, Users, 
  TrendingUp, Plus, Download, Clock, Award, CheckCircle 
} from 'lucide-react';

export default function Dashboard({ setTab, onNewPaymentClick, onNewFineClick }) {
  const [students, setStudents] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [scholarships, setScholarships] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [studs, pays, scs] = await Promise.all([
        api.getStudents(),
        api.getPayments({ limit: 8 }),
        api.getScholarships().catch(() => [])
      ]);
      setStudents(studs || []);
      setRecentPayments((pays || []).slice(0, 8));
      setScholarships(scs || []);
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

  // Government Scholarship calculations
  const totalScholarshipClaims = scholarships.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const scholarshipReceived = scholarships.filter(s => s.status === 'RECEIVED').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const scholarshipPending = scholarships.filter(s => s.status !== 'RECEIVED').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const receivedCount = scholarships.filter(s => s.status === 'RECEIVED').length;
  const pendingCount = scholarships.filter(s => s.status !== 'RECEIVED').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-500 text-sm animate-pulse">Loading dashboard records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Collected */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Student Fees Collected</span>
              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-slate-900 mt-2 font-mono">
              ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Direct student payments</p>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Student Balance Due</span>
              <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-rose-600 mt-2 font-mono">
              ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Pending dues</span>
            <button onClick={() => setTab('reports')} className="text-blue-600 hover:underline font-semibold">
              View Dues
            </button>
          </div>
        </div>

        {/* Govt Scholarships Received */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Govt Grants Received</span>
              <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-emerald-700 mt-2 font-mono">
              ₹{scholarshipReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{receivedCount} claims disbursed</span>
            <button onClick={() => setTab('scholarships')} className="text-emerald-700 hover:underline font-semibold">
              Scholarships →
            </button>
          </div>
        </div>

        {/* Govt Scholarships Pending */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Pending Govt Grants</span>
              <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-amber-700 mt-2 font-mono">
              ₹{scholarshipPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{pendingCount} claims awaiting</span>
            <button onClick={() => setTab('scholarships')} className="text-amber-700 hover:underline font-semibold">
              Track Claims →
            </button>
          </div>
        </div>

        {/* Active Students */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Enrolled Students</span>
              <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-black text-slate-900 mt-2 font-mono">{students.length}</p>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Active profiles</span>
            <button onClick={() => setTab('students')} className="text-blue-600 hover:underline font-semibold">
              Directory →
            </button>
          </div>
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
                <th className="px-4 py-3 text-right">Amount Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {recentPayments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                    No payment transactions recorded yet.
                  </td>
                </tr>
              ) : (
                recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 text-slate-600">{p.payment_date}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{p.physical_receipt_no || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono">{p.internal_receipt_no}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{p.student_name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
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
