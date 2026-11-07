import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Mail, Send, CheckSquare, Square, Edit3, Clock, CheckCircle2, AlertTriangle, Save } from 'lucide-react';

export default function Reminders() {
  const [students, setStudents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [targetDueDate, setTargetDueDate] = useState('Within 7 Days');

  // Template Editing
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState('');

  // Dispatch Status
  const [sending, setSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sList, tList, lList] = await Promise.all([
        api.getStudents({ has_dues_only: true }),
        api.getTemplates(),
        api.getReminderLogs()
      ]);
      // Filter students with email addresses and dues > 0
      const eligible = sList.filter(s => s.email_address && Number(s.overall_balance) > 0);
      setStudents(eligible);
      setSelectedStudentIds(eligible.map(s => s.id)); // Default select all

      setTemplates(tList);
      if (tList.length > 0) {
        const def = tList.find(t => t.is_default) || tList[0];
        setSelectedTemplate(def);
        setSubject(def.subject);
        setBody(def.body_template);
      }
      setLogs(lList);
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
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map(s => s.id));
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setSavingTemplate(true);
    setTemplateSavedMsg('');
    try {
      await api.updateTemplate(selectedTemplate.id, {
        subject: subject.trim(),
        body_template: body
      });
      setTemplateSavedMsg('Template saved successfully!');
      setTimeout(() => setTemplateSavedMsg(''), 4000);
    } catch (e) {
      alert(e.message || 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSendReminders = async () => {
    if (selectedStudentIds.length === 0) {
      alert('Please select at least one student');
      return;
    }
    setSending(true);
    setDispatchResult(null);
    try {
      const res = await api.sendReminders({
        student_ids: selectedStudentIds,
        template_id: selectedTemplate?.id,
        target_due_date: targetDueDate
      });
      setDispatchResult(res);
      const lList = await api.getReminderLogs();
      setLogs(lList);
    } catch (e) {
      alert(e.message || 'Error triggering reminder dispatch');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            Email Reminders Engine (College SMTP)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch personalized fee dues reminders using the college's configured SMTP mailbox
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Target Due Date (e.g. Within 7 Days)"
            value={targetDueDate}
            onChange={(e) => setTargetDueDate(e.target.value)}
            className="px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={handleSendReminders}
            disabled={sending || selectedStudentIds.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Dispatching...' : `Dispatch to (${selectedStudentIds.length}) Students`}
          </button>
        </div>
      </div>

      {dispatchResult && (
        <div className="p-4 bg-slate-900 text-white rounded-xl shadow space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Dispatch Summary: {dispatchResult.total_dispatched} Processed
            </h4>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-emerald-400">Success: {dispatchResult.successful}</span>
              <span className="text-rose-400">Failed / Offline: {dispatchResult.failed}</span>
            </div>
          </div>
          {dispatchResult.failed > 0 && (
            <p className="text-amber-300 text-[11px]">
              Note: Unsuccessful deliveries occur if SMTP credentials are unconfigured or when offline. Delivery status is logged below.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Eligible Students Selector */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Students with Outstanding Dues & Valid Emails
                </h3>
                <p className="text-[11px] text-slate-500">
                  {students.length} eligible recipients
                </p>
              </div>
              <button
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {selectedStudentIds.length === students.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 w-10">Select</th>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5">Email Address</th>
                    <th className="px-4 py-2.5 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-slate-400">
                        No students with pending dues and valid email addresses found.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => {
                      const isChecked = selectedStudentIds.includes(s.id);
                      return (
                        <tr
                          key={s.id}
                          onClick={() => toggleSelect(s.id)}
                          className={`cursor-pointer transition ${isChecked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-3">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 block">{s.full_name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{s.student_code}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{s.email_address}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                            ₹{Number(s.overall_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs flex items-center justify-between font-medium text-slate-600">
            <span>Selected Recipients: <strong>{selectedStudentIds.length}</strong></span>
          </div>
        </div>

        {/* Right: Editable Email Template */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Email Template Customizer
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dynamic tags: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{student_name}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{student_code}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{total_due}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{due_date}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{fee_breakdown}'}</code>
                </p>
              </div>
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Save className="w-3.5 h-3.5" />
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>

            {templateSavedMsg && (
              <div className="p-2 bg-emerald-50 text-emerald-800 rounded text-[11px] font-medium border border-emerald-200">
                {templateSavedMsg}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Message Body</label>
              <textarea
                rows="11"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono text-[11px] leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reminder Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Recent Reminder Dispatch Log
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Last 50 dispatches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Sent Timestamp</th>
                <th className="px-4 py-2.5">Student Name</th>
                <th className="px-4 py-2.5">Recipient Email</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5">Error / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                    No reminder emails logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-slate-500 font-mono">{l.sent_at?.replace('T', ' ').substring(0, 19)}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{l.student_name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{l.recipient_email}</td>
                    <td className="px-4 py-3 text-slate-700 truncate max-w-xs">{l.subject}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px] italic">
                      {l.error_message || 'Delivered to SMTP server successfully'}
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
