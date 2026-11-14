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
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [hasDuesOnly, setHasDuesOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [feeTypes, setFeeTypes] = useState([]);

  // New Student Form State (Roll number removed, Academic Year added with default '25-26', Course default MBA)
  const [formData, setFormData] = useState({
    full_name: '',
    academic_year: '25-26',
    dob: '',
    gender: 'MALE',
    category: 'OPEN',
    concession_type_id: null,
    mobile_number: '',
    email_address: '',
    address: '',
    course_branch: 'MBA',
    current_year: 1
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    api.getFeeTypes()
      .then(types => setFeeTypes(types || []))
      .catch(() => {});
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (gender) params.gender = gender;
      if (academicYearFilter) params.academic_year = academicYearFilter;
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
  }, [search, category, gender, academicYearFilter, hasDuesOnly]);

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = (formData.full_name || '').trim();
    const trimmedAY = (formData.academic_year || '25-26').trim();

    if (!trimmedName) {
      setFormError('Full Student Name (*) is required. Please fill in this field.');
      return;
    }
    if (!trimmedAY) {
      setFormError('Academic Year (*) is required (e.g. 25-26).');
      return;
    }

    const payload = {
      student_code: null,
      full_name: trimmedName,
      academic_year: trimmedAY,
      gender: formData.gender,
      category: formData.category,
      course_branch: (formData.course_branch || 'MBA').trim(),
      current_year: formData.current_year || 1,
      dob: formData.dob && formData.dob.trim() ? formData.dob.trim() : null,
      concession_type_id: formData.concession_type_id ? parseInt(formData.concession_type_id) : null,
      mobile_number: (formData.mobile_number || '').trim() || null,
      email_address: (formData.email_address || '').trim() || null,
      address: (formData.address || '').trim() || null
    };

    setSubmitting(true);
    try {
      const created = await api.createStudent(payload);
      setShowAddModal(false);
      setFormData({
        full_name: '',
        academic_year: '25-26',
        dob: '',
        gender: 'MALE',
        category: 'OPEN',
        concession_type_id: null,
        mobile_number: '',
        email_address: '',
        address: '',
        course_branch: 'MBA',
        current_year: 1
      });
      loadStudents();
      onSelectStudent(created.id);
    } catch (err) {
      setFormError(err.message || 'Failed to enroll student. Please check input fields.');
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
      tuitionStatus = '100% Govt Scholarship (Govt: ₹40,000 - Not Received)';
      devStatus = '100% Govt Scholarship (Govt: ₹15,000 - Not Received)';
    } else if (isGirl) {
      tuitionStatus = '100% Govt Scheme (Govt: ₹40,000 - Not Received)';
      devStatus = '100% Payable (₹15,000)';
    } else if (isEBC) {
      tuitionStatus = '50% Govt Scholarship (Govt: ₹20,000 - Not Received)';
      devStatus = '100% Payable (₹15,000)';
    }

    return { tuitionStatus, devStatus };
  };

  const preview = getWaiverPreview();

  // Extract unique academic years from loaded students for easy filter selection
  const availableAcademicYears = Array.from(new Set(students.map(s => s.academic_year).filter(Boolean)));
  if (!availableAcademicYears.includes('25-26')) {
    availableAcademicYears.unshift('25-26');
  }

  return (
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by student name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
            />
          </div>

          <select
            value={academicYearFilter}
            onChange={(e) => setAcademicYearFilter(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
          >
            <option value="">All Academic Years</option>
            {availableAcademicYears.map(ay => (
              <option key={ay} value={ay}>{ay}</option>
            ))}
          </select>

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
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Academic Year</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Govt Scholarship</th>
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
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{s.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">MBA Program</div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                        {s.academic_year || '25-26'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.gender}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {Number(s.scholarship_total || 0) > 0 ? (
                        Number(s.scholarship_pending || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title="Government scholarship claim pending disbursement">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            ₹{Number(s.scholarship_pending).toLocaleString('en-IN')} (Not Received)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Scholarship received from Government">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            ₹{Number(s.scholarship_received).toLocaleString('en-IN')} (Received)
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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
                <p className="text-xs text-slate-400">Default Program: MBA | Academic Year & Scholarships auto-tracked</p>
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
                  <label className="block font-semibold text-slate-700 mb-1">Academic Year * (e.g. 25-26)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 25-26"
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {feeTypes.filter(t => t.type_group === 'GENDER').length > 0 ? (
                      feeTypes.filter(t => t.type_group === 'GENDER').map(t => (
                        <option key={t.id} value={t.code}>{t.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female (100% Tuition Waived)</option>
                        <option value="OTHER">Other</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Caste / Social Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                  >
                    {feeTypes.filter(t => t.type_group === 'CASTE').length > 0 ? (
                      feeTypes.filter(t => t.type_group === 'CASTE').map(t => (
                        <option key={t.id} value={t.code}>{t.name}</option>
                      ))
                    ) : (
                      <>
                        <option value="OPEN">OPEN (Standard Fee)</option>
                        <option value="EBC">EBC (50% Tuition Discount)</option>
                        <option value="SC">SC (100% Tuition & Dev Waived)</option>
                        <option value="ST">ST (100% Tuition & Dev Waived)</option>
                        <option value="OBC">OBC</option>
                        <option value="VJNT">VJNT</option>
                      </>
                    )}
                  </select>
                </div>

                {feeTypes.filter(t => t.type_group === 'CUSTOM').length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Special Fee Concession Quota (Optional)
                    </label>
                    <select
                      value={formData.concession_type_id || ''}
                      onChange={(e) => setFormData({ ...formData, concession_type_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                    >
                      <option value="">-- None / Standard Rules --</option>
                      {feeTypes.filter(t => t.type_group === 'CUSTOM').map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                      ))}
                    </select>
                  </div>
                )}

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
                  <label className="block font-semibold text-slate-700 mb-1">Program / Course</label>
                  <input
                    type="text"
                    placeholder="MBA"
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
                  <span>⚡ Automatic Fee Waiver & Govt Scholarship Assessment:</span>
                </p>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>Tuition: <span className="font-semibold text-blue-800">{preview.tuitionStatus}</span></div>
                  <div>Development: <span className="font-semibold text-blue-800">{preview.devStatus}</span></div>
                </div>
                <p className="text-[10px] text-blue-600 mt-1 italic">
                  Note: All category discounts will be tracked under the Scholarships section with status "Not Received" until funds are disbursed by the government.
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

