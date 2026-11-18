import React from 'react';
import { X, Printer, FileText } from 'lucide-react';
import collegeLogo from '../assets/college_logo_sm.png';

export default function StudentStatementModal({ isOpen, student, onClose }) {
  if (!isOpen || !student) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          body * {
            visibility: hidden !important;
          }
          #statement-printable-area, #statement-printable-area * {
            visibility: visible !important;
          }
          #statement-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 12mm !important;
            box-shadow: none !important;
            border: 1px solid #94a3b8 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col my-auto print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="no-print bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-sm tracking-tight">Student Fee Statement — Official College Document</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper */}
        <div id="statement-printable-area" className="p-6 sm:p-8 bg-white text-slate-900 print:p-4">
          {/* Official College Header */}
          <div className="flex items-center gap-4 pb-4 border-b-2 border-slate-900">
            <img
              src={collegeLogo}
              alt="College Logo"
              className="w-20 h-20 object-contain shrink-0"
            />
            <div className="flex-1 text-center pr-4">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700">
                Krishna Foundation's
              </p>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-blue-950 uppercase leading-snug">
                Shrimant Jayshreemaladevi Naik Nimbalkar Institute of Management Studies, Phaltan
              </h1>
              <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                Approved by AICTE New Delhi, DTE Mumbai & Affiliated to Shivaji University, Kolhapur
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Phaltan, Dist. Satara - 415523 (Maharashtra)
              </p>
            </div>
          </div>

          {/* Statement Title Banner */}
          <div className="my-3 py-1.5 px-4 bg-slate-100 border border-slate-300 rounded flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-800">
            <span>Student Official Fee Ledger & Statement</span>
            <span className="text-[10px] text-slate-600 font-semibold lowercase">as of {currentDate}</span>
          </div>

          {/* Student Profile Meta Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs py-2 border-b border-slate-200">
            <div>
              <span className="text-slate-500 font-medium">Student Name: </span>
              <span className="font-bold text-slate-900">{student.full_name}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Student ID / Roll Code: </span>
              <span className="font-mono font-bold text-slate-900">{student.student_code}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Category / Gender: </span>
              <span className="font-semibold text-slate-800">{student.category} / {student.gender}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Course / Branch: </span>
              <span className="font-semibold text-slate-800">{student.course_branch || 'MBA'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Academic Year: </span>
              <span className="font-semibold text-slate-800">{student.academic_year || '2026-2027'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Mobile Number: </span>
              <span className="font-semibold text-slate-800">{student.mobile_number || 'N/A'}</span>
            </div>
          </div>

          {/* Fee Heads Breakdown */}
          <div className="my-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              1. Fee Structure & Account Balances
            </h3>
            <table className="w-full text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold uppercase text-[10px]">
                  <th className="py-2 px-2 text-left border-r border-slate-300">Fee Head</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300">Base Fee (₹)</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300">Waiver / Concession (₹)</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300">Net Due (₹)</th>
                  <th className="py-2 px-2 text-right border-r border-slate-300">Paid (₹)</th>
                  <th className="py-2 px-2 text-right">Balance Due (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(student.fee_heads || []).map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-2 font-medium text-slate-900 border-r border-slate-200">
                      {h.name}
                      {h.waiver_reason && (
                        <span className="block text-[10px] text-blue-600 font-normal">
                          {h.waiver_reason} ({h.discount_percent}%)
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono border-r border-slate-200">
                      ₹{Number(h.base_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-blue-700 border-r border-slate-200">
                      ₹{Number(h.discount_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold border-r border-slate-200">
                      ₹{Number(h.net_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-emerald-700 border-r border-slate-200">
                      ₹{Number(h.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-700">
                      ₹{Number(h.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-xs">
                  <td className="py-2 px-2 text-left uppercase border-r border-slate-300">Subtotal Fees</td>
                  <td className="py-2 px-2 text-right font-mono border-r border-slate-300">
                    ₹{Number(student.total_fee || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-blue-800 border-r border-slate-300">
                    ₹{Number(student.total_waiver || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-mono border-r border-slate-300">
                    ₹{Number(student.net_fee_due || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-emerald-800 border-r border-slate-300">
                    ₹{Number(student.total_fee_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-black text-rose-800">
                    ₹{Number(student.overall_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Fines Section (if any) */}
          {(student.fines || []).length > 0 && (
            <div className="my-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                2. Event / Administrative Fines
              </h3>
              <table className="w-full text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold uppercase text-[10px]">
                    <th className="py-1.5 px-2 text-left border-r border-slate-300">Event Reason</th>
                    <th className="py-1.5 px-2 text-center border-r border-slate-300">Date</th>
                    <th className="py-1.5 px-2 text-right border-r border-slate-300">Fine (₹)</th>
                    <th className="py-1.5 px-2 text-right border-r border-slate-300">Paid (₹)</th>
                    <th className="py-1.5 px-2 text-right">Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {student.fines.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2 font-medium border-r border-slate-200">{f.event_name}</td>
                      <td className="py-1.5 px-2 text-center text-slate-600 border-r border-slate-200">{f.fine_date}</td>
                      <td className="py-1.5 px-2 text-right font-mono border-r border-slate-200">
                        ₹{Number(f.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-700 border-r border-slate-200">
                        ₹{Number(f.paid_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-rose-700">
                        {f.status === 'WAIVED' ? 'WAIVED' : `₹${Number(f.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Grand Total Summary Box */}
          <div className="p-3 bg-slate-50 border-2 border-slate-300 rounded-lg flex items-center justify-between my-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                Total Outstanding Payable
              </span>
              <span className="text-xs text-slate-500 font-medium">
                (Includes Tuition, Development, Other charges, and any active fines)
              </span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black font-mono text-rose-700">
                ₹{Number(student.overall_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Signatures & Seal Section */}
          <div className="pt-8 mt-6 border-t border-dashed border-slate-300 grid grid-cols-2 text-center text-xs">
            <div>
              <div className="h-10 flex items-center justify-center text-[10px] text-slate-400 italic">
                [ College Cashier Seal ]
              </div>
              <p className="border-t border-slate-400 pt-1 font-semibold text-slate-700 mx-12">
                Cashier / Fee Counter (Mr. Shrikant)
              </p>
            </div>
            <div>
              <div className="h-10"></div>
              <p className="border-t border-slate-400 pt-1 font-semibold text-slate-700 mx-12">
                Authorized Officer / Director
              </p>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-100 text-[9.5px] text-slate-400 text-center">
            This is an official fee record of Krishna Foundation's SJNNIMS, Phaltan.
          </div>
        </div>

        {/* Modal Bottom Actions (hidden when printing) */}
        <div className="no-print bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Statement
          </button>
        </div>
      </div>
    </div>
  );
}

