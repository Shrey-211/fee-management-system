import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  Search, Plus, Filter, UserCheck, 
  ChevronRight, ArrowUpDown, X, CheckCircle 
} from 'lucide-react';

export default function Students({ onSelectStudent }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('');
  const [hasDuesOnly, setHasDuesOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Student Form State
  const [formData, setFormData] = useState({
    student_code: '',
    full_name: '',
    dob: '',
    gender: 'MALE',
    category: 'OPEN',
    mobile_number: '',
    email_address: '',
    address: '',
    academic_year: '2026-2027',
    course_branch: 'B.Tech Computer Science',
    current_year: 1
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadStudents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (gender) params.gender = gender;
      if (hasDuesOnly) params.has_dues_only = true;

      const data = await api.getStudents(params);
      setStudents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, category, gender, hasDuesOnly]);

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const created = await api.createStudent(formData);
      setShowAddModal(false);
      setFormData({
        student_code: '',
        full_name: '',
        dob: '',
        gender: 'MALE',
        category: 'OPEN',
        mobile_number: '',
        email_address: '',
        address: '',
        academic_year: '2026-2027',
        course_branch: 'B.Tech Computer Science',
        current_year: 1
      });
      loadStudents();
      onSelectStudent(created.id);
    } catch (err) {
      setFormError(err.message || 'Failed to enroll student');
    } finally {
      setSubmitting(false);
    }
  };

  // Waiver Preview Calculation for the Form
  const getWaiverPreview = () => {
    const isGirl = formData.gender === 'FEMALE';
    const isSCST = ['SC', 'ST'].includes(formData.category);
    const isEBC = formData.category === 'EBC';

    let tuitionStatus = '100% Payable (₹40,000)';
    let devStatus = '100% Payable (₹15,000)';

    if (isSCST) {
      tuitionStatus = '100% Waived (SC/ST Scheme: ₹0)';
      devStatus = '100% Waived (SC/ST Scheme: ₹0)';
    } else if (isGirl) {
      tuitionStatus = '100% Waived (Girl Student Scheme: ₹0)';
      devStatus = '100% Payable (₹15,000)';
    } else if (isEBC) {
      tuitionStatus = '50% Discount (EBC Scheme: ₹20,000)';
      devStatus = '100% Payable (₹15,000)';
    }

    return { tuitionStatus, devStatus };
  };

  const preview = getWaiverPreview();

  return (
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by student ID code, name, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
          >
            <option value="">All Categories</option>
            <option value="OPEN">OPEN</option>
            <option value="EBC">EBC</option>
            <option value="SC">SC</option>
            <option value="ST">ST</option>
            <option value="OBC">OBC</option>
            <option value="VJNT">VJNT</option>
          </select>

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
          >
            <option value="">All Genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasDuesOnly}
              onChange={(e) => setHasDuesOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Has Dues Only
          </label>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow"
        >
          <Plus className="w-4 h-4" />
          Enroll New Student
        </button>
      </div>

      {/* Student List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Branch & Year</th>
                <th className="px-4 py-3 text-right">Applicable Fee</th>
                <th className="px-4 py-3 text-right">Paid Amount</th>
                <th className="px-4 py-3 text-right">Fines Due</th>
                <th className="px-4 py-3 text-right">Net Due</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-slate-400">
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-slate-400">
                    No students found matching current filter criteria.
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => onSelectStudent(s.id)}
                    className="hover:bg-blue-50/50 cursor-pointer transition"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-blue-700">{s.student_code}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{s.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{s.gender}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.course_branch} (Yr {s.current_year})
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      ₹{Number(s.net_fee_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">
                      ₹{Number(s.total_fee_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700">
                      {Number(s.total_fines_balance) > 0 ? `₹${Number(s.total_fines_balance).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold">
                      {Number(s.overall_balance) > 0 ? (
                        <span className="text-rose-600">
                          ₹{Number(s.overall_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-emerald-600 flex items-center justify-end gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Cleared
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className="text-blue-600 hover:text-blue-800 font-semibold text-xs flex items-center justify-center mx-auto">
                        View <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Enroll New Student Profile</h3>
                <p className="text-xs text-slate-400">Applicable fee heads & category waivers will auto-calculate</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Student ID / Roll Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. STU-2026-007"
                    value={formData.student_code}
                    onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Student Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rohan Vilas Patil"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female (100% Tuition Waived)</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category / Quota *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    <option value="OPEN">OPEN (Standard Fee)</option>
                    <option value="EBC">EBC (50% Tuition Discount)</option>
                    <option value="SC">SC (100% Tuition & Dev Waived)</option>
                    <option value="ST">ST (100% Tuition & Dev Waived)</option>
                    <option value="OBC">OBC</option>
                    <option value="VJNT">VJNT</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="student@example.com (for SMTP reminders)"
                    value={formData.email_address}
                    onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch / Course</label>
                  <input
                    type="text"
                    placeholder="e.g. B.Tech Computer Science"
                    value={formData.course_branch}
                    onChange={(e) => setFormData({ ...formData, course_branch: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Residential Address</label>
                <textarea
                  rows="2"
                  placeholder="Permanent address..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Automatic Fee Waiver Live Preview */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                <p className="font-bold text-blue-900 flex items-center gap-1">
                  <span>⚡ Automatic Fee Waiver Assessment:</span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>Tuition: <span className="font-semibold text-blue-800">{preview.tuitionStatus}</span></div>
                  <div>Development: <span className="font-semibold text-blue-800">{preview.devStatus}</span></div>
                </div>
                <p className="text-[10px] text-blue-600 mt-1 italic">
                  Compulsory fees (Dress Code ₹3,000, Exam ₹2,000, Other ₹1,000) apply equally to all students.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow transition disabled:opacity-50"
                >
                  {submitting ? 'Enrolling...' : 'Save & Initialize Fee Heads'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

