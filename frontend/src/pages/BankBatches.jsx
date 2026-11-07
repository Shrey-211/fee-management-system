import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Landmark, CheckSquare, Square, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import CashAlertBanner from '../components/CashAlertBanner';

export default function BankBatches() {
  const [cashStatus, setCashStatus] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState([]);

  // Deposit Form
  const [bankName, setBankName] = useState('Bank of Maharashtra');
  const [bankChallanNo, setBankChallanNo] = useState('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [cash, bList] = await Promise.all([
        api.getCashStatus(),
        api.getBatches()
      ]);
      setCashStatus(cash);
      setBatches(bList);
      // Select all by default
      if (cash.payments) {
        setSelectedReceiptIds(cash.payments.map(p => p.id));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleSelect = (id) => {
    setSelectedReceiptIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedReceiptIds.length === (cashStatus?.payments?.length || 0)) {
      setSelectedReceiptIds([]);
    } else {
      setSelectedReceiptIds((cashStatus?.payments || []).map(p => p.id));
    }
  };

  const selectedTotal = (cashStatus?.payments || [])
    .filter(p => selectedReceiptIds.includes(p.id))
    .reduce((acc, p) => acc + Number(p.amount), 0);

  const handleDepositBatch = async (e) => {
    e.preventDefault();
    if (selectedReceiptIds.length === 0) {
      alert('Please select at least one cash receipt to deposit');
      return;
    }
    setSubmitting(true);
    setMsg('');
    try {
      await api.createBatch({
        deposit_date: depositDate,
        bank_name: bankName,
        bank_challan_no: bankChallanNo || null,
        payment_ids: selectedReceiptIds
      });
      setMsg('Bank deposit batch created successfully!');
      setBankChallanNo('');
      loadData();
    } catch (e) {
      alert(e.message || 'Failed to create deposit batch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <CashAlertBanner cashStatus={cashStatus} onBatchClick={() => {}} />

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {msg}
        </div>
      )}

      {/* Cash Counter & Deposit Workflow Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Unbatched Receipts Selector */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Undeposited Cash Receipts (Counter Safe)
                </h3>
                <p className="text-xs text-slate-500">
                  Select cash receipts to bundle into a bank deposit batch
                </p>
              </div>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {selectedReceiptIds.length === (cashStatus?.payments?.length || 0)
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 w-10">Select</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Manual Receipt #</th>
                    <th className="px-4 py-2.5">Student Name</th>
                    <th className="px-4 py-2.5 text-right">Cash Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!cashStatus?.payments || cashStatus.payments.length === 0) ? (
                    <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-slate-400">
                        No undeposited cash receipts in safe. All cash has been banked.
                      </td>
                    </tr>
                  ) : (
                    cashStatus.payments.map((p) => {
                      const isChecked = selectedReceiptIds.includes(p.id);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => toggleSelect(p.id)}
                          className={`cursor-pointer transition ${
                            isChecked ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.payment_date}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {p.physical_receipt_no}
                          </td>
                          <td className="px-4 py-3 text-slate-800">{p.student_name}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              Selected: <strong>{selectedReceiptIds.length}</strong> receipt(s)
            </span>
            <span className="font-bold text-slate-900">
              Selected Subtotal: <strong className="font-mono text-base text-blue-700 font-black">₹{selectedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
        </div>

        {/* Right 1 Col: Bank Deposit Execution Box */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <form onSubmit={handleDepositBatch} className="space-y-4 text-xs">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Landmark className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Execute Bank Deposit</h3>
              </div>
              <p className="text-slate-500 text-[11px]">
                Create a batch record when sending cash to the college bank account.
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider block">
                Batch Deposit Amount:
              </span>
              <span className="text-2xl font-black font-mono text-blue-900">
                ₹{selectedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Deposit Date *</label>
              <input
                type="date"
                required
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">College Bank *</label>
              <input
                type="text"
                required
                placeholder="e.g. Bank of Maharashtra, SBI"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Bank Challan / Slip / Ref Number
              </label>
              <input
                type="text"
                placeholder="e.g. CHL-2026-90412"
                value={bankChallanNo}
                onChange={(e) => setBankChallanNo(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || selectedReceiptIds.length === 0}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? 'Creating Batch...' : 'Confirm Bank Deposit'}
            </button>
          </form>
        </div>
      </div>

      {/* Historical Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Past Bank Deposit Batches History
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            {batches.length} Deposit Batches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Batch Number</th>
                <th className="px-4 py-3">Deposit Date</th>
                <th className="px-4 py-3">Bank Name</th>
                <th className="px-4 py-3">Challan / Ref #</th>
                <th className="px-4 py-3">Receipts Count</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total Banked Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-slate-400">
                    No bank deposit batches recorded yet.
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-bold text-blue-900">{b.batch_number}</td>
                    <td className="px-4 py-3 text-slate-700">{b.deposit_date}</td>
                    <td className="px-4 py-3 text-slate-800 font-semibold">{b.bank_name || 'N/A'}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{b.bank_challan_no || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{b.payment_count} receipt(s)</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(b.total_cash_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
