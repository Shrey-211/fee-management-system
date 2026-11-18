import React, { useState } from 'react';
import { 
  AlertTriangle, Trash2, X, Receipt, CheckCircle, 
  Clock, ShieldAlert, ArrowRight, RefreshCw 
} from 'lucide-react';
import { api } from '../api/client';

export default function DeleteStudentModal({ 
  isOpen, 
  student, 
  onClose, 
  onClearDues, 
  onDeleted 
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !student) return null;

  const netDue = Number(student.net_fee_due || 0);
  const paidAmount = Number(student.total_fee_paid || 0);
  const feeBalance = Math.max(0, netDue - paidAmount);
  const finesBalance = Number(student.total_fines_balance || 0);
  const year1Arrears = Number(student.year_1_dues || 0);
  const totalOutstanding = Number(student.overall_balance !== undefined ? student.overall_balance : (feeBalance + finesBalance));
  const hasPendingFees = totalOutstanding > 0 || feeBalance > 0 || finesBalance > 0;

  const handleConfirmDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.deleteStudent(student.id);
      if (onDeleted) {
        onDeleted(student);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete student. Please try again.');
      setDeleting(false);
    }
  };

  const handleGoToClearDues = () => {
    onClose();
    if (onClearDues) {
      onClearDues(student);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Delete Student Profile</h3>
              <p className="text-[11px] text-slate-400">Permanent Database Deletion & Recalculation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Student Profile Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900 text-sm">{student.full_name}</span>
                <span className="ml-2 px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-200 text-slate-700">
                  {student.student_code}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                student.current_year === 2
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {student.current_year === 2 ? '2nd Year (MBA-II)' : '1st Year (MBA-I)'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 text-[11px]">
              <span>Category: <strong className="text-slate-700">{student.category}</strong></span>
              <span>Gender: <strong className="text-slate-700">{student.gender}</strong></span>
              <span>Academic Year: <strong className="text-slate-700">{student.academic_year}</strong></span>
              {student.mobile_number && (
                <span>Mobile: <strong className="text-slate-700">{student.mobile_number}</strong></span>
              )}
            </div>
          </div>

          {/* Pending Fees Check Alert */}
          {hasPendingFees ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50/80 overflow-hidden space-y-3 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-950 text-xs">
                    Pending Fee Dues: ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </h4>
                  <p className="text-amber-900 text-[11px] mt-0.5">
                    This student currently has unpaid dues on their ledger. Would you like to clear the pending fees first before deleting this record?
                  </p>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div className="bg-white rounded-lg border border-amber-200/80 p-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Net Applicable Fee:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    ₹{netDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Total Fee Paid to Date:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    ₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-100">
                  <span className="font-semibold text-slate-700">Pending Fee Balance:</span>
                  <span className="font-mono font-bold text-rose-600">
                    ₹{feeBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {finesBalance > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-amber-800">Unpaid Event Fines / Penalties:</span>
                    <span className="font-mono font-bold text-amber-700">
                      ₹{finesBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {student.current_year >= 2 && year1Arrears > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-amber-800">Unpaid 1st Year Arrears:</span>
                    <span className="font-mono font-bold text-amber-700">
                      ₹{year1Arrears.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                  <span>Total Outstanding Dues:</span>
                  <span className="font-mono text-sm text-rose-700">
                    ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-950 text-xs">
                  All Fees Fully Cleared (₹0.00 Balance)
                </h4>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  This student has completed all fee payments (Total Paid: ₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) and has no outstanding dues.
                </p>
              </div>
            </div>
          )}

          {/* Flow Impact Warning */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-600" />
              System Impact on Deletion:
            </span>
            <ul className="list-disc pl-4 space-y-0.5 text-[10.5px] text-slate-500">
              <li>Permanently deletes this student's profile, fee heads, receipts, and event fines.</li>
              <li>Dashboard totals (Fee Collections, Outstanding Balances, Student Count) will automatically adjust without this student.</li>
              <li>Daily collection and outstanding Excel reports will be recalculated without this student.</li>
              <li>An immutable security audit entry will be recorded in the Security Audit Trail.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {hasPendingFees && (
            <button
              type="button"
              onClick={handleGoToClearDues}
              disabled={deleting}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition order-1 sm:order-none"
            >
              <Receipt className="w-4 h-4" />
              Clear Fees First (Record Payment)
            </button>
          )}

          <div className="flex items-center justify-end gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold text-xs transition disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              {deleting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  {hasPendingFees ? 'Proceed with Deletion Anyway' : 'Confirm & Delete Student'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
