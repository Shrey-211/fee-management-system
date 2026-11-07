import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Award, Plus, Search, X } from 'lucide-react';

export default function Scholarships() {
  const [scholarships, setScholarships] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeHeads, setFeeHeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form
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
      setFormError('Please select a student');
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid scholarship amount');
      return;
    }

    setSubmitting(true);
    try {
      await api.createScholarship({
        student_id: parseInt(selectedStudentId),
        fee_head_id: feeHeadId ? parseInt(feeHeadId) : null,
        scholarship_name: scholarshipName.trim(),
        sanction_order_no: sanctionOrderNo.trim() || null,
        credit_date: creditDate,
        amount: amt,
        remarks: remarks.trim() || null
      });
      setShowModal(false);
      setAmount('');
      setSanctionOrderNo('');
      setRemarks('');
      loadData();
    } catch (err) {
      setFormError(err.message || 'Failed to record scholarship credit');
    } finally {
      setSubmitting(false);
    }
  };

  const schemes = [
    'MahaDBT Post-Matric Scholarship',
    'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavrutti (EBC)',
    'Dr. Punjabrao Deshmukh Vasatigruh Nirvah Bhatta Yojna',
    'Post Matric Scholarship for Persons with Disability',
    'State Minority Scholarship'
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Scholarship Receipts Registry</h3>
          <p className="text-xs text-slate-500">Government & institutional scholarship disbursement tracking</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
        >
          <Plus className="w-4 h-4" />
          Record Scholarship Credit
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Credit Date</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Scholarship Scheme</th>
                <th className="px-4 py-3">Sanction Order #</th>
                <th className="px-4 py-3">Fee Head Credited</th>
                <th className="px-4 py-3 text-right">Amount Credited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                    Loading scholarships...
                  </td>
                </tr>
              ) : scholarships.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                    No scholarship credits recorded yet.
                  </td>
                </tr>
              ) : (
                scholarships.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-slate-600">{s.credit_date}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{s.student_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{s.student_code}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{s.scholarship_name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{s.sanction_order_no || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{s.fee_head_name || 'General Tuition/Dev'}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                      ₹{Number(s.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Record Scholarship Disbursement</h3>
                <p className="text-xs text-slate-400">Credit scholarship directly to student fee heads</p>
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
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.student_code} — {s.full_name} ({s.category})
                    </option>
                  ))}
                </select>
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
                  <label className="block font-semibold text-slate-700 mb-1">Credit Date *</label>
                  <input
                    type="date"
                    required
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
                  {submitting ? 'Crediting...' : 'Save & Adjust Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
