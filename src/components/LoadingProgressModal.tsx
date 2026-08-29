import React from 'react';
import { LoadingProgress, LocationScope } from '../types';
import { Compass, MapPin, X } from 'lucide-react';

interface LoadingProgressModalProps {
  isOpen: boolean;
  progress: LoadingProgress | null;
  scope: LocationScope;
  locationName?: string;
  onCancel?: () => void;
}

export const LoadingProgressModal: React.FC<LoadingProgressModalProps> = ({
  isOpen,
  progress,
  scope,
  locationName,
  onCancel,
}) => {
  if (!isOpen || !progress) return null;

  const percent = Math.min(100, Math.max(5, progress.percent));

  return (
    <div
      id="loading-progress-modal-backdrop"
      className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        id="loading-progress-card"
        className="app-dialog w-full max-w-md p-6 space-y-5 relative overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-900 flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-100">
                Preparing your quiz
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>{locationName || 'Current Location'}</span>
                <span>•</span>
                <span className="capitalize px-1.5 py-0.5 rounded-full bg-slate-800 text-blue-300 font-semibold text-[10px]">
                  {scope === 'neighborhood' ? '🏘️ Neighborhood' : '🏙️ Whole City'}
                </span>
              </div>
            </div>
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              title="Cancel Loading"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Status Messages */}
        <div className="space-y-1.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-200">{progress.message}</span>
            <span className="text-blue-400 font-mono font-bold">{Math.round(percent)}%</span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div
            className="h-full rounded-full bg-emerald-700 transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>

          {progress.subMessage && (
            <p className="text-[11px] text-slate-400 pt-0.5 leading-relaxed">
              {progress.subMessage}
            </p>
          )}
        </div>

        {/* Explanatory Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>OpenStreetMap data</span>
          <span>You can cancel at any time</span>
        </div>
      </div>
    </div>
  );
};
