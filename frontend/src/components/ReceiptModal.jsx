import React from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';
import collegeLogo from '../assets/college_logo_sm.png';

export function numberToIndianWords(num) {
  if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
  };

  const convertChunk = (n) => {
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 0) {
      str += inWords(n) + ' ';
    }
    return str.trim();
  };

  let intPart = Math.floor(num);
  let crore = Math.floor(intPart / 10000000);
  intPart %= 10000000;
  let lakh = Math.floor(intPart / 100000);
  intPart %= 100000;
  let thousand = Math.floor(intPart / 1000);
  intPart %= 1000;
  let hundred = intPart;

  let res = '';
  if (crore > 0) res += convertChunk(crore) + ' Crore ';
  if (lakh > 0) res += convertChunk(lakh) + ' Lakh ';
  if (thousand > 0) res += convertChunk(thousand) + ' Thousand ';
  if (hundred > 0) res += convertChunk(hundred) + ' ';

  return ('Rupees ' + res.trim() + ' Only').replace(/\s+/g, ' ');
}

export default function ReceiptModal({ isOpen, payment, student, onClose }) {
  if (!isOpen || !payment) return null;

  const studentName = payment.student_name || student?.full_name || 'N/A';
  const studentCode = payment.student_code || student?.student_code || 'N/A';
  const studentCategory = payment.student_category || student?.category || 'N/A';
  const studentCourse = payment.student_course || student?.course_branch || 'MBA';
  const academicYear = payment.student_academic_year || student?.academic_year || '2026-2027';

  const handlePrint = () => {
    window.print();
  };

  const amountInWords = numberToIndianWords(Number(payment.total_amount || 0));

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
          #receipt-printable-area, #receipt-printable-area * {
            visibility: visible !important;
          }
          #receipt-printable-area {
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

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col my-auto print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="no-print bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-tight">Payment Receipt — Official College Document</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div id="receipt-printable-area" className="p-6 sm:p-8 bg-white text-slate-900 print:p-4">
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
                Phaltan, Dist. Satara - 415523 (Maharashtra) | Phone: (02166) 221233
              </p>
            </div>
          </div>

          {/* Receipt Title & Copies */}
          <div className="my-3 py-1 px-4 bg-slate-100 border border-slate-300 rounded flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-800">
            <span>Official Fee Payment Receipt</span>
            <span className="text-[10px] text-slate-600 font-semibold lowercase italic">student / accounts copy</span>
          </div>

          {/* Receipt Meta Grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs py-2 border-b border-slate-200">
            <div className="space-y-1">
              <div>
                <span className="text-slate-500 font-medium">Receipt No (System): </span>
                <span className="font-mono font-bold text-slate-900">{payment.internal_receipt_no}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Receipt Book # (Manual): </span>
                <span className="font-mono font-bold text-blue-900">
                  {payment.physical_receipt_no || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Student Name: </span>
                <span className="font-bold text-slate-900">{studentName}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Student ID / Roll Code: </span>
                <span className="font-mono font-bold text-slate-900">{studentCode}</span>
              </div>
            </div>

            <div className="space-y-1 text-right sm:text-left">
              <div>
                <span className="text-slate-500 font-medium">Payment Date: </span>
                <span className="font-bold text-slate-900">{payment.payment_date}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Payment Mode: </span>
                <span className="font-bold uppercase text-slate-900 px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">
                  {payment.payment_mode}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Course / Branch: </span>
                <span className="font-semibold text-slate-800">{studentCourse}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Category / Academic Year: </span>
                <span className="font-semibold text-slate-800">{studentCategory} | {academicYear}</span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="my-4">
            <table className="w-full text-xs border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold uppercase text-[11px]">
                  <th className="py-2 px-3 text-center w-12 border-r border-slate-300">Sr.</th>
                  <th className="py-2 px-3 text-left border-r border-slate-300">Fee Particulars / Event Reason</th>
                  <th className="py-2 px-3 text-right w-36">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(payment.items || []).map((itm, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-center font-medium text-slate-600 border-r border-slate-200">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 text-slate-900 font-semibold border-r border-slate-200">
                      {itm.fee_head_name || (itm.fine_event_name ? `Fine: ${itm.fine_event_name}` : 'Fee Payment')}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(itm.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-400 font-black text-xs">
                  <td colSpan="2" className="py-2.5 px-3 text-right uppercase border-r border-slate-300">
                    Total Amount Received:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-emerald-800">
                    ₹{Number(payment.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount In Words */}
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs mb-4">
            <span className="font-bold text-slate-700">Amount in Words: </span>
            <span className="font-semibold text-slate-900 italic">{amountInWords}</span>
          </div>

          {payment.remarks && (
            <div className="text-[11px] text-slate-600 mb-4 italic">
              <span className="font-bold text-slate-700 not-italic">Note / Remarks: </span>
              {payment.remarks}
            </div>
          )}

          {/* Signatures & Seal Section */}
          <div className="pt-8 mt-6 border-t border-dashed border-slate-300 grid grid-cols-3 text-center text-xs">
            <div>
              <div className="h-10"></div>
              <p className="border-t border-slate-400 pt-1 font-semibold text-slate-700">
                Student's Signature
              </p>
            </div>
            <div>
              <div className="h-10 flex items-center justify-center text-[10px] text-slate-400 italic">
                [ College Cashier Seal ]
              </div>
              <p className="border-t border-slate-400 pt-1 font-semibold text-slate-700">
                Cashier / Fee Counter
              </p>
            </div>
            <div>
              <div className="h-10"></div>
              <p className="border-t border-slate-400 pt-1 font-semibold text-slate-700">
                Authorized Signatory / Director
              </p>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-100 text-[9.5px] text-slate-400 text-center">
            This is a computer generated official fee receipt of Krishna Foundation's SJNNIMS, Phaltan.
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
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

