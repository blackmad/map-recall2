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
      className="fixed inset-0 bg-[rgba(7,20,48,0.82)] backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
    >
      <div
        id="loading-progress-card"
        className="app-dialog w-full max-w-md p-6 space-y-5 relative overflow-hidden"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md border border-white/40 bg-white/10 flex items-center justify-center">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                Preparing your quiz
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#c4a35a]" />
                <span>{locationName || 'Current Location'}</span>
                <span>•</span>
                <span className="enamel-chip capitalize px-1.5 py-0.5 font-semibold text-xs">
                  {scope === 'neighborhood' ? '🏘️ Neighborhood' : '🏙️ Whole City'}
                </span>
              </div>
            </div>
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              title="Cancel Loading"
              className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="enamel-chip space-y-1.5 p-3.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-white">{progress.message}</span>
            <span className="text-[#c4a35a] font-mono font-bold">{Math.round(percent)}%</span>
          </div>

          <div className="enamel-progress w-full h-3 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>

          {progress.subMessage && (
            <p className="text-xs text-white/60 pt-0.5 leading-relaxed">
              {progress.subMessage}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-white/50 pt-1">
          <span>OpenStreetMap data</span>
          <span>You can cancel at any time</span>
        </div>
      </div>
    </div>
  );
};
