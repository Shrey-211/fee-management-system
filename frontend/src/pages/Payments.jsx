import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  Receipt, Plus, Search, Filter, Calendar, 
  CheckCircle, X, AlertCircle, Edit3, Trash2, Award, Printer 
} from 'lucide-react';
import StudentSelect from '../components/StudentSelect';
import ModalDialog from '../components/ModalDialog';
import ReceiptModal from '../components/ReceiptModal';

export default function Payments({ initialStudent, onClearInitialStudent, onSelectStudent }) {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [paymentMode, setPaymentMode] = useState('');

  // Delete & Alert Modals
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, payment: null, loading: false });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '' });
  const [receiptModal, setReceiptModal] = useState({ isOpen: false, payment: null });

  // Payment Form State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [physicalReceiptNo, setPhysicalReceiptNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState('CASH');
  const [remarks, setRemarks] = useState('');
  const [headAllocations, setHeadAllocations] = useState({});
  const [fineAllocations, setFineAllocations] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPhysicalReceiptNo, setEditPhysicalReceiptNo] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editPaymentMode, setEditPaymentMode] = useState('CASH');
  const [editRemarks, setEditRemarks] = useState('');
  const [editItems, setEditItems] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  const loadPayments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (paymentMode) params.payment_mode = paymentMode;
      const data = await api.getPayments(params);
      setPayments(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await api.getStudents();
      setStudents(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPayments();
    loadStudents();
  }, [paymentMode]);

  // Open modal if initialStudent passed from other screens
  useEffect(() => {
    if (initialStudent) {
      handleOpenWithStudent(initialStudent);
      if (onClearInitialStudent) onClearInitialStudent();
    }
  }, [initialStudent]);

  const handleOpenWithStudent = async (student) => {
    setSelectedStudentId(student.id);
    setShowModal(true);
    try {
      const full = await api.getStudent(student.id);
      setSelectedStudentDetail(full);
      // Pre-populate allocations with 0
      const hMap = {};
      full.fee_heads.forEach(h => {
        hMap[h.fee_head_id] = '';
      });
      setHeadAllocations(hMap);

      const fMap = {};
      full.fines.forEach(f => {
        if (f.status !== 'WAIVED' && Number(f.balance) > 0) {
          fMap[f.id] = '';
        }
      });
      setFineAllocations(fMap);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStudentSelectChange = async (e, directStudent) => {
    const sId = e?.target?.value || '';
    setSelectedStudentId(sId);
    if (!sId) {
      setSelectedStudentDetail(null);
      return;
    }
    const student = directStudent || students.find(s => s.id === parseInt(sId));
    if (student) {
      handleOpenWithStudent(student);
    }
  };

  const handlePayFullHead = (headId, balance) => {
    setHeadAllocations(prev => ({
      ...prev,
      [headId]: String(balance)
    }));
  };

  const handlePayFullFine = (fineId, balance) => {
    setFineAllocations(prev => ({
      ...prev,
      [fineId]: String(balance)
    }));
  };

  const calculateTotalPaying = () => {
    let sum = 0;
    Object.values(headAllocations).forEach(val => {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0) sum += n;
    });
    Object.values(fineAllocations).forEach(val => {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0) sum += n;
    });
    return sum;
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedStudentId) {
      setFormError('Please select a student (*).');
      return;
    }

    const trimmedReceipt = (physicalReceiptNo || '').trim();

    if (!paymentDate) {
      setFormError('Receipt Date (*) is required. Please select the date.');
      return;
    }

    let hasNegative = false;
    Object.values({ ...headAllocations, ...fineAllocations }).forEach(v => {
      if (parseFloat(v) < 0) hasNegative = true;
    });
    if (hasNegative) {
      setFormError('Allocation amounts cannot be negative. Please enter valid positive amounts.');
      return;
    }

    const items = [];
    Object.entries(headAllocations).forEach(([fhId, amtStr]) => {
      const amt = parseFloat(amtStr);
      if (!isNaN(amt) && amt > 0) {
        items.push({ fee_head_id: parseInt(fhId), amount: amt });
      }
    });

    Object.entries(fineAllocations).forEach(([fId, amtStr]) => {
      const amt = parseFloat(amtStr);
      if (!isNaN(amt) && amt > 0) {
        items.push({ fine_id: parseInt(fId), amount: amt });
      }
    });

    if (items.length === 0) {
      setFormError('Please allocate an amount greater than ₹0 to at least one fee head or fine.');
      return;
    }

    setSubmitting(true);
    try {
      const recordedPayment = await api.createPayment({
        student_id: parseInt(selectedStudentId),
        physical_receipt_no: trimmedReceipt || null,
        payment_date: paymentDate,
        payment_mode: mode,
        remarks: (remarks || '').trim() || null,
        items
      });
      setShowModal(false);
      setPhysicalReceiptNo('');
      setRemarks('');
      await loadPayments();
      // Prompt user with official college printable receipt
      setReceiptModal({ isOpen: true, payment: recordedPayment });
    } catch (err) {
      setFormError(err.message || 'Payment entry failed. Please check input values.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (p) => {
    setEditingPayment(p);
    setEditPhysicalReceiptNo(p.physical_receipt_no || '');
    setEditPaymentDate(p.payment_date || '');
    setEditPaymentMode(p.payment_mode || 'CASH');
    setEditRemarks(p.remarks || '');
    setEditItems((p.items || []).map(itm => ({
      ...itm,
      amount: itm.amount
    })));
    setEditError('');
  };

  const handleEditItemAmountChange = (index, val) => {
    setEditItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], amount: val };
      return copy;
    });
  };

  const calculateEditTotal = () => {
    return editItems.reduce((sum, itm) => sum + (parseFloat(itm.amount) || 0), 0);
  };

  const handleSaveEditPayment = async (e) => {
    e.preventDefault();
    if (!editingPayment) return;
    setEditError('');

    const formattedItems = [];
    for (const itm of editItems) {
      const amt = parseFloat(itm.amount);
      if (isNaN(amt) || amt <= 0) {
        setEditError(`Amount for "${itm.fee_head_name || itm.fine_event_name}" must be greater than ₹0.`);
        return;
      }
      formattedItems.push({
        fee_head_id: itm.fee_head_id || null,
        fine_id: itm.fine_id || null,
        amount: amt
      });
    }

    if (formattedItems.length === 0) {
      setEditError('Payment must have at least one line item with an amount.');
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
      loadPayments();
    } catch (err) {
      setEditError(err.message || 'Failed to update payment receipt.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleOpenDeleteConfirm = (p) => {
    setDeleteModal({ isOpen: true, payment: p, loading: false });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.payment) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      await api.deletePayment(deleteModal.payment.id);
      setDeleteModal({ isOpen: false, payment: null, loading: false });
      loadPayments();
    } catch (err) {
      setDeleteModal({ isOpen: false, payment: null, loading: false });
      setAlertModal({
        isOpen: true,
        title: 'Deletion Failed',
        message: err.message || 'Failed to delete payment receipt.'
      });
    }
  };

  const filteredPayments = payments.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.physical_receipt_no && p.physical_receipt_no.toLowerCase().includes(q)) ||
      (p.internal_receipt_no && p.internal_receipt_no.toLowerCase().includes(q)) ||
      (p.student_name && p.student_name.toLowerCase().includes(q)) ||
      (p.student_code && p.student_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Filter and Entry Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filter by manual receipt #, student name, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
          >
            <option value="">All Payment Modes</option>
            <option value="CASH">Cash Only</option>
            <option value="UPI">UPI / QR</option>
            <option value="CHEQUE">Cheque</option>
            <option value="DD">Demand Draft (DD)</option>
            <option value="NEFT">NEFT / Bank Transfer</option>
            <option value="GOVT_SCHOLARSHIP">🏛️ Govt Scholarship (DBT)</option>
          </select>
        </div>

        <button
          onClick={() => {
            setSelectedStudentId('');
            setSelectedStudentDetail(null);
            setShowModal(true);
          }}
          className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow"
        >
          <Plus className="w-4 h-4" />
          Enter Physical Receipt
        </button>
      </div>

      {/* Payments History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Receipt Date</th>
                <th className="px-4 py-3">Manual Receipt #</th>
                <th className="px-4 py-3">System #</th>
                <th className="px-4 py-3">Student Particulars</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Fee Head Breakdown</th>
                <th className="px-4 py-3 text-right">Total Amount Received</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                    Loading payments registry...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                    No payment receipts found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 text-slate-600">{p.payment_date}</td>
                    <td className="px-4 py-3 font-mono font-black text-blue-900 bg-blue-50/30">
                      {p.physical_receipt_no || <span className="text-slate-400 font-normal italic">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">{p.internal_receipt_no}</td>
                    <td className="px-4 py-3">
                      <div 
                        onClick={() => onSelectStudent && onSelectStudent(p.student_id)}
                        className="font-bold text-slate-900 hover:text-blue-600 cursor-pointer"
                      >
                        {p.student_name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{p.student_code}</div>
                    </td>
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
                      <div className="space-y-0.5 text-[11px]">
                        {p.items.map((itm) => (
                          <div key={itm.id}>
                            {itm.fee_head_name || `Fine: ${itm.fine_event_name}`}: ₹{Number(itm.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">
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
                          onClick={() => handleOpenEditModal(p)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                          title="Edit Receipt Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDeleteConfirm(p)}
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

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Record Physical Book Fee Receipt</h3>
                <p className="text-xs text-slate-400">Log incoming payment from manual receipt book</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {formError}
                </div>
              )}

              {/* Student Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Student *</label>
                <StudentSelect
                  students={students}
                  value={selectedStudentId}
                  onChange={handleStudentSelectChange}
                  placeholder="-- Search & Choose Student by Name / ID --"
                  required
                />
              </div>

              {/* Physical Receipt # & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Manual Receipt Book # <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BOOK-12 / 0459 (optional)"
                    value={physicalReceiptNo}
                    onChange={(e) => setPhysicalReceiptNo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="DD">Demand Draft</option>
                    <option value="NEFT">NEFT / Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Fee Head Allocations Table */}
              {selectedStudentDetail && (
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-2">
                  <div className="p-2.5 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
                    <span>Applicable Fee Heads Allocation</span>
                    <span className="text-slate-500 font-normal">
                      Net Dues: ₹{Number(selectedStudentDetail.overall_balance).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3 space-y-2">
                    {selectedStudentDetail.fee_heads.map((h) => {
                      const bal = Number(h.balance);
                      return (
                        <div key={h.id} className="flex items-center justify-between gap-3 py-1 border-b border-slate-100 last:border-0">
                          <div className="flex-1">
                            <span className="font-semibold text-slate-800">{h.name}</span>
                            <span className="text-slate-400 ml-2">
                              (Due: <strong className="font-mono text-rose-600">₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>)
                            </span>
                            {bal <= 0 && <span className="ml-2 text-emerald-600 font-bold text-[10px]">CLEARED</span>}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {bal > 0 && (
                              <button
                                type="button"
                                onClick={() => handlePayFullHead(h.fee_head_id, bal)}
                                className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 rounded text-[10px] font-semibold border"
                              >
                                Full Due
                              </button>
                            )}
                            <div className="relative w-32">
                              <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={headAllocations[h.fee_head_id] || ''}
                                onChange={(e) => setHeadAllocations({ ...headAllocations, [h.fee_head_id]: e.target.value })}
                                className="w-full pl-6 pr-2 py-1.5 border rounded-lg text-right font-mono text-xs focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Unpaid Fines */}
                    {selectedStudentDetail.fines.filter(f => f.status !== 'WAIVED' && Number(f.balance) > 0).map((f) => {
                      const bal = Number(f.balance);
                      return (
                        <div key={f.id} className="flex items-center justify-between gap-3 py-1 bg-amber-50/50 px-2 rounded">
                          <div className="flex-1">
                            <span className="font-semibold text-amber-900">Fine: {f.event_name}</span>
                            <span className="text-slate-500 ml-2">
                              (Due: <strong className="font-mono text-rose-600">₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handlePayFullFine(f.id, bal)}
                              className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-[10px] font-semibold border border-amber-300"
                            >
                              Full Due
                            </button>
                            <div className="relative w-32">
                              <span className="absolute left-2.5 top-2 text-slate-400">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={fineAllocations[f.id] || ''}
                                onChange={(e) => setFineAllocations({ ...fineAllocations, [f.id]: e.target.value })}
                                className="w-full pl-6 pr-2 py-1.5 border rounded-lg text-right font-mono text-xs focus:ring-1 focus:ring-blue-600"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Total Paying Summary */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-900">Total Receipt Amount:</span>
                  <p className="text-[10px] text-blue-600">Sum of all entered fee allocations</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-blue-900 font-mono">
                    ₹{calculateTotalPaying().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Received at counter"
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
                  disabled={submitting || calculateTotalPaying() <= 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                >
                  {submitting ? 'Recording Receipt...' : 'Confirm & Save Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
                  System Receipt #{editingPayment.internal_receipt_no} | Student: {editingPayment.student_name}
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
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {editError}
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
                          onChange={(e) => handleEditItemAmountChange(idx, e.target.value)}
                          className="w-28 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-600 font-mono font-bold text-right text-slate-900 bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between mt-2">
                  <span className="font-bold text-emerald-900">Total Receipt Amount:</span>
                  <span className="font-mono font-black text-emerald-800 text-sm">
                    ₹{calculateEditTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                  disabled={editSubmitting || calculateEditTotal() <= 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                >
                  {editSubmitting ? 'Updating...' : 'Save & Recalculate Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled Delete Confirmation Modal */}
      <ModalDialog
        isOpen={deleteModal.isOpen}
        type="danger"
        title="Delete Payment Receipt"
        message={`Are you sure you want to permanently delete payment receipt ${deleteModal.payment?.internal_receipt_no || ''} for ₹${Number(deleteModal.payment?.total_amount || 0).toLocaleString('en-IN')}? This will immediately restore the student's pending balance in the fee ledger.`}
        confirmText="Yes, Delete Receipt"
        cancelText="Keep Receipt"
        confirmVariant="danger"
        loading={deleteModal.loading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModal({ isOpen: false, payment: null, loading: false })}
      />

      {/* Styled Alert / Error Modal */}
      <ModalDialog
        isOpen={alertModal.isOpen}
        type="alert"
        title={alertModal.title}
        message={alertModal.message}
        confirmText="OK"
        onConfirm={() => setAlertModal({ isOpen: false, title: '', message: '' })}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '' })}
      />

      {/* Official College Printable Receipt Modal */}
      <ReceiptModal
        isOpen={receiptModal.isOpen}
        payment={receiptModal.payment}
        onClose={() => setReceiptModal({ isOpen: false, payment: null })}
      />
    </div>
  );
}
