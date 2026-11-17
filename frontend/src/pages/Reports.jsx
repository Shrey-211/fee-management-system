import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { FileSpreadsheet, Download, Calendar, Filter, ArrowUpDown, Search, Printer } from 'lucide-react';
import collegeLogo from '../assets/college_logo_sm.png';

export default function Reports({ onSelectStudent }) {
  const [activeReport, setActiveReport] = useState('daily'); // 'daily' | 'outstanding'

  // Common Year Filter ('': Both/All Years, '1': 1st Year, '2': 2nd Year)
  const [yearFilter, setYearFilter] = useState('');

  // Daily Report State
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState(null);
  const [dailySearch, setDailySearch] = useState('');
  const [loadingDaily, setLoadingDaily] = useState(true);

  // Outstanding Report State
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [duesOnly, setDuesOnly] = useState(true);
  const [loadingOutstanding, setLoadingOutstanding] = useState(true);

  const loadDailyReport = async () => {
    setLoadingDaily(true);
    try {
      const params = { start_date: startDate, end_date: endDate };
      if (yearFilter) params.year_of_study = parseInt(yearFilter);
      const data = await api.getDailyReport(params);
      setDailyData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDaily(false);
    }
  };

  const loadOutstandingReport = async () => {
    setLoadingOutstanding(true);
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (duesOnly) params.has_dues_only = true;
      if (yearFilter) params.current_year = parseInt(yearFilter);
      const data = await api.getStudents(params);
      setStudents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOutstanding(false);
    }
  };

  useEffect(() => {
    if (activeReport === 'daily') {
      loadDailyReport();
    } else {
      loadOutstandingReport();
    }
  }, [activeReport, startDate, endDate, categoryFilter, duesOnly, yearFilter]);

  const handleDownloadDailyExcel = () => {
    api.downloadDailyReportExcel(startDate, endDate, yearFilter ? parseInt(yearFilter) : null);
  };

  const handleDownloadOutstandingExcel = () => {
    api.downloadOutstandingExcel(null, yearFilter ? parseInt(yearFilter) : null);
  };

  const filteredDailyItems = (dailyData?.items || []).filter((item) => {
    if (!dailySearch.trim()) return true;
    const q = dailySearch.toLowerCase();
    return (
      (item.student_name || '').toLowerCase().includes(q) ||
      (item.student_code || '').toLowerCase().includes(q) ||
      (item.receipt_no || '').toLowerCase().includes(q) ||
      (item.physical_receipt_no || '').toLowerCase().includes(q)
    );
  });

  const filteredOutstandingStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.student_code || '').toLowerCase().includes(q) ||
      (s.mobile_number || '').includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Report Switcher Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveReport('daily')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeReport === 'daily'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Daily & Date-Range Collection Report
        </button>

        <button
          onClick={() => setActiveReport('outstanding')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeReport === 'outstanding'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Student Outstanding Balances Report
        </button>
      </div>

      {/* DAILY / DATE-RANGE REPORT VIEW */}
      {activeReport === 'daily' && (
        <div className="space-y-4">
          {/* Official College Report Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={collegeLogo}
                alt="College Logo"
                className="w-12 h-12 object-contain rounded-lg p-0.5 border border-slate-200 bg-slate-50 shrink-0"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Krishna Foundation's
                </p>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                  Shrimant Jayshreemaladevi Naik Nimbalkar Institute of Management Studies, Phaltan
                </h3>
                <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
                  Daily & Date-Range Fee Collection Report • {startDate} to {endDate}
                </p>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-300 self-end sm:self-auto"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Print Preview
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600">From Date:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600">To Date:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600">Year / Class:</span>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white font-semibold text-slate-800"
                >
                  <option value="">Both Years (All)</option>
                  <option value="1">1st Year Only (MBA-I)</option>
                  <option value="2">2nd Year Only (MBA-II)</option>
                </select>
              </div>

              {/* Quick Range Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setStartDate(today);
                    setEndDate(today);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded border"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const y = new Date().getFullYear();
                    setStartDate(`${y}-07-01`);
                    setEndDate(`${y}-10-31`);
                  }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium rounded border"
                >
                  July – Oct 31
                </button>
              </div>
            </div>

            <button
              onClick={handleDownloadDailyExcel}
              className="w-full md:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow transition"
            >
              <Download className="w-4 h-4" />
              Download Excel Workbook (.xlsx)
            </button>
          </div>

          {dailyData && (
            <>
              {/* Report Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Period Collections</span>
                  <p className="text-xl font-black text-slate-900 font-mono mt-1">
                    ₹{Number(dailyData.total_collected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">{dailyData.payments_count} Receipts</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash Collections</span>
                  <p className="text-xl font-black text-blue-700 font-mono mt-1">
                    ₹{Number(dailyData.cash_collected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">Physical counter cash</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Digital / Online Modes</span>
                  <p className="text-xl font-black text-purple-700 font-mono mt-1">
                    ₹{Number(dailyData.other_modes_collected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">UPI, Cheque, NEFT</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Event Fines Part</span>
                  <p className="text-xl font-black text-amber-700 font-mono mt-1">
                    ₹{Number(dailyData.fines_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">Absence fines collected</p>
                </div>
              </div>

              {/* Fee Head Breakdown Summary Bar */}
              <div className="bg-slate-900 text-white p-4 rounded-xl shadow">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Collections Breakdown by Fee Head
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
                  {Object.entries(dailyData.fee_head_totals || {}).map(([headName, amt]) => (
                    <div key={headName} className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700">
                      <span className="text-slate-400 text-[11px] block truncate">{headName}</span>
                      <span className="font-mono font-bold text-sm text-slate-100">
                        ₹{Number(amt).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed Itemized Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative flex-1 w-full max-w-sm">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter records by student name, ID, or receipt #..."
                      value={dailySearch}
                      onChange={(e) => setDailySearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium shrink-0 self-end sm:self-center">
                    Showing {filteredDailyItems.length} of {dailyData.items.length} records
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Receipt Date</th>
                        <th className="px-4 py-3">System #</th>
                        <th className="px-4 py-3">Manual Book #</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">ID Code</th>
                        <th className="px-4 py-3 text-center">Class / Year</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Mode</th>
                        <th className="px-4 py-3 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {dailyData.items.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="px-4 py-8 text-center text-slate-400">
                            No collection transactions found for this date range.
                          </td>
                        </tr>
                      ) : filteredDailyItems.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="px-4 py-8 text-center text-slate-400">
                            No collection records matching "{dailySearch}".
                          </td>
                        </tr>
                      ) : (
                        filteredDailyItems.map((item) => (
                          <tr key={item.payment_id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 text-slate-600">{item.payment_date}</td>
                            <td className="px-4 py-3 font-mono text-slate-400">{item.receipt_no}</td>
                            <td className="px-4 py-3 font-mono font-black text-blue-900 bg-blue-50/20">{item.physical_receipt_no || '—'}</td>
                            <td className="px-4 py-3 font-bold text-slate-900">{item.student_name}</td>
                            <td className="px-4 py-3 font-mono text-slate-500">{item.student_code}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.student_current_year === 2
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                {item.student_current_year === 2 ? '2nd Year' : '1st Year'}
                              </span>
                            </td>
                            <td className="px-4 py-3">{item.category}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {item.payment_mode}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                              ₹{Number(item.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* OUTSTANDING BALANCES REPORT VIEW */}
      {activeReport === 'outstanding' && (
        <div className="space-y-4">
          {/* Official College Report Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={collegeLogo}
                alt="College Logo"
                className="w-12 h-12 object-contain rounded-lg p-0.5 border border-slate-200 bg-slate-50 shrink-0"
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Krishna Foundation's
                </p>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                  Shrimant Jayshreemaladevi Naik Nimbalkar Institute of Management Studies, Phaltan
                </h3>
                <p className="text-[11px] text-rose-700 font-semibold mt-0.5">
                  Student Outstanding Fee Balances & Ledger Dues Report
                </p>
              </div>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-300 self-end sm:self-auto"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              Print Preview
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student name, code, or phone..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                />
              </div>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white font-semibold text-slate-800"
              >
                <option value="">All / Both Years</option>
                <option value="1">1st Year Only (MBA-I)</option>
                <option value="2">2nd Year Only (MBA-II)</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="py-1.5 px-3 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
              >
                <option value="">All Categories</option>
                <option value="OPEN">OPEN</option>
                <option value="EBC">EBC</option>
                <option value="SC">SC</option>
                <option value="ST">ST</option>
                <option value="OBC">OBC</option>
                <option value="VJNT">VJNT</option>
              </select>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={duesOnly}
                  onChange={(e) => setDuesOnly(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Dues &gt; ₹0 Only
              </label>

              {studentSearch && (
                <span className="text-[11px] text-slate-500 font-medium">
                  ({filteredOutstandingStudents.length} matching)
                </span>
              )}
            </div>

            <button
              onClick={handleDownloadOutstandingExcel}
              className="w-full md:w-auto px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow transition shrink-0"
            >
              <Download className="w-4 h-4" />
              Download Outstanding Excel (.xlsx)
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Student ID</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3 text-center">Class / Year</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Gender</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3 text-right">Applicable Fee</th>
                    <th className="px-4 py-3 text-right">Fee Paid</th>
                    <th className="px-4 py-3 text-right">Fines Due</th>
                    <th className="px-4 py-3 text-right font-black">Net Total Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-8 text-center text-slate-400">
                        No students with outstanding balances found.
                      </td>
                    </tr>
                  ) : filteredOutstandingStudents.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-8 text-center text-slate-400">
                        No students found matching "{studentSearch}".
                      </td>
                    </tr>
                  ) : (
                    filteredOutstandingStudents.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => onSelectStudent && onSelectStudent(s.id)}
                        className="hover:bg-blue-50/50 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 font-mono font-bold text-blue-700">{s.student_code}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{s.full_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.current_year === 2
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : s.current_year === 1
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-800 border border-slate-300'
                          }`}>
                            {s.current_year === 2 ? '2nd Year' : s.current_year === 1 ? '1st Year' : 'Passed Out'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{s.category}</td>
                        <td className="px-4 py-3">{s.gender}</td>
                        <td className="px-4 py-3 text-slate-600">{s.mobile_number || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          ₹{Number(s.net_fee_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-700 font-semibold">
                          ₹{Number(s.total_fee_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-amber-700">
                          {Number(s.total_fines_balance) > 0 ? `₹${Number(s.total_fines_balance).toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <div className="font-extrabold text-rose-600">
                            ₹{Number(s.overall_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          {s.current_year >= 2 && Number(s.year_1_dues || 0) > 0 && (
                            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                              Incl. 1st Yr Arrears: ₹{Number(s.year_1_dues).toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

