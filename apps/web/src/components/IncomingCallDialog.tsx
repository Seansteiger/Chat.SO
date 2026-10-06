import React from 'react';
import { CallIncomingPayload } from '@chatso/shared';
import { Phone, PhoneOff, Video } from 'lucide-react';

interface IncomingCallDialogProps {
  incomingCall: CallIncomingPayload | null;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallDialog: React.FC<IncomingCallDialogProps> = ({
  incomingCall,
  onAccept,
  onReject,
}) => {
  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl p-6 glass-panel border border-white/15 shadow-2xl text-center relative my-auto">
        {/* Pulsing ring animation */}
        <div className="w-24 h-24 mx-auto mb-4 relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-2xl text-white shadow-xl">
            {incomingCall.callerName.charAt(0).toUpperCase()}
          </div>
        </div>

        <h3 className="text-lg font-bold text-white truncate">{incomingCall.callerName}</h3>
        <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5">
          {incomingCall.isVideo ? (
            <>
              <Video className="w-3.5 h-3.5 text-blue-400" />
              <span>Incoming Video Call...</span>
            </>
          ) : (
            <>
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Incoming Audio Call...</span>
            </>
          )}
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-6 mt-8">
          {/* Decline */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onReject}
              title="Decline"
              className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-500/30 flex items-center justify-center transition-all active:scale-95"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] text-slate-400 font-medium">Decline</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onAccept}
              title="Accept"
              className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all active:scale-95 animate-bounce"
            >
              <Phone className="w-6 h-6" />
            </button>
            <span className="text-[11px] text-slate-400 font-medium">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};
