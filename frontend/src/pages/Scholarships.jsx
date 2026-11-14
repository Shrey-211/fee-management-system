import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Award, Plus, Search, X, CheckCircle, Clock, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import StudentSelect from '../components/StudentSelect';

export default function Scholarships() {
  const [scholarships, setScholarships] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeHeads, setFeeHeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, NOT_RECEIVED, RECEIVED
  const [showModal, setShowModal] = useState(false);

  // Mark Received Modal State
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [receiveOrderNo, setReceiveOrderNo] = useState('');
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState('');

  // Form State for manual entry
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [feeHeadId, setFeeHeadId] = useState('');
  const [scholarshipName, setScholarshipName] = useState('MahaDBT Post-Matric Scholarship');
  const [sanctionOrderNo, setSanctionOrderNo] = useState('');
  const [creditDate, setCreditDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [scList, sList, fhList] = await Promise.all([
        api.getScholarships(),
        api.getStudents(),
        api.getFeeHeads()
      ]);
      setScholarships(scList);
      setStudents(sList);
      setFeeHeads(fhList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordScholarship = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedStudentId) {
      setFormError('Please select a student (*).');
      return;
    }

    const trimmedScheme = (scholarshipName || '').trim();
    if (!trimmedScheme) {
      setFormError('Scholarship Scheme Name (*) is required. Please fill in this field.');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Scholarship Amount (₹) (*) must be greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createScholarship({
        student_id: parseInt(selectedStudentId),
        fee_head_id: feeHeadId ? parseInt(feeHeadId) : null,
        scholarship_name: trimmedScheme,
        sanction_order_no: (sanctionOrderNo || '').trim() || null,
        credit_date: creditDate || null,
        amount: amt,
        status: creditDate ? 'RECEIVED' : 'NOT_RECEIVED',
        remarks: (remarks || '').trim() || (creditDate ? 'Disbursed' : 'Not Received')
      });
      setShowModal(false);
      setAmount('');
      setSanctionOrderNo('');
      setRemarks('');
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to record scholarship credit. Please check input fields.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReceiveModal = (sc) => {
    setReceiveTarget(sc);
    setReceiveOrderNo(sc.sanction_order_no || '');
    setReceiveDate(new Date().toISOString().split('T')[0]);
    setReceiveRemarks('');
    setReceiveError('');
  };

  const handleConfirmReceived = async (e) => {
    e.preventDefault();
    if (!receiveTarget) return;

    setReceiving(true);
    setReceiveError('');
    try {
      await api.markScholarshipReceived(receiveTarget.id, {
        sanction_order_no: (receiveOrderNo || '').trim() || null,
        credit_date: receiveDate || null,
        remarks: (receiveRemarks || '').trim() || null
      });
      setReceiveTarget(null);
      loadData();
    } catch (err) {
      setReceiveError(err.message || 'Failed to mark scholarship as received.');
    } finally {
      setReceiving(false);
    }
  };

  const handleMarkPending = async (sc) => {
    if (!window.confirm(`Reset scholarship for ${sc.student_name} back to 'NOT RECEIVED'?`)) {
      return;
    }
    try {
      await api.markScholarshipPending(sc.id);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to update scholarship status.');
    }
  };

  const schemes = [
    'MahaDBT Post-Matric Scholarship',
    'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti (EBC)',
    'Dr. Punjabrao Deshmukh Vasatigruh Nirvah Bhatta Yojna',
    'Post Matric Scholarship for Persons with Disability',
    'State Minority Scholarship'
  ];

  // Statistics
  const totalAmount = scholarships.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
  const pendingScholarships = scholarships.filter(s => s.status === 'NOT_RECEIVED');
  const pendingAmount = pendingScholarships.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
  const receivedScholarships = scholarships.filter(s => s.status === 'RECEIVED');
  const receivedAmount = receivedScholarships.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);

  const filteredScholarships = scholarships.filter((s) => {
    if (statusFilter !== 'ALL' && s.status !== statusFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.student_name || '').toLowerCase().includes(q) ||
      (s.student_code || '').toLowerCase().includes(q) ||
      (s.scholarship_name || '').toLowerCase().includes(q) ||
      (s.sanction_order_no || '').toLowerCase().includes(q) ||
      (s.academic_year || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Govt Claims</p>
            <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">{scholarships.length} student claims enrolled</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Pending From Government
            </p>
            <p className="text-xl font-bold text-amber-700 mt-1 font-mono">
              ₹{pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">{pendingScholarships.length} claims awaiting grant</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Received & Disbursed
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1 font-mono">
              ₹{receivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{receivedScholarships.length} claims credited to college</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Claims ({scholarships.length})
          </button>
          <button
            onClick={() => setStatusFilter('NOT_RECEIVED')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'NOT_RECEIVED'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-amber-700 hover:bg-amber-100/60'
            }`}
          >
            <Clock className="w-3 h-3" />
            Pending ({pendingScholarships.length})
          </button>
          <button
            onClick={() => setStatusFilter('RECEIVED')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 ${
              statusFilter === 'RECEIVED'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 hover:bg-emerald-100/60'
            }`}
          >
            <CheckCircle className="w-3 h-3" />
            Received ({receivedScholarships.length})
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto flex-1 max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or scheme..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
            />
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Manual Claim
          </button>
        </div>
      </div>

      {/* Scholarships Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Academic Year</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Fee Head</th>
                <th className="px-4 py-3">Scholarship Scheme</th>
                <th className="px-4 py-3 text-right">Amount (₹)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sanction Order #</th>
                <th className="px-4 py-3">Credit Date</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-slate-400">
                    Loading scholarships...
                  </td>
                </tr>
              ) : filteredScholarships.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-slate-400">
                    No scholarship claims found for the selected view.
                  </td>
                </tr>
              ) : (
                filteredScholarships.map((s) => {
                  const isReceived = s.status === 'RECEIVED';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{s.student_name}</div>
                        <div className="text-[11px] text-slate-400 font-normal">MBA Program</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {s.academic_year || '25-26'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {s.student_category || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {s.fee_head_name || 'General Tuition/Dev'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {s.scholarship_name}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        ₹{Number(s.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        {isReceived ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            RECEIVED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            NOT RECEIVED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {s.sanction_order_no || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.credit_date || <span className="text-amber-600 italic">Pending Govt</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!isReceived ? (
                          <button
                            onClick={() => handleOpenReceiveModal(s)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 mx-auto transition shadow-sm"
                            title="Mark this government scholarship as received"
                          >
                            <CheckCircle className="w-3 h-3" /> Mark Received
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkPending(s)}
                            className="text-slate-400 hover:text-amber-600 font-medium text-[11px] flex items-center gap-1 mx-auto transition"
                            title="Reset to Not Received"
                          >
                            <RefreshCw className="w-3 h-3" /> Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Scholarship Received Modal */}
      {receiveTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Record Government Disbursement
                </h3>
                <p className="text-xs text-emerald-100">Disbursed funds will credit to the college collection ledger</p>
              </div>
              <button onClick={() => setReceiveTarget(null)} className="text-emerald-200 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceived} className="p-6 space-y-4 text-xs">
              {receiveError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {receiveError}
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-bold text-slate-800">{receiveTarget.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheme:</span>
                  <span className="font-semibold text-slate-800">{receiveTarget.scholarship_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Fee Head:</span>
                  <span className="font-semibold text-slate-800">{receiveTarget.fee_head_name || 'General Tuition/Dev'}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-700 font-bold">Claim Amount:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ₹{Number(receiveTarget.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sanction Order / DBT Reference #</label>
                <input
                  type="text"
                  placeholder="e.g. MAHA-DBT-2026-8812"
                  value={receiveOrderNo}
                  onChange={(e) => setReceiveOrderNo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Disbursement / Credit Date *</label>
                <input
                  type="date"
                  required
                  value={receiveDate}
                  onChange={(e) => setReceiveDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Credited via State Treasury DBT"
                  value={receiveRemarks}
                  onChange={(e) => setReceiveRemarks(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setReceiveTarget(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={receiving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  {receiving ? 'Updating...' : 'Confirm Received'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Add Scholarship Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Record Manual Scholarship Claim</h3>
                <p className="text-xs text-slate-400">Add institutional or external grant claim for a student</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordScholarship} className="p-6 space-y-4 text-xs">
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
                  placeholder="-- Search & Choose Student by Name --"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Scholarship Scheme Name *</label>
                <input
                  type="text"
                  required
                  list="scheme-suggestions"
                  value={scholarshipName}
                  onChange={(e) => setScholarshipName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
                <datalist id="scheme-suggestions">
                  {schemes.map((sc, i) => <option key={i} value={sc} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sanction Order / Ref #</label>
                  <input
                    type="text"
                    placeholder="e.g. SAN-2026-441"
                    value={sanctionOrderNo}
                    onChange={(e) => setSanctionOrderNo(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit Date (Leave empty if pending)</label>
                  <input
                    type="date"
                    value={creditDate}
                    onChange={(e) => setCreditDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 20000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Credit to Fee Head</label>
                  <select
                    value={feeHeadId}
                    onChange={(e) => setFeeHeadId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="">General (Tuition / Dev)</option>
                    {feeHeads.map((fh) => (
                      <option key={fh.id} value={fh.id}>{fh.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="Government portal disbursement details..."
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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
