import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  Search, Plus, Filter, UserCheck, 
  ChevronRight, ArrowUpDown, X, CheckCircle, Clock, Award,
  GraduationCap, Trash2
} from 'lucide-react';
import DeleteStudentModal from '../components/DeleteStudentModal';

const ACADEMIC_YEARS = [
  '2024-2025',
  '2025-2026',
  '2026-2027',
  '2027-2028',
  '2028-2029',
  '2029-2030',
  '2030-2031'
];

export default function Students({ onSelectStudent, onRecordPayment, user }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('');
  const [academicYearFilter, setAcademicYearFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(''); // '' for All, '1', '2', '3'
  const [scholarshipStatusFilter, setScholarshipStatusFilter] = useState('');
  const [hasDuesOnly, setHasDuesOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [feeTypes, setFeeTypes] = useState([]);
  const [feeHeads, setFeeHeads] = useState([]);

  // Delete Student Modal State
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, student: null });
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState('');

  // Promote Modal State
  const [promoteModal, setPromoteModal] = useState({ isOpen: false, student: null, loading: false });

  // New Student Form State (Roll number removed, Academic Year added with default '2026-2027', Course default MBA)
  const [formData, setFormData] = useState({
    full_name: '',
    academic_year: '2026-2027',
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
    api.getFeeTypes('2026-2027')
      .then(types => setFeeTypes(types || []))
      .catch(() => {});
    api.getFeeHeads('2026-2027')
      .then(heads => setFeeHeads(heads || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (showAddModal) {
      api.getFeeHeads(formData.academic_year || '2026-2027')
        .then(heads => setFeeHeads(heads || []))
        .catch(() => {});
      api.getFeeTypes(formData.academic_year || '2026-2027')
        .then(types => setFeeTypes(types || []))
        .catch(() => {});
    }
  }, [showAddModal, formData.academic_year]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (gender) params.gender = gender;
      if (academicYearFilter) params.academic_year = academicYearFilter;
      if (yearFilter) params.current_year = parseInt(yearFilter);
      if (scholarshipStatusFilter) params.scholarship_status = scholarshipStatusFilter;
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
  }, [search, category, gender, academicYearFilter, yearFilter, scholarshipStatusFilter, hasDuesOnly]);

  const handlePromoteConfirm = async () => {
    if (!promoteModal.student) return;
    setPromoteModal(prev => ({ ...prev, loading: true }));
    try {
      await api.promoteStudent(promoteModal.student.id);
      setPromoteModal({ isOpen: false, student: null, loading: false });
      loadStudents();
    } catch (err) {
      alert(err.message || 'Failed to promote student');
      setPromoteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = (formData.full_name || '').trim();
    const trimmedAY = (formData.academic_year || '2026-2027').trim();

    if (!trimmedName) {
      setFormError('Full Student Name (*) is required. Please fill in this field.');
      return;
    }
    if (!trimmedAY) {
      setFormError('Academic Year (*) is required (e.g. 2026-2027).');
      return;
    }

    const trimmedMobile = (formData.mobile_number || '').trim();
    if (!trimmedMobile) {
      setFormError('Mobile / Phone Number (*) is compulsory. Please fill in this field.');
      return;
    }
    const cleanDigits = trimmedMobile.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
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
      mobile_number: trimmedMobile,
      email_address: (formData.email_address || '').trim() || null,
      address: (formData.address || '').trim() || null
    };

    setSubmitting(true);
    try {
      const created = await api.createStudent(payload);
      setShowAddModal(false);
      setFormData({
        full_name: '',
        academic_year: '2026-2027',
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

  // Dynamic Fee & Waiver Preview Calculation based on configured Fee Heads & Rules
  const getWaiverPreview = () => {
    const isGirl = formData.gender === 'FEMALE';
    const cat = (formData.category || 'OPEN').toUpperCase().trim();
    const isSCST = ['SC', 'ST'].includes(cat);
    const isEBC = cat === 'EBC';
    const concessionId = formData.concession_type_id ? parseInt(formData.concession_type_id) : null;

    // Find configured fee heads for selected year
    const activeYearHeads = feeHeads.filter(h => (h.year_of_study || 1) === (formData.current_year || 1));
    const tuitionHead = activeYearHeads.find(h => (h.code || '').toUpperCase() === 'TUITION' || (h.name || '').toLowerCase().includes('tuition'));
    const devHead = activeYearHeads.find(h => (h.code || '').toUpperCase() === 'DEVELOPMENT' || (h.name || '').toLowerCase().includes('development'));

    const tuitionBase = tuitionHead ? Number(tuitionHead.base_amount) : 0;
    const devBase = devHead ? Number(devHead.base_amount) : 0;

    // Other compulsory heads
    const otherHeads = activeYearHeads.filter(h => h.id !== tuitionHead?.id && h.id !== devHead?.id);
    const otherCompulsory = otherHeads.reduce((sum, h) => sum + Number(h.base_amount || 0), 0);
    const totalBase = activeYearHeads.reduce((sum, h) => sum + Number(h.base_amount || 0), 0);

    const selectedType = concessionId ? feeTypes.find(t => t.id === concessionId) : null;

    let tuitionWaiverPct = 0;
    let devWaiverPct = 0;
    let tuitionReason = '';
    let devReason = '';

    // Check custom concession rules first
    if (selectedType && selectedType.rules) {
      if (tuitionHead) {
        const r = selectedType.rules.find(x => x.fee_head_id === tuitionHead.id);
        if (r && Number(r.waiver_percent) > 0) {
          tuitionWaiverPct = Number(r.waiver_percent);
          tuitionReason = r.reason || selectedType.name;
        }
      }
      if (devHead) {
        const r = selectedType.rules.find(x => x.fee_head_id === devHead.id);
        if (r && Number(r.waiver_percent) > 0) {
          devWaiverPct = Number(r.waiver_percent);
          devReason = r.reason || selectedType.name;
        }
      }
    }

    // Standard category/gender institutional & government scholarship rules
    if (tuitionWaiverPct === 0) {
      if (isSCST) {
        tuitionWaiverPct = 100;
        tuitionReason = `${cat} Govt Scholarship`;
      } else if (isGirl) {
        tuitionWaiverPct = 100;
        tuitionReason = 'Girl Student Scheme';
      } else if (isEBC) {
        tuitionWaiverPct = 50;
        tuitionReason = 'EBC Govt Scholarship';
      }
    }

    if (devWaiverPct === 0) {
      if (isSCST) {
        devWaiverPct = 100;
        devReason = `${cat} Govt Scholarship`;
      }
    }

    const fmt = (val) => '₹' + Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });

    let tuitionStatus = '';
    if (tuitionWaiverPct === 100) {
      tuitionStatus = `100% Waived (${tuitionReason}: ${fmt(tuitionBase)} - Not Received)`;
    } else if (tuitionWaiverPct > 0) {
      const waivedAmt = (tuitionBase * tuitionWaiverPct) / 100;
      const netPayable = tuitionBase - waivedAmt;
      tuitionStatus = `${tuitionWaiverPct}% Waived (${fmt(waivedAmt)} Govt / ${fmt(netPayable)} Payable)`;
    } else {
      tuitionStatus = `100% Payable (${fmt(tuitionBase)})`;
    }

    let devStatus = '';
    if (devWaiverPct === 100) {
      devStatus = `100% Waived (${devReason}: ${fmt(devBase)} - Not Received)`;
    } else if (devWaiverPct > 0) {
      const waivedAmt = (devBase * devWaiverPct) / 100;
      const netPayable = devBase - waivedAmt;
      devStatus = `${devWaiverPct}% Waived (${fmt(waivedAmt)} Govt / ${fmt(netPayable)} Payable)`;
    } else {
      devStatus = `100% Payable (${fmt(devBase)})`;
    }

    return { tuitionStatus, devStatus, tuitionBase, devBase, otherCompulsory, totalBase };
  };

  const preview = getWaiverPreview();

  // Extract unique academic years from loaded students and predefined list for easy filter selection
  const availableAcademicYears = Array.from(new Set([
    ...ACADEMIC_YEARS,
    ...students.map(s => s.academic_year).filter(Boolean)
  ]));

  return (
    <div className="space-y-4">
      {/* Delete Success Alert Banner */}
      {deleteSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between font-medium animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{deleteSuccessMsg}</span>
          </div>
          <button 
            type="button"
            onClick={() => setDeleteSuccessMsg('')} 
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white font-semibold text-slate-800"
          >
            <option value="">All Years (1st & 2nd)</option>
            <option value="1">1st Year (MBA-I)</option>
            <option value="2">2nd Year (MBA-II)</option>
            <option value="3">Passed Out</option>
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

          <select
            value={scholarshipStatusFilter}
            onChange={(e) => setScholarshipStatusFilter(e.target.value)}
            className="py-2 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
          >
            <option value="">All Scholarships</option>
            <option value="RECEIVED">Fully Received</option>
            <option value="PARTIAL">Partially Received</option>
            <option value="NOT_RECEIVED">Pending / Not Received</option>
            <option value="HAS_SCHOLARSHIP">Has Any Scholarship</option>
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
                <th className="px-4 py-3 whitespace-nowrap">Full Name</th>
                <th className="px-4 py-3 whitespace-nowrap">Year</th>
                <th className="px-4 py-3 whitespace-nowrap">Academic Year</th>
                <th className="px-4 py-3 whitespace-nowrap">Gender</th>
                <th className="px-4 py-3 whitespace-nowrap">Category</th>
                <th className="px-4 py-3 whitespace-nowrap">Govt Scholarship</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Applicable Fee</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Paid Amount</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Fines Due</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Net Due</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="11" className="px-4 py-8 text-center text-slate-400">
                    Loading student records...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-4 py-8 text-center text-slate-400">
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-900 leading-snug">{s.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">{s.course_branch || 'MBA'} Program</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.current_year === 2 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          2nd Year
                        </span>
                      ) : s.current_year === 3 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Passed Out
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          1st Year
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono whitespace-nowrap">
                        {s.academic_year || '2026-2027'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{s.gender}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap">
                        {s.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {Number(s.scholarship_total || 0) > 0 ? (
                        Number(s.scholarship_pending || 0) === 0 ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm"
                            title={`Scholarship 100% Received from Government: ₹${Number(s.scholarship_received).toLocaleString('en-IN')}`}
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ₹{Number(s.scholarship_received).toLocaleString('en-IN')} (Received)
                          </span>
                        ) : Number(s.scholarship_received || 0) > 0 ? (
                          <div 
                            className="flex flex-col gap-1"
                            title={`Partially Received: ₹${Number(s.scholarship_received).toLocaleString('en-IN')} received, ₹${Number(s.scholarship_pending).toLocaleString('en-IN')} pending from Government`}
                          >
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                              ₹{Number(s.scholarship_received).toLocaleString('en-IN')} Rec
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                              ₹{Number(s.scholarship_pending).toLocaleString('en-IN')} Pend
                            </span>
                          </div>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-sm"
                            title={`Government scholarship claim pending disbursement: ₹${Number(s.scholarship_pending).toLocaleString('en-IN')}`}
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            ₹{Number(s.scholarship_pending).toLocaleString('en-IN')} (Not Received)
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                      ₹{Number(s.net_fee_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold whitespace-nowrap">
                      ₹{Number(s.total_fee_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700 whitespace-nowrap">
                      {Number(s.total_fines_balance) > 0 ? `₹${Number(s.total_fines_balance).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                      {Number(s.overall_balance) > 0 ? (
                        <div>
                          <span className="text-rose-600">
                            ₹{Number(s.overall_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {s.current_year >= 2 && Number(s.year_1_dues || 0) > 0 && (
                            <div className="text-[9.5px] px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-800 border border-amber-300 mt-0.5 whitespace-nowrap" title="Unpaid dues from 1st Year">
                              Unpaid 1st Yr: ₹{Number(s.year_1_dues).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-emerald-600 flex items-center justify-end gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Cleared
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {s.current_year === 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPromoteModal({ isOpen: true, student: s, loading: false });
                            }}
                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                            title="Promote student to 2nd Year"
                          >
                            <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
                            Promote
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStudent(s.id);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-xs flex items-center justify-center px-1.5 py-1 hover:bg-blue-50 rounded transition"
                        >
                          View <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModal({ isOpen: true, student: s });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-200"
                          title="Delete student from database"
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
                  <label className="block font-semibold text-slate-700 mb-1">Academic Year *</label>
                  <select
                    required
                    value={formData.academic_year}
                    onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white font-medium text-slate-900"
                  >
                    {ACADEMIC_YEARS.map(ay => (
                      <option key={ay} value={ay}>{ay}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Year of Admission / Current Year *</label>
                  <select
                    value={formData.current_year}
                    onChange={(e) => setFormData({ ...formData, current_year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white font-semibold text-blue-900"
                  >
                    <option value={1}>1st Year (MBA-I Regular Admission)</option>
                    <option value={2}>2nd Year (MBA-II Direct / Lateral Entry)</option>
                  </select>
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
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mobile / Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile number"
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none font-medium"
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
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 flex items-center gap-1 text-sm">
                    ⚡ Automatic Fee Waiver & Govt Scholarship Assessment:
                  </span>
                  {preview.totalBase > 0 && (
                    <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                      Total Base Fees: ₹{preview.totalBase.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700 bg-white/80 p-2.5 rounded-lg border border-blue-100">
                  <div>Tuition Fee: <span className="font-semibold text-blue-800">{preview.tuitionStatus}</span></div>
                  <div>Development Fee: <span className="font-semibold text-blue-800">{preview.devStatus}</span></div>
                </div>
                {preview.otherCompulsory > 0 && (
                  <div className="text-[11px] text-slate-600">
                    + Compulsory Non-Waiver Fees (Dress, Exam, etc.): <strong className="text-slate-800">₹{preview.otherCompulsory.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                  </div>
                )}
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

      {/* Promote Confirmation Modal */}
      {promoteModal.isOpen && promoteModal.student && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-purple-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-purple-200" />
                <h3 className="text-sm font-bold">Promote Student to 2nd Year</h3>
              </div>
              <button
                onClick={() => setPromoteModal({ isOpen: false, student: null, loading: false })}
                className="text-purple-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 text-sm">{promoteModal.student.full_name}</div>
                <div className="text-slate-500 font-mono">Roll Code: {promoteModal.student.student_code}</div>
                <div className="text-slate-600">
                  Category: <span className="font-semibold text-slate-800">{promoteModal.student.category}</span> | Academic Year: <span className="font-semibold text-slate-800">{promoteModal.student.academic_year}</span>
                </div>
              </div>

              {Number(promoteModal.student.overall_balance || 0) > 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-800">
                    <Clock className="w-4 h-4 text-amber-600" />
                    1st Year Unpaid Dues: ₹{Number(promoteModal.student.overall_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    This balance will automatically carry forward to 2nd Year with the tag <strong className="bg-amber-100 px-1 py-0.5 rounded border border-amber-300 text-amber-900">Unpaid from 1st Year</strong>. The student can clear these dues anytime during 2nd year.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>1st Year Fees are 100% cleared! Student enters 2nd Year with zero arrears.</span>
                </div>
              )}

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-[11px] leading-relaxed">
                <strong className="block font-bold mb-0.5 text-purple-950">Promotion Summary:</strong>
                • Advance student from <strong>1st Year (MBA-I)</strong> to <strong>2nd Year (MBA-II)</strong>.<br />
                • Standard 2nd Year fee heads will be assigned to their ledger.<br />
                • All 1st Year payment receipts and ledger statements remain safely preserved in their history.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setPromoteModal({ isOpen: false, student: null, loading: false })}
                  className="px-4 py-2 border rounded-lg font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={promoteModal.loading}
                  onClick={handlePromoteConfirm}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <GraduationCap className="w-4 h-4" />
                  {promoteModal.loading ? 'Promoting...' : 'Confirm Promotion to 2nd Year'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Student Modal */}
      <DeleteStudentModal
        isOpen={deleteModal.isOpen}
        student={deleteModal.student}
        onClose={() => setDeleteModal({ isOpen: false, student: null })}
        onClearDues={(st) => {
          if (onRecordPayment) {
            onRecordPayment(st);
          } else {
            onSelectStudent(st.id);
          }
        }}
        onDeleted={(st) => {
          setDeleteSuccessMsg(`Student "${st.full_name}" (${st.student_code}) has been permanently deleted from the database. All dashboard totals and reports have been recalculated.`);
          loadStudents();
          setTimeout(() => setDeleteSuccessMsg(''), 6000);
        }}
      />
    </div>
  );
}

