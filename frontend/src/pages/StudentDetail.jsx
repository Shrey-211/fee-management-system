import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  ArrowLeft, Receipt, Plus, AlertCircle, 
  Mail, Award, CheckCircle, Clock, FileText, Phone, MapPin, Edit3, X 
} from 'lucide-react';
import ModalDialog from '../components/ModalDialog';

export default function StudentDetail({ studentId, onBack, onRecordPayment, onLevyFine }) {
  const [student, setStudent] = useState(null);
  const [feeTypes, setFeeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState('');

  // Waive Dialog & Alert States
  const [waiveDialog, setWaiveDialog] = useState({ isOpen: false, fine: null, loading: false });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  // Edit Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const loadStudent = async () => {
    setLoading(true);
    try {
      const [data, types] = await Promise.all([
        api.getStudent(studentId),
        api.getFeeTypes('2026-2027').catch(() => [])
      ]);
      setStudent(data);
      setFeeTypes(types || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudent();
  }, [studentId]);

  const handleOpenEdit = () => {
    if (!student) return;
    setEditForm({
      full_name: student.full_name,
      gender: student.gender,
      category: student.category,
      concession_type_id: student.concession_type_id || '',
      mobile_number: student.mobile_number || '',
      email_address: student.email_address || '',
      address: student.address || '',
      course_branch: student.course_branch || '',
      current_year: student.current_year || 1
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');

    const trimmedName = (editForm.full_name || '').trim();
    if (!trimmedName) {
      setEditError('Full Student Name (*) is required. Please fill in this field.');
      return;
    }

    const payload = {
      ...editForm,
      full_name: trimmedName,
      concession_type_id: editForm.concession_type_id ? parseInt(editForm.concession_type_id) : null,
      mobile_number: (editForm.mobile_number || '').trim() || null,
      email_address: (editForm.email_address || '').trim() || null,
      address: (editForm.address || '').trim() || null,
      course_branch: (editForm.course_branch || '').trim() || null
    };

    setSavingEdit(true);
    try {
      await api.updateStudent(student.id, payload);
      setShowEditModal(false);
      loadStudent();
    } catch (err) {
      setEditError(err.message || 'Failed to update student profile.');
    } finally {
      setSavingEdit(false);
    }
  };

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

  const handleOpenWaiveFine = (fine) => {
    setWaiveDialog({ isOpen: true, fine, loading: false });
  };

  const handleConfirmWaiveFine = async () => {
    if (!waiveDialog.fine) return;
    setWaiveDialog(prev => ({ ...prev, loading: true }));
    try {
      await api.updateFine(waiveDialog.fine.id, { status: 'WAIVED', remarks: 'Waived by administrative authority' });
      setWaiveDialog({ isOpen: false, fine: null, loading: false });
      loadStudent();
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
          <button
            onClick={handleOpenEdit}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-300 shadow-sm transition"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
            Edit Profile & Types
          </button>

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
                          onClick={() => handleOpenWaiveFine(f)}
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
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.physical_receipt_no || '—'}</td>
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

      {/* Edit Student Profile & Types Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Edit Student Profile & Fee Types</h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {student.student_code} — {student.full_name}
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Full Student Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender *</label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {feeTypes.filter(t => t.type_group === 'GENDER').length > 0 ? (
                      feeTypes.filter(t => t.type_group === 'GENDER').map(t => (
                        <option key={t.id} value={t.code}>{t.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Caste / Category *</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {feeTypes.filter(t => t.type_group === 'CASTE').length > 0 ? (
                      feeTypes.filter(t => t.type_group === 'CASTE').map(t => (
                        <option key={t.id} value={t.code}>{t.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="OPEN">OPEN</option>
                        <option value="EBC">EBC</option>
                        <option value="SC">SC</option>
                        <option value="ST">ST</option>
                        <option value="OBC">OBC</option>
                        <option value="VJNT">VJNT</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Special Concession Quota (Optional)
                  </label>
                  <select
                    value={editForm.concession_type_id}
                    onChange={(e) => setEditForm({ ...editForm, concession_type_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="">-- None / Standard Rules --</option>
                    {feeTypes.filter(t => t.type_group === 'CUSTOM').map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Changing Gender or Caste/Type will automatically re-evaluate all fee heads and update the student ledger.
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={editForm.mobile_number}
                    onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email_address}
                    onChange={(e) => setEditForm({ ...editForm, email_address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow transition disabled:opacity-50"
                >
                  {savingEdit ? 'Saving & Recalculating...' : 'Save & Update Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waive Fine Confirmation Modal */}
      <ModalDialog
        isOpen={waiveDialog.isOpen}
        type="warning"
        title="Confirm Fine Waiver"
        message={
          waiveDialog.fine
            ? `Are you sure you want to officially waive the fine of ₹${Number(waiveDialog.fine.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} for "${waiveDialog.fine.event_name}"? The balance will be zeroed out on this student's ledger.`
            : 'Are you sure you want to officially waive this fine?'
        }
        confirmText="Yes, Waive Fine"
        cancelText="Cancel"
        confirmVariant="warning"
        loading={waiveDialog.loading}
        onConfirm={handleConfirmWaiveFine}
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

