import React, { useState, useEffect, useRef } from 'react';
import { Download, RefreshCw, CheckCircle2, AlertCircle, Sparkles, X, ArrowRight, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';

export default function UpdateModal({ isOpen, onClose, updateInfo, onUpdateApplied }) {
  const [stage, setStage] = useState('idle'); // 'idle' | 'downloading' | 'ready' | 'applying' | 'restarting' | 'error'
  const [progress, setProgress] = useState({
    percent: 0,
    downloadedMb: 0,
    totalMb: 0,
    speedKb: 0
  });
  const [errorMsg, setErrorMsg] = useState('');
  const pollTimerRef = useRef(null);
  const restartTimerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (restartTimerRef.current) clearInterval(restartTimerRef.current);
      return;
    }

    // Check current progress status on open
    api.getUpdateProgress().then((data) => {
      if (data.status === 'downloading') {
        setStage('downloading');
        startPolling();
      } else if (data.status === 'ready') {
        setStage('ready');
      }
    }).catch(() => {});

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (restartTimerRef.current) clearInterval(restartTimerRef.current);
    };
  }, [isOpen]);

  const startPolling = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const state = await api.getUpdateProgress();
        if (state.status === 'downloading') {
          setProgress({
            percent: state.progress_percent || 0,
            downloadedMb: (state.downloaded_bytes / (1024 * 1024)).toFixed(1),
            totalMb: (state.total_bytes / (1024 * 1024)).toFixed(1),
            speedKb: state.download_speed_kb || 0
          });
        } else if (state.status === 'ready') {
          clearInterval(pollTimerRef.current);
          setStage('ready');
        } else if (state.status === 'error') {
          clearInterval(pollTimerRef.current);
          setStage('error');
          setErrorMsg(state.error || 'Failed to download update archive.');
        }
      } catch (err) {
        // Continue polling on transient errors
      }
    }, 800);
  };

  const handleStartDownload = async () => {
    if (!updateInfo?.download_url) {
      setErrorMsg('No valid download URL provided by release.');
      setStage('error');
      return;
    }
    setErrorMsg('');
    setStage('downloading');
    setProgress({ percent: 0, downloadedMb: 0, totalMb: 0, speedKb: 0 });

    try {
      await api.downloadUpdate({
        download_url: updateInfo.download_url,
        target_version: updateInfo.latest_version
      });
      startPolling();
    } catch (err) {
      setStage('error');
      setErrorMsg(err.message || 'Failed to initiate download.');
    }
  };

  const handleApplyUpdate = async () => {
    setErrorMsg('');
    setStage('applying');

    try {
      await api.applyUpdate();
      setStage('restarting');

      // Attempt reconnection after 5 seconds
      let attempts = 0;
      restartTimerRef.current = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch('/api/health');
          if (res.ok) {
            clearInterval(restartTimerRef.current);
            window.location.reload();
          }
        } catch (e) {
          if (attempts > 30) {
            clearInterval(restartTimerRef.current);
            setErrorMsg('System took longer than expected to restart. Please manually launch FeeManagementSystem.exe.');
            setStage('error');
          }
        }
      }, 1500);

    } catch (err) {
      setStage('error');
      setErrorMsg(err.message || 'Failed to apply update.');
    }
  };

  if (!isOpen || !updateInfo) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 text-white animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">System Software Update</h3>
              <p className="text-xs text-slate-400">Official Release for Office Installation</p>
            </div>
          </div>
          {stage !== 'applying' && stage !== 'restarting' && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Version Compare Banner */}
        <div className="my-5 bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Current Version</span>
            <span className="text-sm font-bold text-slate-300">v{updateInfo.current_version}</span>
          </div>
          <ArrowRight className="w-4 h-4 text-blue-400" />
          <div className="text-right">
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">New Version</span>
            <span className="text-sm font-bold text-emerald-300">v{updateInfo.latest_version}</span>
          </div>
        </div>

        {/* Release Notes */}
        {stage !== 'restarting' && stage !== 'applying' && (
          <div className="space-y-2 mb-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Release Notes: {updateInfo.release_title}</span>
              {updateInfo.asset_size_mb > 0 && (
                <span>Package: ~{updateInfo.asset_size_mb} MB</span>
              )}
            </div>
            <div className="max-h-40 overflow-y-auto bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line select-text">
              {updateInfo.release_notes || 'Bug fixes and performance improvements.'}
            </div>
          </div>
        )}

        {/* Progress or Status */}
        {stage === 'downloading' && (
          <div className="my-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5 text-blue-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Downloading update package...
              </span>
              <span>{progress.percent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{progress.downloadedMb} MB / {progress.totalMb} MB</span>
              {progress.speedKb > 0 && <span>{(progress.speedKb / 1024).toFixed(1)} MB/s</span>}
            </div>
          </div>
        )}

        {stage === 'ready' && (
          <div className="my-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-3 text-emerald-300 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold">Update Package Verified & Ready</p>
              <p className="text-emerald-400/80 text-[11px]">Database will be automatically backed up before restarting.</p>
            </div>
          </div>
        )}

        {(stage === 'applying' || stage === 'restarting') && (
          <div className="my-6 text-center space-y-3">
            <div className="inline-flex p-3 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <h4 className="text-sm font-bold text-white">Backing up database & applying update...</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              The application is swapping in new files and restarting. This window will automatically reload when the new version is live.
            </p>
          </div>
        )}

        {stage === 'error' && (
          <div className="my-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Update Notice</p>
              <p className="text-rose-400/80 text-[11px] mt-0.5">{errorMsg || 'An error occurred during update.'}</p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Student fee data is preserved 100%</span>
          </div>

          <div className="flex items-center gap-2">
            {stage !== 'applying' && stage !== 'restarting' && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                Later
              </button>
            )}

            {(stage === 'idle' || stage === 'error') && (
              <button
                type="button"
                onClick={handleStartDownload}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
              >
                <Download className="w-3.5 h-3.5" />
                Download & Install
              </button>
            )}

            {stage === 'downloading' && (
              <button
                disabled
                className="flex items-center gap-2 px-4 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs font-semibold cursor-not-allowed"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Downloading ({progress.percent}%)
              </button>
            )}

            {stage === 'ready' && (
              <button
                type="button"
                onClick={handleApplyUpdate}
                className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition animate-pulse"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Restart & Apply Now
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

