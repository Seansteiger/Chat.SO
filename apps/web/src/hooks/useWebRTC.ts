import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  CallState,
  CallIncomingPayload,
} from '@chatso/shared';
import { api } from '../services/api.js';

interface ActivePeerInfo {
  id: string;
  name: string;
  avatar?: string | null;
  isVideo: boolean;
}

export function useWebRTC(socket: Socket | null) {
  const [callState, setCallState] = useState<CallState>('IDLE');
  const [activePeer, setActivePeer] = useState<ActivePeerInfo | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallIncomingPayload | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const queuedCandidates = useRef<RTCIceCandidateInit[]>([]);

  // Initialize ringtone sound generator
  useEffect(() => {
    // Web Audio synthesizer for incoming ringtone
    let ringInterval: number | null = null;
    let audioCtx: AudioContext | null = null;

    if (callState === 'RINGING') {
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = () => {
          if (!audioCtx) return;
          const osc1 = audioCtx.createOscillator();
          const osc2 = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc1.frequency.value = 440; // A4
          osc2.frequency.value = 480; // High tone
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(audioCtx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(audioCtx.currentTime + 1.2);
          osc2.stop(audioCtx.currentTime + 1.2);
        };

        playTone();
        ringInterval = window.setInterval(playTone, 2500);
      } catch (err) {
        console.warn('AudioContext not allowed yet:', err);
      }
    }

    return () => {
      if (ringInterval) clearInterval(ringInterval);
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [callState]);

  // Cleanup helper
  const teardownCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    queuedCandidates.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setActivePeer(null);
    setIncomingCall(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setCallState('IDLE');
  }, []);

  // Initialize local media
  const setupLocalMedia = async (video: boolean): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn('[WebRTC] Camera/mic access fallback:', err);
      try {
        // Fallback: Try audio only if video failed
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (audioErr) {
        console.warn('[WebRTC] Microphone unavailable, using silent audio fallback:', audioErr);
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const dst = osc.connect(ctx.createMediaStreamDestination()) as any;
          const dummyStream = dst.stream;
          localStreamRef.current = dummyStream;
          setLocalStream(dummyStream);
          return dummyStream;
        }
        throw audioErr;
      }
    }
  };

  // Create RTCPeerConnection with dynamic ICE config
  const createPeerConnection = async (targetUserId: string): Promise<RTCPeerConnection> => {
    let iceConfig: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    try {
      const res = await api.getIceServers();
      if (res.iceServers && res.iceServers.length > 0) {
        iceConfig = { iceServers: res.iceServers as any };
      }
    } catch (err) {
      console.warn('[WebRTC] Using fallback Google STUN:', err);
    }

    const pc = new RTCPeerConnection(iceConfig);
    pcRef.current = pc;

    // Handle remote media track
    const newRemoteStream = new MediaStream();
    setRemoteStream(newRemoteStream);

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        newRemoteStream.addTrack(track);
      });
      setRemoteStream(new MediaStream(newRemoteStream.getTracks()));
    };

    // Trickle ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, {
          targetId: targetUserId,
          recipientId: targetUserId,
          targetUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('CONNECTED');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        teardownCall();
      }
    };

    return pc;
  };

  // Start outgoing call
  const startCall = async (peerId: string, peerName: string, isVideo: boolean = true) => {
    if (!socket || callState !== 'IDLE') return;

    try {
      setCallState('CALLING');
      setActivePeer({ id: peerId, name: peerName, isVideo });

      socket.emit(
        SOCKET_EVENTS.CALL_INITIATE,
        { recipientId: peerId, targetUserId: peerId, peerId, isVideo },
        (res: { success: boolean; error?: string }) => {
          if (!res?.success) {
            console.warn('[WebRTC] Call initiate failed:', res?.error);
            alert(res?.error || 'User is busy or unavailable');
            teardownCall();
          }
        }
      );
    } catch (err) {
      console.error('[WebRTC.startCall] Error:', err);
      teardownCall();
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!socket || !incomingCall) return;

    try {
      setCallState('NEGOTIATING');
      const callerId = incomingCall.callerId;
      setActivePeer({
        id: callerId,
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar,
        isVideo: incomingCall.isVideo,
      });
      setIncomingCall(null);

      // Acquire media & create RTCPeerConnection
      const stream = await setupLocalMedia(incomingCall.isVideo);
      const pc = await createPeerConnection(callerId);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Notify caller of acceptance
      socket.emit(SOCKET_EVENTS.CALL_ACCEPT, { callerId });
    } catch (err) {
      console.error('[WebRTC.acceptCall] Error:', err);
      teardownCall();
    }
  };

  // Reject incoming call
  const rejectCall = (reason: string = 'declined') => {
    if (!socket || !incomingCall) return;
    socket.emit(SOCKET_EVENTS.CALL_REJECT, { callerId: incomingCall.callerId, reason });
    setIncomingCall(null);
    setCallState('IDLE');
  };

  // End active call
  const endCall = () => {
    if (activePeer && socket) {
      socket.emit(SOCKET_EVENTS.CALL_END, { peerId: activePeer.id });
    }
    teardownCall();
  };

  // Toggle microphone audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle camera video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Socket signaling listener bindings
  useEffect(() => {
    if (!socket) return;

    // Incoming Call Invitation
    socket.on(SOCKET_EVENTS.CALL_INCOMING, (payload: CallIncomingPayload) => {
      if (callState !== 'IDLE') {
        // Automatically report busy if already in call
        socket.emit(SOCKET_EVENTS.CALL_REJECT, { callerId: payload.callerId, reason: 'busy' });
        return;
      }
      setIncomingCall(payload);
      setCallState('RINGING');
    });

    // Caller receives acceptance from peer
    socket.on(SOCKET_EVENTS.CALL_ACCEPT, async (payload: { peerId: string }) => {
      try {
        setCallState('NEGOTIATING');
        const stream = await setupLocalMedia(activePeer?.isVideo ?? true);
        const pc = await createPeerConnection(payload.peerId);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Caller creates SDP offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit(SOCKET_EVENTS.CALL_OFFER, {
          recipientId: payload.peerId,
          targetUserId: payload.peerId,
          peerId: payload.peerId,
          sdp: { type: offer.type, sdp: offer.sdp },
        });
      } catch (err) {
        console.error('[WebRTC] Offer creation error:', err);
        teardownCall();
      }
    });

    // Receiver receives SDP offer
    socket.on(SOCKET_EVENTS.CALL_OFFER, async (payload: { callerId: string; sdp: RTCSessionDescriptionInit }) => {
      try {
        const pc = pcRef.current;
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        // Drain queued ICE candidates
        for (const cand of queuedCandidates.current) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
        }
        queuedCandidates.current = [];

        // Create SDP answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit(SOCKET_EVENTS.CALL_ANSWER, {
          callerId: payload.callerId,
          recipientId: payload.callerId,
          targetUserId: payload.callerId,
          peerId: payload.callerId,
          sdp: { type: answer.type, sdp: answer.sdp },
        });

        setCallState('CONNECTED');
      } catch (err) {
        console.error('[WebRTC] Answer creation error:', err);
        teardownCall();
      }
    });

    // Caller receives SDP answer
    socket.on(SOCKET_EVENTS.CALL_ANSWER, async (payload: { peerId: string; sdp: RTCSessionDescriptionInit }) => {
      try {
        const pc = pcRef.current;
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        // Drain queued ICE candidates
        for (const cand of queuedCandidates.current) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
        }
        queuedCandidates.current = [];

        setCallState('CONNECTED');
      } catch (err) {
        console.error('[WebRTC] Remote description error:', err);
      }
    });

    // Trickle ICE candidate handler
    socket.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, async (payload: { senderId: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.warn);
      } else {
        queuedCandidates.current.push(payload.candidate);
      }
    });

    // Call Rejected
    socket.on(SOCKET_EVENTS.CALL_REJECT, (payload: { peerId?: string; reason?: string }) => {
      alert(`Call was ${payload.reason || 'declined'}.`);
      teardownCall();
    });

    // Call Ended
    socket.on(SOCKET_EVENTS.CALL_END, () => {
      teardownCall();
    });

    return () => {
      socket.off(SOCKET_EVENTS.CALL_INCOMING);
      socket.off(SOCKET_EVENTS.CALL_ACCEPT);
      socket.off(SOCKET_EVENTS.CALL_OFFER);
      socket.off(SOCKET_EVENTS.CALL_ANSWER);
      socket.off(SOCKET_EVENTS.CALL_ICE_CANDIDATE);
      socket.off(SOCKET_EVENTS.CALL_REJECT);
      socket.off(SOCKET_EVENTS.CALL_END);
    };
  }, [socket, callState, activePeer, incomingCall, teardownCall]);

  return {
    callState,
    activePeer,
    incomingCall,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleAudio,
    toggleVideo,
  };
}
