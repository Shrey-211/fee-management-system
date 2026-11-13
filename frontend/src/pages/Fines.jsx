import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { AlertCircle, Plus, Search, Filter, X, CheckCircle } from 'lucide-react';
import StudentSelect from '../components/StudentSelect';
import ModalDialog from '../components/ModalDialog';

export default function Fines({ initialStudent, onClearInitialStudent, onSelectStudent, onPayFine }) {
  const [fines, setFines] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Custom Popup Dialog States
  const [waiveDialog, setWaiveDialog] = useState({ isOpen: false, fine: null, loading: false });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [eventName, setEventName] = useState('Krishna Utsav Absence');
  const [amount, setAmount] = useState('500');
  const [fineDate, setFineDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const [fList, sList] = await Promise.all([
        api.getFines(params),
        api.getStudents()
      ]);
      setFines(fList);
      setStudents(sList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  useEffect(() => {
    if (initialStudent) {
      setSelectedStudentId(initialStudent.id);
      setShowModal(true);
      if (onClearInitialStudent) onClearInitialStudent();
    }
  }, [initialStudent]);

  const handleCreateFine = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedStudentId) {
      setFormError('Please select a student (*).');
      return;
    }

    const trimmedEvent = (eventName || '').trim();
    if (!trimmedEvent) {
      setFormError('Event / Reason (*) is required. Please fill in this field.');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Fine Amount (₹) (*) must be greater than 0.');
      return;
    }

    if (!fineDate) {
      setFormError('Date Levied (*) is required. Please select the date.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createFine({
        student_id: parseInt(selectedStudentId),
        event_name: trimmedEvent,
        amount: amt,
        fine_date: fineDate,
        remarks: (remarks || '').trim() || null
      });
      setShowModal(false);
      setRemarks('');
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to apply fine. Please check input fields.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenWaiveConfirm = (fine) => {
    setWaiveDialog({
      isOpen: true,
      fine,
      loading: false
    });
  };

  const handleConfirmWaive = async () => {
    if (!waiveDialog.fine) return;
    setWaiveDialog(prev => ({ ...prev, loading: true }));
    try {
      await api.updateFine(waiveDialog.fine.id, { status: 'WAIVED', remarks: 'Waived by staff authority' });
      setWaiveDialog({ isOpen: false, fine: null, loading: false });
      loadData();
    } catch (e) {
      setWaiveDialog({ isOpen: false, fine: null, loading: false });
      setAlertModal({
        isOpen: true,
        type: 'danger',
        title: 'Action Failed',
        message: e.message || 'Failed to waive fine.'
      });
    }
  };

  const commonEvents = [
    'Krishna Utsav Absence',
    'Freshers Event Absence',
    'Send-off Party Absence',
    'Late Fee Assessment',
    'Dress Code Violation',
    'Library Overdue Fine'
  ];

  const filteredFines = fines.filter((f) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (f.student_name || '').toLowerCase().includes(q) ||
      (f.student_code || '').toLowerCase().includes(q) ||
      (f.event_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Filter and Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, ID code, or event..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white shrink-0"
          >
            <option value="">All Fine Statuses</option>
            <option value="UNPAID">UNPAID (Active Dues)</option>
            <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
            <option value="PAID">PAID</option>
            <option value="WAIVED">WAIVED</option>
          </select>
        </div>

        <button
          onClick={() => {
            setSelectedStudentId('');
            setShowModal(true);
          }}
          className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow shrink-0"
        >
          <Plus className="w-4 h-4" />
          Levy Event Fine
        </button>
      </div>

      {/* Fines Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Date Applied</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">ID Code</th>
                <th className="px-4 py-3">Event / Reason</th>
                <th className="px-4 py-3 text-right">Fine Levied</th>
                <th className="px-4 py-3 text-right">Paid Amount</th>
                <th className="px-4 py-3 text-right">Balance Due</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-slate-400">
                    Loading fines registry...
                  </td>
                </tr>
              ) : filteredFines.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-slate-400">
                    No fines recorded matching criteria.
                  </td>
                </tr>
              ) : (
                filteredFines.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 text-slate-600">{f.fine_date}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <button
                        onClick={() => onSelectStudent && onSelectStudent(f.student_id)}
                        className="hover:text-blue-600 hover:underline text-left"
                      >
                        {f.student_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{f.student_code}</td>
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
                    <td className="px-4 py-3 text-center space-x-2">
                      {f.status !== 'PAID' && f.status !== 'WAIVED' && (
                        <button
                          onClick={() => handleOpenWaiveConfirm(f)}
                          className="text-[11px] text-rose-600 hover:text-rose-800 font-medium underline"
                        >
                          Waive
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

      {/* Levy Fine Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Levy Event Fine</h3>
                <p className="text-xs text-slate-400">Apply a fine charge to student ledger</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFine} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Student *</label>
                <StudentSelect
                  students={students}
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  placeholder="-- Search & Choose Student by Name / ID --"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Event / Reason *</label>
                <input
                  type="text"
                  required
                  list="event-suggestions"
                  placeholder="e.g. Krishna Utsav Absence"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-semibold"
                />
                <datalist id="event-suggestions">
                  {commonEvents.map((ev, i) => (
                    <option key={i} value={ev} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fine Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date Levied *</label>
                  <input
                    type="date"
                    required
                    value={fineDate}
                    onChange={(e) => setFineDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks / Note</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Unexcused absence during annual college celebration"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                >
                  {submitting ? 'Applying...' : 'Apply Fine to Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waive Confirmation Modal */}
      <ModalDialog
        isOpen={waiveDialog.isOpen}
        type="warning"
        title="Confirm Fine Waiver"
        message={
          waiveDialog.fine
            ? `Are you sure you want to officially waive the fine of ₹${Number(waiveDialog.fine.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} for "${waiveDialog.fine.event_name}" (${waiveDialog.fine.student_name || 'Student'} - ${waiveDialog.fine.student_code})? The balance will be zeroed out on the student ledger.`
            : 'Are you sure you want to officially waive this fine?'
        }
        confirmText="Yes, Waive Fine"
        cancelText="Cancel"
        confirmVariant="warning"
        loading={waiveDialog.loading}
        onConfirm={handleConfirmWaive}
        onClose={() => setWaiveDialog({ isOpen: false, fine: null, loading: false })}
      />

      {/* Action / Error Notification Modal */}
      <ModalDialog
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        confirmText="Close"
        confirmVariant={alertModal.type === 'danger' ? 'danger' : 'primary'}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '', type: 'info' })}
      />
    </div>
  );
}

