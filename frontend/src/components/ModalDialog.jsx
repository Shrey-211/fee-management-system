import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';

export default function ModalDialog({
  isOpen,
  type = 'confirm', // 'confirm' | 'alert' | 'danger' | 'warning' | 'info' | 'success'
  title = 'Confirmation Required',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary', // 'primary' | 'danger' | 'warning' | 'emerald'
  loading = false,
  onConfirm,
  onClose
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const isAlert = type === 'alert' || type === 'info' || type === 'success';

  const getIconAndColors = () => {
    if (type === 'danger' || confirmVariant === 'danger') {
      return {
        icon: <AlertCircle className="w-6 h-6 text-rose-600" />,
        badgeBg: 'bg-rose-100 border-rose-200',
        btnBg: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500'
      };
    }
    if (type === 'warning' || confirmVariant === 'warning') {
      return {
        icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
        badgeBg: 'bg-amber-100 border-amber-200',
        btnBg: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500'
      };
    }
    if (type === 'success' || confirmVariant === 'emerald') {
      return {
        icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
        badgeBg: 'bg-emerald-100 border-emerald-200',
        btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500'
      };
    }
    return {
      icon: <Info className="w-6 h-6 text-blue-600" />,
      badgeBg: 'bg-blue-100 border-blue-200',
      btnBg: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'
    };
  };

  const { icon, badgeBg, btnBg } = getIconAndColors();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl border flex-shrink-0 ${badgeBg}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <button
                  type="button"
                  disabled={loading}
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {!isAlert && (
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-1 ${btnBg}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

