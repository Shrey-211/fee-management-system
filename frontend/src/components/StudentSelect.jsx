import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X, Check, User } from 'lucide-react';

export default function StudentSelect({
  students = [],
  value = '',
  onChange,
  placeholder = '-- Choose Student by Name / ID --',
  required = false,
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Find currently selected student object
  const selectedStudent = students.find(
    (s) => String(s.id) === String(value)
  );

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input whenever dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter students based on query (name, student_code, mobile, email, category)
  const filteredStudents = students.filter((s) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    const nameMatch = (s.full_name || '').toLowerCase().includes(q);
    const codeMatch = (s.student_code || '').toLowerCase().includes(q);
    const mobileMatch = (s.mobile_number || '').includes(q);
    const emailMatch = (s.email_address || '').toLowerCase().includes(q);
    const categoryMatch = (s.category || '').toLowerCase().includes(q);
    return nameMatch || codeMatch || mobileMatch || emailMatch || categoryMatch;
  });

  const handleSelect = (student) => {
    if (onChange) {
      // Simulate standard event object target.value or direct value
      onChange({ target: { value: String(student.id) } }, student);
    }
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange({ target: { value: '' } }, null);
    }
    setQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Hidden input to satisfy native form required validation */}
      <input
        type="text"
        required={required}
        value={value || ''}
        onChange={() => {}}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Main Trigger Box */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full min-h-[42px] px-3 py-2 border rounded-lg cursor-pointer transition flex items-center justify-between text-xs bg-white ${
          disabled
            ? 'bg-slate-100 cursor-not-allowed text-slate-400 border-slate-200'
            : isOpen
            ? 'border-blue-600 ring-2 ring-blue-100 shadow-sm'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        {selectedStudent ? (
          <div className="flex items-center justify-between w-full gap-2 pr-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded shrink-0">
                {selectedStudent.student_code}
              </span>
              <span className="font-bold text-slate-900 truncate">
                {selectedStudent.full_name}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded shrink-0">
                {selectedStudent.category}
              </span>
              {selectedStudent.overall_balance !== undefined && (
                <span className="text-[11px] font-mono font-semibold text-rose-600 shrink-0 ml-auto hidden sm:inline">
                  Due: ₹{Number(selectedStudent.overall_balance).toLocaleString('en-IN')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClear}
                title="Clear selection"
                className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full text-slate-400">
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>{placeholder}</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 duration-100">
          {/* Search Bar Input */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by student name, code (e.g. STU-001), mobile..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-xs bg-white px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Result Count / Tip */}
          <div className="px-3 py-1.5 bg-slate-100/70 border-b border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>
              {query ? `Search results: ${filteredStudents.length} student${filteredStudents.length === 1 ? '' : 's'}` : `All Students (${students.length})`}
            </span>
            <span className="text-[10px] text-slate-400">Click to select</span>
          </div>

          {/* Students List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <div className="py-6 px-4 text-center text-slate-400">
                <User className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-1" />
                <p className="font-semibold text-slate-600">No students found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No matching student for "{query}". Try a different name or ID.
                </p>
              </div>
            ) : (
              filteredStudents.map((s) => {
                const isSelected = String(s.id) === String(value);
                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelect(s)}
                    className={`px-3 py-2.5 cursor-pointer transition flex items-center justify-between gap-3 text-xs ${
                      isSelected
                        ? 'bg-blue-50 text-blue-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[11px] px-1.5 py-0.2 bg-blue-100/70 text-blue-800 rounded">
                          {s.student_code}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {s.full_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span>Category: <strong className="text-slate-700">{s.category}</strong></span>
                        <span>•</span>
                        <span>{s.gender}</span>
                        {s.course_branch && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[140px]">{s.course_branch}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      {s.overall_balance !== undefined && (
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Balance Due</div>
                          <div className={`font-mono font-bold text-xs ${Number(s.overall_balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ₹{Number(s.overall_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
