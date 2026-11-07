import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  Receipt, Plus, Search, Filter, Calendar, 
  CheckCircle, Banknote, X, AlertCircle 
} from 'lucide-react';

export default function Payments({ initialStudent, onClearInitialStudent, onSelectStudent }) {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [depositStatus, setDepositStatus] = useState('');

  // Payment Form State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [physicalReceiptNo, setPhysicalReceiptNo] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState('CASH');
  const [bankDepositDate, setBankDepositDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [headAllocations, setHeadAllocations] = useState({});
  const [fineAllocations, setFineAllocations] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadPayments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (paymentMode) params.payment_mode = paymentMode;
      if (depositStatus) params.deposit_status = depositStatus;
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
  }, [paymentMode, depositStatus]);

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

  const handleStudentSelectChange = async (e) => {
    const sId = e.target.value;
    setSelectedStudentId(sId);
    if (!sId) {
      setSelectedStudentDetail(null);
      return;
    }
    const student = students.find(s => s.id === parseInt(sId));
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

    if (!physicalReceiptNo.trim()) {
      setFormError('Please enter the physical receipt book number');
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
      setFormError('Please allocate an amount to at least one fee head or fine');
      return;
    }

    setSubmitting(true);
    try {
      await api.createPayment({
        student_id: parseInt(selectedStudentId),
        physical_receipt_no: physicalReceiptNo.trim(),
        payment_date: paymentDate,
        payment_mode: mode,
        bank_deposit_date: bankDepositDate || null,
        remarks: remarks.trim() || null,
        items
      });
      setShowModal(false);
      setPhysicalReceiptNo('');
      setRemarks('');
      loadPayments();
    } catch (err) {
      setFormError(err.message || 'Payment entry failed');
    } finally {
      setSubmitting(false);
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
          </select>

          <select
            value={depositStatus}
            onChange={(e) => setDepositStatus(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
          >
            <option value="">All Deposit Status</option>
            <option value="UNDEPOSITED_CASH">Cash in Safe / Undeposited</option>
            <option value="DEPOSITED">Deposited to Bank</option>
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
                <th className="px-4 py-3">Deposit Status</th>
                <th className="px-4 py-3">Fee Head Breakdown</th>
                <th className="px-4 py-3 text-right">Total Amount</th>
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
                      {p.physical_receipt_no}
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
                    <td className="px-4 py-3 text-slate-600">
                      <div className="space-y-0.5 text-[11px]">
                        {p.items.map((itm) => (
                          <div key={itm.id}>
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

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Record Physical Book Fee Receipt</h3>
                <p className="text-xs text-slate-400">Cross-reference paper receipt book with system ledger</p>
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
                <select
                  required
                  value={selectedStudentId}
                  onChange={handleStudentSelectChange}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  <option value="">-- Choose Student by Name / ID --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.student_code} — {s.full_name} ({s.category}, Balance: ₹{Number(s.overall_balance).toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Physical Receipt # & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Manual Receipt Book # *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BOOK-12 / 0459"
                    value={physicalReceiptNo}
                    onChange={(e) => setPhysicalReceiptNo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Payment Date (Receipt Date) *
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
                    <option value="CASH">Cash (In Hand / Safe)</option>
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
                  <p className="text-[10px] text-blue-600">Sum of all entered fee head allocations</p>
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
                  placeholder="e.g. Paid in cash at counter / Batch 1"
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
    </div>
  );
}
