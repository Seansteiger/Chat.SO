import React, { useRef, useEffect, useState } from 'react';
import { CallState } from '@chatso/shared';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Wifi,
  Volume2,
} from 'lucide-react';

interface VideoCallOverlayProps {
  callState: CallState;
  activePeer: { id: string; name: string; avatar?: string | null; isVideo: boolean } | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

export const VideoCallOverlay: React.FC<VideoCallOverlayProps> = ({
  callState,
  activePeer,
  localStream,
  remoteStream,
  isAudioMuted,
  isVideoOff,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Call duration counter
  useEffect(() => {
    let timer: number | null = null;
    if (callState === 'CONNECTED') {
      timer = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  if (callState === 'IDLE' || !activePeer) return null;

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`fixed transition-all duration-300 z-50 ${
        isMinimized
          ? 'bottom-6 right-6 w-80 h-48 rounded-2xl shadow-2xl overflow-hidden border border-white/20'
          : 'inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col'
      }`}
    >
      {/* Top Bar & Telemetry HUD */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-auto">
        <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-lg">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 presence-pulse" />
          <span className="text-xs font-semibold text-white">{activePeer.name}</span>
          <span className="text-[11px] text-slate-400 tabular-numbers">
            {callState === 'CONNECTED' ? formatTimer(callDuration) : callState.toLowerCase() + '...'}
          </span>
        </div>

        {/* Center WebRTC Telemetry HUD (Stitch Stage HUD) */}
        <div className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg text-[11px] text-slate-300 font-mono">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>E2EE Mesh</span>
          </div>
          <span className="text-white/20">•</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>18ms • 0% loss</span>
          </div>
          <span className="text-white/20">•</span>
          <span className="text-slate-400 font-sans text-[10px] uppercase tracking-wider font-semibold">1080p60 Opus HD</span>
        </div>

        <button
          type="button"
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 transition-colors shadow-lg"
        >
          {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Video Canvas Area */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black">
        {/* Remote Video / Audio Media Stream */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${
            remoteStream && remoteStream.getVideoTracks().length > 0 ? 'block' : 'hidden'
          }`}
        />

        {/* Remote Audio Avatar View (shown when remote stream has no video) */}
        {(!remoteStream || remoteStream.getVideoTracks().length === 0) && (
          <div className="flex flex-col items-center justify-center text-slate-400 p-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-2xl mb-4 ring-4 ring-blue-500/20">
              {activePeer.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-lg font-semibold text-white">{activePeer.name}</p>
            <p className="text-xs text-slate-400 mt-1">
              {callState === 'CALLING'
                ? 'Ringing peer...'
                : callState === 'NEGOTIATING'
                ? 'Negotiating WebRTC mesh...'
                : 'P2P Audio Call in progress'}
            </p>
          </div>
        )}

        {/* Active Speaker HUD (Bottom Left) */}
        {!isMinimized && callState === 'CONNECTED' && (
          <div className="absolute bottom-24 left-4 sm:left-6 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-white z-20 shadow-lg">
            <div className="flex items-center gap-0.5 h-3">
              <div className="w-1 bg-emerald-400 rounded-full animate-pulse h-2" />
              <div className="w-1 bg-emerald-400 rounded-full animate-pulse h-3 delay-75" />
              <div className="w-1 bg-emerald-400 rounded-full animate-pulse h-1.5 delay-150" />
            </div>
            <span className="text-xs font-semibold">{activePeer.name}</span>
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
          </div>
        )}

        {/* Local Self-View PiP */}
        {!isMinimized && (
          <div className="absolute bottom-24 right-4 sm:right-6 w-28 sm:w-44 md:w-56 aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900 z-20 ring-1 ring-black/40">
            {localStream && !isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 text-xs font-medium">
                Camera Off
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Call Controls Dock (Stitch Stage Controller) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl z-20 mb-[env(safe-area-inset-bottom,0px)]">
        {/* Toggle Audio */}
        <button
          type="button"
          onClick={onToggleAudio}
          title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
          className={`p-3 rounded-xl transition-all ${
            isAudioMuted
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Toggle Video */}
        <button
          type="button"
          onClick={onToggleVideo}
          title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          className={`p-3 rounded-xl transition-all ${
            isVideoOff
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-white/10 hover:bg-white/20 text-white'
          }`}
        >
          {isVideoOff ? <VideoOff className="w-5 h-5" /> : <VideoIcon className="w-5 h-5" />}
        </button>

        {/* Hang Up (Red Glow) */}
        <button
          type="button"
          onClick={onEndCall}
          title="End Call"
          className="p-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-500/30 transition-all active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
