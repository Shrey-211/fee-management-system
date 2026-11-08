import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  ArrowLeft, Receipt, Plus, AlertCircle, 
  Mail, Award, CheckCircle, Clock, FileText, Phone, MapPin 
} from 'lucide-react';

export default function StudentDetail({ studentId, onBack, onRecordPayment, onLevyFine }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState('');

  const loadStudent = async () => {
    setLoading(true);
    try {
      const data = await api.getStudent(studentId);
      setStudent(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudent();
  }, [studentId]);

  const handleSendReminder = async () => {
    setEmailStatus('Sending reminder email...');
    try {
      const res = await api.sendReminders({
        student_ids: [student.id],
        target_due_date: 'Within 7 Days'
      });
      if (res.successful > 0) {
        setEmailStatus('Reminder email sent successfully to ' + student.email_address);
      } else {
        setEmailStatus('Failed to send email: ' + (res.details[0]?.error || 'SMTP or Network Error'));
      }
    } catch (e) {
      setEmailStatus('Error: ' + e.message);
    }
    setTimeout(() => setEmailStatus(''), 6000);
  };

  const handleWaiveFine = async (fineId) => {
    if (!window.confirm('Are you sure you want to waive this fine?')) return;
    try {
      await api.updateFine(fineId, { status: 'WAIVED', remarks: 'Waived by administrative authority' });
      loadStudent();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading || !student) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-slate-500 text-sm animate-pulse">Loading student ledger statement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Profile Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Students
        </button>

        <div className="flex items-center gap-2">
          {student.email_address && Number(student.overall_balance) > 0 && (
            <button
              onClick={handleSendReminder}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
            >
              <Mail className="w-3.5 h-3.5" />
              Send Email Reminder
            </button>
          )}

          <button
            onClick={() => onLevyFine(student)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Apply Fine
          </button>

          <button
            onClick={() => onRecordPayment(student)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
          >
            <Receipt className="w-3.5 h-3.5" />
            Record Payment Entry
          </button>
        </div>
      </div>

      {emailStatus && (
        <div className={`p-3 rounded-lg text-xs font-medium border ${
          emailStatus.includes('successfully') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {emailStatus}
        </div>
      )}

      {/* Student Particulars Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-slate-900">{student.full_name}</h2>
              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                {student.student_code}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {student.category}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {student.gender}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {student.course_branch} — Year {student.current_year} | Academic Session: {student.academic_year}
            </p>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Applicable</p>
              <p className="text-lg font-black text-slate-800 font-mono">
                ₹{Number(student.net_fee_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Paid</p>
              <p className="text-lg font-black text-emerald-600 font-mono">
                ₹{Number(student.total_fee_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Net Outstanding Due</p>
              <p className={`text-xl font-black font-mono ${Number(student.overall_balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                ₹{Number(student.overall_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>Mobile: <strong>{student.mobile_number || 'N/A'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-slate-400" />
            <span>Email: <strong>{student.email_address || 'N/A'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">Address: <strong>{student.address || 'N/A'}</strong></span>
          </div>
        </div>
      </div>

      {/* Applicable Fee Heads Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Applicable Fee Heads & Waiver Breakdown
          </h3>
          <span className="text-[11px] text-slate-500">
            Precision 2-decimal tracking
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Fee Head Name</th>
                <th className="px-4 py-2.5 text-right">Base Amount</th>
                <th className="px-4 py-2.5 text-center">Waiver %</th>
                <th className="px-4 py-2.5">Waiver Scheme Reason</th>
                <th className="px-4 py-2.5 text-right">Net Due</th>
                <th className="px-4 py-2.5 text-right">Paid Amount</th>
                <th className="px-4 py-2.5 text-right font-bold">Remaining Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {student.fee_heads.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-bold text-slate-800">{h.name}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    ₹{Number(h.base_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {Number(h.discount_percent) > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {Number(h.discount_percent)}% OFF
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">0%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 italic">
                    {h.waiver_reason || 'Standard Fee'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                    ₹{Number(h.net_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">
                    ₹{Number(h.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-extrabold">
                    {Number(h.balance) > 0 ? (
                      <span className="text-rose-600">
                        ₹{Number(h.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-emerald-600">₹0.00</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Fines Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Event Fines (Krishna Utsav, Freshers, Send-off, etc.)
            </h3>
          </div>
          <button
            onClick={() => onLevyFine(student)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            + Levy Fine
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Date Levied</th>
                <th className="px-4 py-2.5">Event / Reason</th>
                <th className="px-4 py-2.5 text-right">Fine Amount</th>
                <th className="px-4 py-2.5 text-right">Amount Paid</th>
                <th className="px-4 py-2.5 text-right font-bold">Remaining Balance</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {student.fines.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-4 text-center text-slate-400">
                    No event fines applied to this student.
                  </td>
                </tr>
              ) : (
                student.fines.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-600">{f.fine_date}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {f.event_name}
                      {f.remarks && <p className="text-[10px] text-slate-400 font-normal">{f.remarks}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-800">
                      ₹{Number(f.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700">
                      ₹{Number(f.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                      ₹{Number(f.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        f.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                        f.status === 'WAIVED' ? 'bg-slate-100 text-slate-600' :
                        f.status === 'PARTIALLY_PAID' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {f.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {f.status !== 'PAID' && f.status !== 'WAIVED' && (
                        <button
                          onClick={() => handleWaiveFine(f.id)}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-medium underline"
                        >
                          Waive Fine
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Payment Receipts History (Cross-referenced with Physical Books)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {student.payments.length} Transaction(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Payment Date</th>
                <th className="px-4 py-2.5">Manual Receipt #</th>
                <th className="px-4 py-2.5">System Audit #</th>
                <th className="px-4 py-2.5">Payment Mode</th>
                <th className="px-4 py-2.5">Allocation Items</th>
                <th className="px-4 py-2.5 text-right font-bold">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {student.payments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                    No payment receipts logged yet.
                  </td>
                </tr>
              ) : (
                student.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-700">{p.payment_date}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.physical_receipt_no}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{p.internal_receipt_no}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {p.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="space-y-0.5">
                        {p.items.map((itm) => (
                          <div key={itm.id} className="text-[11px]">
                            {itm.fee_head_name || `Fine: ${itm.fine_event_name}`}: ₹{Number(itm.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
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

