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
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        id="loading-progress-card"
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-5 text-white relative overflow-hidden"
      >
        {/* Animated Background Glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulse">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-100">
                Loading Map Features
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
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-300 ease-out shadow-sm"
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
          <span>Querying Overpass OpenStreetMap API</span>
          <span>Lightweight & fast</span>
        </div>
      </div>
    </div>
  );
};
