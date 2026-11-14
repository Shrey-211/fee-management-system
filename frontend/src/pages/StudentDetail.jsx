import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  ArrowLeft, Receipt, Plus, AlertCircle, 
  Mail, Award, CheckCircle, Clock, FileText, Phone, MapPin, Edit3, X, Trash2, Printer 
} from 'lucide-react';
import ModalDialog from '../components/ModalDialog';
import ReceiptModal from '../components/ReceiptModal';
import StudentStatementModal from '../components/StudentStatementModal';

export default function StudentDetail({ studentId, onBack, onRecordPayment, onLevyFine }) {
  const [student, setStudent] = useState(null);
  const [feeTypes, setFeeTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState('');

  // Waive Dialog & Alert States
  const [waiveDialog, setWaiveDialog] = useState({ isOpen: false, fine: null, loading: false });
  const [deletePaymentDialog, setDeletePaymentDialog] = useState({ isOpen: false, payment: null, loading: false });
  const [resetScholarshipDialog, setResetScholarshipDialog] = useState({ isOpen: false, scId: null, loading: false });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [receiptModal, setReceiptModal] = useState({ isOpen: false, payment: null });
  const [statementModal, setStatementModal] = useState(false);

  // Edit Profile Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPhysicalReceiptNo, setEditPhysicalReceiptNo] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState('CASH');
  const [editRemarks, setEditRemarks] = useState('');
  const [editItems, setEditItems] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editPaymentError, setEditPaymentError] = useState('');

  // Scholarship Installment Modal State
  const [scholarshipModal, setScholarshipModal] = useState({
    isOpen: false,
    sc: null,
    amount: '',
    sanctionNo: '',
    date: new Date().toISOString().split('T')[0],
    remarks: '',
    error: '',
    submitting: false
  });

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
      academic_year: student.academic_year || '2026-2027',
      gender: student.gender,
      category: student.category,
      concession_type_id: student.concession_type_id || '',
      mobile_number: student.mobile_number || '',
      email_address: student.email_address || '',
      address: student.address || '',
      course_branch: student.course_branch || 'MBA',
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
      academic_year: (editForm.academic_year || '2026-2027').trim(),
      concession_type_id: editForm.concession_type_id ? parseInt(editForm.concession_type_id) : null,
      mobile_number: (editForm.mobile_number || '').trim() || null,
      email_address: (editForm.email_address || '').trim() || null,
      address: (editForm.address || '').trim() || null,
      course_branch: (editForm.course_branch || 'MBA').trim()
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

  const handleOpenReceiveScholarship = (sc) => {
    const rem = sc.remaining_amount !== undefined 
      ? Number(sc.remaining_amount) 
      : Math.max(0, Number(sc.amount) - Number(sc.received_amount || 0));

    setScholarshipModal({
      isOpen: true,
      sc: sc,
      amount: rem > 0 ? rem.toString() : '',
      sanctionNo: sc.sanction_order_no || '',
      date: new Date().toISOString().split('T')[0],
      remarks: '',
      error: '',
      submitting: false
    });
  };

  const handleSubmitScholarshipPayment = async (e) => {
    e.preventDefault();
    const { sc, amount, sanctionNo, date, remarks } = scholarshipModal;
    const amt = parseFloat(amount);
    const rem = sc.remaining_amount !== undefined 
      ? Number(sc.remaining_amount) 
      : Math.max(0, Number(sc.amount) - Number(sc.received_amount || 0));

    if (isNaN(amt) || amt <= 0) {
      setScholarshipModal(prev => ({ ...prev, error: 'Please enter a valid amount greater than ₹0.' }));
      return;
    }
    if (amt > rem + 0.001) {
      setScholarshipModal(prev => ({ ...prev, error: `Amount cannot exceed remaining balance due (₹${rem.toLocaleString('en-IN')}).` }));
      return;
    }

    setScholarshipModal(prev => ({ ...prev, submitting: true, error: '' }));
    try {
      await api.markScholarshipReceived(sc.id, {
        amount: amt,
        sanction_order_no: sanctionNo ? sanctionNo.trim() : null,
        credit_date: date || null,
        remarks: remarks ? remarks.trim() : null
      });
      setScholarshipModal({
        isOpen: false,
        sc: null,
        amount: '',
        sanctionNo: '',
        date: new Date().toISOString().split('T')[0],
        remarks: '',
        error: '',
        submitting: false
      });
      loadStudent();
    } catch (err) {
      setScholarshipModal(prev => ({ ...prev, submitting: false, error: err.message || 'Failed to record disbursement.' }));
    }
  };

  const handleOpenResetScholarship = (scId) => {
    setResetScholarshipDialog({ isOpen: true, scId, loading: false });
  };

  const handleConfirmResetScholarship = async () => {
    if (!resetScholarshipDialog.scId) return;
    setResetScholarshipDialog(prev => ({ ...prev, loading: true }));
    try {
      await api.markScholarshipPending(resetScholarshipDialog.scId);
      setResetScholarshipDialog({ isOpen: false, scId: null, loading: false });
      loadStudent();
    } catch (err) {
      setResetScholarshipDialog({ isOpen: false, scId: null, loading: false });
      setAlertModal({
        isOpen: true,
        type: 'danger',
        title: 'Reset Failed',
        message: err.message || 'Failed to update scholarship status.'
      });
    }
  };

  const handleOpenEditPayment = (p) => {
    setEditingPayment(p);
    setEditPhysicalReceiptNo(p.physical_receipt_no || '');
    setEditPaymentDate(p.payment_date || '');
    setEditPaymentMode(p.payment_mode || 'CASH');
    setEditRemarks(p.remarks || '');
    setEditItems((p.items || []).map(itm => ({
      ...itm,
      amount: itm.amount
    })));
    setEditPaymentError('');
  };

  const handleEditPaymentItemChange = (index, val) => {
    setEditItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], amount: val };
      return copy;
    });
  };

  const calculateEditPaymentTotal = () => {
    return editItems.reduce((sum, itm) => sum + (parseFloat(itm.amount) || 0), 0);
  };

  const handleSaveEditPayment = async (e) => {
    e.preventDefault();
    if (!editingPayment) return;
    setEditPaymentError('');

    const formattedItems = [];
    for (const itm of editItems) {
      const amt = parseFloat(itm.amount);
      if (isNaN(amt) || amt <= 0) {
        setEditPaymentError(`Amount for "${itm.fee_head_name || itm.fine_event_name}" must be greater than ₹0.`);
        return;
      }
      formattedItems.push({
        fee_head_id: itm.fee_head_id || null,
        fine_id: itm.fine_id || null,
        amount: amt
      });
    }

    if (formattedItems.length === 0) {
      setEditPaymentError('Payment must have at least one line item with an amount.');
      return;
    }

    setEditSubmitting(true);
    try {
      await api.updatePayment(editingPayment.id, {
        physical_receipt_no: (editPhysicalReceiptNo || '').trim() || null,
        payment_date: editPaymentDate || null,
        payment_mode: editPaymentMode,
        remarks: (editRemarks || '').trim() || null,
        items: formattedItems
      });
      setEditingPayment(null);
      loadStudent();
    } catch (err) {
      setEditPaymentError(err.message || 'Failed to update payment receipt.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenDeletePayment = (p) => {
    setDeletePaymentDialog({ isOpen: true, payment: p, loading: false });
  };

  const handleConfirmDeletePayment = async () => {
    if (!deletePaymentDialog.payment) return;
    setDeletePaymentDialog(prev => ({ ...prev, loading: true }));
    try {
      await api.deletePayment(deletePaymentDialog.payment.id);
      setDeletePaymentDialog({ isOpen: false, payment: null, loading: false });
      loadStudent();
    } catch (err) {
      setDeletePaymentDialog({ isOpen: false, payment: null, loading: false });
      setAlertModal({
        isOpen: true,
        type: 'danger',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete payment receipt.'
      });
    }
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
            onClick={() => setStatementModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition"
            title="Print Official Student Fee Statement"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            Print Fee Statement
          </button>

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
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {student.category}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {student.gender}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Program: <strong>{student.course_branch || 'MBA'}</strong> | Academic Session: <strong>{student.academic_year || '2026-2027'}</strong>
            </p>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Applicable</p>
              <p className="text-lg font-black text-slate-800 font-mono">
                ₹{Number(student.net_fee_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            {Number(student.scholarship_total || 0) > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Govt Scholarship</p>
                <p className="text-lg font-black text-amber-700 font-mono">
                  ₹{Number(student.scholarship_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
                <div className="text-[10px] font-semibold mt-0.5">
                  {Number(student.scholarship_pending || 0) === 0 ? (
                    <span className="text-emerald-700 font-bold flex items-center justify-end gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600" /> All Received
                    </span>
                  ) : Number(student.scholarship_received || 0) > 0 ? (
                    <div className="flex flex-col text-right">
                      <span className="text-emerald-700 font-bold">
                        ₹{Number(student.scholarship_received).toLocaleString('en-IN')} Received
                      </span>
                      <span className="text-amber-700 font-medium">
                        ₹{Number(student.scholarship_pending).toLocaleString('en-IN')} Pending
                      </span>
                    </div>
                  ) : (
                    <span className="text-amber-700 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3 text-amber-600" /> ₹{Number(student.scholarship_pending).toLocaleString('en-IN')} Pending
                    </span>
                  )}
                </div>
              </div>
            )}
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

      {/* Government Scholarships & Category Subsidies Section */}
      {student.scholarships && student.scholarships.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-amber-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Government Scholarships & Category Subsidies
              </h3>
            </div>
            <span className="text-[11px] text-amber-700 font-semibold">
              Category fee waivers are claims on government grants
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Fee Head</th>
                  <th className="px-4 py-2.5">Scholarship Scheme</th>
                  <th className="px-4 py-2.5 text-right">Sanctioned (₹)</th>
                  <th className="px-4 py-2.5 text-right">Received (₹)</th>
                  <th className="px-4 py-2.5 text-right">Remaining Due (₹)</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Sanction Order #</th>
                  <th className="px-4 py-2.5">Credit Date</th>
                  <th className="px-4 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {student.scholarships.map((sc) => {
                  const amt = Number(sc.amount || 0);
                  const rec = Number(sc.received_amount !== undefined ? sc.received_amount : (sc.status === 'RECEIVED' ? sc.amount : 0));
                  const rem = sc.remaining_amount !== undefined ? Number(sc.remaining_amount) : Math.max(0, amt - rec);
                  const isRec = sc.status === 'RECEIVED' || rem <= 0.001;
                  const isPartial = sc.status === 'PARTIALLY_RECEIVED' || (rec > 0 && rem > 0.001);

                  return (
                    <tr key={sc.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {sc.fee_head_name || 'General Tuition/Dev'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{sc.scholarship_name}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                        ₹{rec.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {rem > 0.001 ? (
                          <span className="text-amber-700">₹{rem.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-slate-400">₹0.00</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isRec ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> FULLY RECEIVED
                          </span>
                        ) : isPartial ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                            <Clock className="w-3 h-3 text-blue-600" /> PARTIAL STEP
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" /> NOT RECEIVED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{sc.sanction_order_no || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{sc.credit_date || <span className="text-amber-600 italic">Pending Govt</span>}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {rem > 0.001 && (
                            <button
                              onClick={() => handleOpenReceiveScholarship(sc)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition shadow-sm"
                            >
                              + Receive Step
                            </button>
                          )}
                          {rec > 0.001 && (
                            <button
                              onClick={() => handleOpenResetScholarship(sc.id)}
                              className="text-slate-400 hover:text-amber-600 text-[11px] transition"
                              title="Reset all recorded steps for this scholarship"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <th className="px-4 py-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {student.payments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-slate-400">
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
                      {p.payment_mode === 'GOVT_SCHOLARSHIP' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
                          <Award className="w-3 h-3 text-emerald-600" /> Govt Scholarship (DBT)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {p.payment_mode}
                        </span>
                      )}
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
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setReceiptModal({ isOpen: true, payment: p })}
                          className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded transition"
                          title="Print Official College Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditPayment(p)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                          title="Edit Receipt Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDeletePayment(p)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition"
                          title="Delete Receipt & Restore Dues"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                <div>
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
                  <label className="block font-semibold text-slate-700 mb-1">Academic Year * (e.g. 2026-2027)</label>
                  <input
                    type="text"
                    required
                    value={editForm.academic_year || '2026-2027'}
                    onChange={(e) => setEditForm({ ...editForm, academic_year: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Program / Course</label>
                  <input
                    type="text"
                    value={editForm.course_branch || 'MBA'}
                    onChange={(e) => setEditForm({ ...editForm, course_branch: e.target.value })}
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

      {/* Edit Payment Receipt Modal */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-blue-400" /> Edit Payment Receipt
                </h3>
                <p className="text-xs text-slate-400">
                  System Receipt #{editingPayment.internal_receipt_no} | Student: {student.full_name}
                </p>
              </div>
              <button
                onClick={() => setEditingPayment(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPayment} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto text-xs">
              {editPaymentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {editPaymentError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Manual Receipt #</label>
                  <input
                    type="text"
                    placeholder="e.g. 1042"
                    value={editPhysicalReceiptNo}
                    onChange={(e) => setEditPhysicalReceiptNo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    required
                    value={editPaymentDate}
                    onChange={(e) => setEditPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payment Mode *</label>
                  <select
                    value={editPaymentMode}
                    onChange={(e) => setEditPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="DD">Demand Draft (DD)</option>
                    <option value="NEFT">NEFT / Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Line items allocation edit */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="font-bold text-slate-800">Fee Head / Fine Line Item Allocation (₹):</p>
                <div className="space-y-2">
                  {editItems.map((itm, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <span className="font-semibold text-slate-800">
                        {itm.fee_head_name || `Fine: ${itm.fine_event_name}`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          min="0.01"
                          value={itm.amount}
                          onChange={(e) => handleEditPaymentItemChange(idx, e.target.value)}
                          className="w-28 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-600 font-mono font-bold text-right text-slate-900 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between mt-2">
                  <span className="font-bold text-emerald-900">Total Receipt Amount:</span>
                  <span className="font-mono font-black text-emerald-800 text-sm">
                    ₹{calculateEditPaymentTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Corrected receipt entry"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || calculateEditPaymentTotal() <= 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                >
                  {editSubmitting ? 'Updating...' : 'Save & Recalculate Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scholarship Disbursement / Installment Modal */}
      {scholarshipModal.isOpen && scholarshipModal.sc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Record Government Scholarship Step</h3>
                  <p className="text-xs text-slate-500">
                    {student.full_name} &bull; {scholarshipModal.sc.fee_head_name || 'General'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setScholarshipModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const sc = scholarshipModal.sc;
              const totalClaim = Number(sc.amount || 0);
              const alreadyRec = Number(sc.received_amount !== undefined ? sc.received_amount : (sc.status === 'RECEIVED' ? sc.amount : 0));
              const currentRem = sc.remaining_amount !== undefined ? Number(sc.remaining_amount) : Math.max(0, totalClaim - alreadyRec);
              const enteredVal = parseFloat(scholarshipModal.amount) || 0;
              const afterRem = Math.max(0, currentRem - enteredVal);

              return (
                <form onSubmit={handleSubmitScholarshipPayment} className="space-y-4 pt-4 text-xs">
                  {scholarshipModal.error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{scholarshipModal.error}</span>
                    </div>
                  )}

                  {/* Summary Banner */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                    <div className="text-slate-700 font-medium">
                      Scheme: <span className="font-bold text-slate-900">{sc.scholarship_name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-amber-200/60 text-center">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Claim</div>
                        <div className="font-mono font-bold text-slate-800">
                          ₹{totalClaim.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-emerald-700 uppercase font-semibold">Received to Date</div>
                        <div className="font-mono font-bold text-emerald-700">
                          ₹{alreadyRec.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-700 uppercase font-semibold">Remaining Due</div>
                        <div className="font-mono font-black text-amber-800">
                          ₹{currentRem.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Disbursement Amount Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-800">
                        Disbursement Amount Received in this Step (₹) *
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setScholarshipModal(prev => ({ ...prev, amount: currentRem.toString(), error: '' }))}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold transition"
                        >
                          Full Due (₹{currentRem.toLocaleString('en-IN')})
                        </button>
                        {currentRem > 1 && (
                          <button
                            type="button"
                            onClick={() => setScholarshipModal(prev => ({ ...prev, amount: Math.round(currentRem / 2).toString(), error: '' }))}
                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-semibold transition"
                          >
                            50% (₹{Math.round(currentRem / 2).toLocaleString('en-IN')})
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={currentRem}
                      required
                      placeholder={`e.g. ${currentRem}`}
                      value={scholarshipModal.amount}
                      onChange={(e) => setScholarshipModal(prev => ({ ...prev, amount: e.target.value, error: '' }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-base font-bold text-slate-900"
                    />

                    {enteredVal > 0 && enteredVal <= currentRem && (
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                        <span>Remaining after this step:</span>
                        <span className="font-mono font-bold text-slate-900">
                          ₹{afterRem.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {afterRem === 0 && (
                            <span className="ml-1 text-emerald-600 font-semibold">(Will be 100% Cleared)</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Sanction Order & Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Sanction Order / DBT Ref #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MAHA-2026-9812"
                        value={scholarshipModal.sanctionNo}
                        onChange={(e) => setScholarshipModal(prev => ({ ...prev, sanctionNo: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Disbursement Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={scholarshipModal.date}
                        onChange={(e) => setScholarshipModal(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Bank Advice / Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1st Installment credited via PFMS / Social Welfare"
                      value={scholarshipModal.remarks}
                      onChange={(e) => setScholarshipModal(prev => ({ ...prev, remarks: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setScholarshipModal(prev => ({ ...prev, isOpen: false }))}
                      className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={scholarshipModal.submitting || !scholarshipModal.amount || parseFloat(scholarshipModal.amount) <= 0}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                    >
                      {scholarshipModal.submitting ? 'Recording...' : 'Confirm & Credit Step'}
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* Styled Delete Payment Confirmation Modal */}
      <ModalDialog
        isOpen={deletePaymentDialog.isOpen}
        type="danger"
        title="Delete Payment Receipt"
        message={`Are you sure you want to permanently delete payment receipt ${deletePaymentDialog.payment?.internal_receipt_no || ''} for ₹${Number(deletePaymentDialog.payment?.total_amount || 0).toLocaleString('en-IN')}? This will restore the student's pending balance in the ledger.`}
        confirmText="Yes, Delete Receipt"
        cancelText="Cancel"
        confirmVariant="danger"
        loading={deletePaymentDialog.loading}
        onConfirm={handleConfirmDeletePayment}
        onClose={() => setDeletePaymentDialog({ isOpen: false, payment: null, loading: false })}
      />

      {/* Styled Reset Scholarship Confirmation Modal */}
      <ModalDialog
        isOpen={resetScholarshipDialog.isOpen}
        type="warning"
        title="Reset Government Scholarship"
        message="Are you sure you want to reset all recorded disbursements for this scholarship back to NOT RECEIVED? Any generated scholarship receipts will also be deleted."
        confirmText="Yes, Reset to Not Received"
        cancelText="Cancel"
        confirmVariant="warning"
        loading={resetScholarshipDialog.loading}
        onConfirm={handleConfirmResetScholarship}
        onClose={() => setResetScholarshipDialog({ isOpen: false, scId: null, loading: false })}
      />

      {/* Generic Alert Modal */}
      <ModalDialog
        isOpen={alertModal.isOpen}
        type={alertModal.type || 'info'}
        title={alertModal.title}
        message={alertModal.message}
        confirmText="OK"
        onConfirm={() => setAlertModal({ isOpen: false, title: '', message: '', type: 'info' })}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '', type: 'info' })}
      />

      {/* Official College Printable Receipt Modal */}
      <ReceiptModal
        isOpen={receiptModal.isOpen}
        payment={receiptModal.payment}
        student={student}
        onClose={() => setReceiptModal({ isOpen: false, payment: null })}
      />

      {/* Official College Printable Student Fee Statement */}
      <StudentStatementModal
        isOpen={statementModal}
        student={student}
        onClose={() => setStatementModal(false)}
      />
    </div>
  );
}

