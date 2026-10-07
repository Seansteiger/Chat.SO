import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import {
  SOCKET_EVENTS,
  CallState,
  CallIncomingPayload,
} from '@chatso/shared';
import { api } from '../services/api.js';
import { sound } from '../services/notifications.js';

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

  // Persistent refs to eliminate socket listener rebind loops and race conditions
  const callStateRef = useRef<CallState>('IDLE');
  const activePeerRef = useRef<ActivePeerInfo | null>(null);
  const incomingCallRef = useRef<CallIncomingPayload | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  // Keep refs synchronized with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    activePeerRef.current = activePeer;
  }, [activePeer]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  // Cleanup helper
  const teardownCall = useCallback(() => {
    const wasActive = callStateRef.current !== 'IDLE';
    if (wasActive) {
      sound.playCallEndTone();
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    queuedCandidates.current = [];
    activeCallIdRef.current = null;
    incomingCallRef.current = null;
    activePeerRef.current = null;
    callStateRef.current = 'IDLE';

    setLocalStream(null);
    setRemoteStream(null);
    setActivePeer(null);
    setIncomingCall(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setCallState('IDLE');
  }, []);

  // Initialize local media (camera and/or microphone)
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
          callId: activeCallIdRef.current,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('CONNECTED');
        callStateRef.current = 'CONNECTED';
        if (socket && activeCallIdRef.current) {
          socket.emit((SOCKET_EVENTS as any).CALL_CONNECTED, {
            callId: activeCallIdRef.current,
          });
        }
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        teardownCall();
      }
    };

    return pc;
  };

  // Start outgoing call
  const startCall = async (peerId: string, peerName: string, isVideo: boolean = true) => {
    if (!socket || callStateRef.current !== 'IDLE') return;

    try {
      const peerInfo: ActivePeerInfo = { id: peerId, name: peerName, isVideo };
      setCallState('CALLING');
      callStateRef.current = 'CALLING';
      setActivePeer(peerInfo);
      activePeerRef.current = peerInfo;

      // Pre-acquire camera / microphone immediately on direct user click gesture!
      try {
        await setupLocalMedia(isVideo);
      } catch (mediaErr) {
        console.warn('[WebRTC] Pre-acquiring media failed:', mediaErr);
      }

      socket.emit(
        SOCKET_EVENTS.CALL_INITIATE,
        { recipientId: peerId, targetUserId: peerId, peerId, isVideo },
        (res: { success: boolean; callId?: string; error?: string }) => {
          if (!res?.success) {
            console.warn('[WebRTC] Call initiate failed:', res?.error);
            alert(res?.error || 'User is busy or unavailable');
            teardownCall();
          } else if (res?.callId) {
            activeCallIdRef.current = res.callId;
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
    const currentIncoming = incomingCallRef.current || incomingCall;
    if (!socket || !currentIncoming) return;

    try {
      setCallState('NEGOTIATING');
      callStateRef.current = 'NEGOTIATING';
      activeCallIdRef.current = (currentIncoming as any).callId || null;

      const callerId = currentIncoming.callerId;
      const peerInfo: ActivePeerInfo = {
        id: callerId,
        name: currentIncoming.callerName,
        avatar: currentIncoming.callerAvatar,
        isVideo: currentIncoming.isVideo,
      };
      setActivePeer(peerInfo);
      activePeerRef.current = peerInfo;
      setIncomingCall(null);
      incomingCallRef.current = null;

      // Acquire media & create RTCPeerConnection
      const stream = await setupLocalMedia(currentIncoming.isVideo);
      const pc = await createPeerConnection(callerId);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Notify caller of acceptance
      socket.emit(SOCKET_EVENTS.CALL_ACCEPT, {
        callerId,
        callId: activeCallIdRef.current,
      });
    } catch (err) {
      console.error('[WebRTC.acceptCall] Error:', err);
      teardownCall();
    }
  };

  // Reject incoming call
  const rejectCall = (reason: string = 'declined') => {
    const currentIncoming = incomingCallRef.current || incomingCall;
    if (!socket || !currentIncoming) return;

    socket.emit(SOCKET_EVENTS.CALL_REJECT, {
      callerId: currentIncoming.callerId,
      callId: (currentIncoming as any).callId || activeCallIdRef.current,
      reason,
    });
    setIncomingCall(null);
    incomingCallRef.current = null;
    teardownCall();
  };

  // End active call
  const endCall = () => {
    const peer = activePeerRef.current || activePeer;
    if (peer && socket) {
      socket.emit(SOCKET_EVENTS.CALL_END, {
        peerId: peer.id,
        callId: activeCallIdRef.current,
      });
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

  // Socket signaling listener bindings - mounted once per socket instance
  useEffect(() => {
    if (!socket) return;

    // Incoming Call Invitation
    const handleCallIncoming = (payload: CallIncomingPayload) => {
      // If we are already ringing for this call, ignore duplicate event
      if (
        incomingCallRef.current &&
        (incomingCallRef.current as any).callId === (payload as any).callId
      ) {
        return;
      }

      // If user is currently in another active call, report busy
      if (callStateRef.current !== 'IDLE' && callStateRef.current !== 'RINGING') {
        socket.emit(SOCKET_EVENTS.CALL_REJECT, {
          callerId: payload.callerId,
          callId: (payload as any).callId,
          reason: 'busy',
        });
        return;
      }

      activeCallIdRef.current = (payload as any).callId || null;
      incomingCallRef.current = payload;
      setIncomingCall(payload);
      setCallState('RINGING');
      callStateRef.current = 'RINGING';
    };

    // Caller receives acceptance from peer
    const handleCallAccept = async (payload: { peerId: string; callId?: string }) => {
      try {
        if (payload.callId) {
          activeCallIdRef.current = payload.callId;
        }
        setCallState('NEGOTIATING');
        callStateRef.current = 'NEGOTIATING';

        const isVideo = activePeerRef.current?.isVideo ?? true;
        const stream = localStreamRef.current || (await setupLocalMedia(isVideo));
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
          callId: activeCallIdRef.current,
          sdp: { type: offer.type, sdp: offer.sdp },
        });
      } catch (err) {
        console.error('[WebRTC] Offer creation error:', err);
        teardownCall();
      }
    };

    // Receiver receives SDP offer
    const handleCallOffer = async (payload: {
      callerId: string;
      callId?: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      try {
        if (payload.callId) {
          activeCallIdRef.current = payload.callId;
        }
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
          callId: activeCallIdRef.current,
          sdp: { type: answer.type, sdp: answer.sdp },
        });

        setCallState('CONNECTED');
        callStateRef.current = 'CONNECTED';
        if (activeCallIdRef.current) {
          socket.emit((SOCKET_EVENTS as any).CALL_CONNECTED, {
            callId: activeCallIdRef.current,
          });
        }
      } catch (err) {
        console.error('[WebRTC] Answer creation error:', err);
        teardownCall();
      }
    };

    // Caller receives SDP answer
    const handleCallAnswer = async (payload: {
      peerId: string;
      callId?: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      try {
        if (payload.callId) {
          activeCallIdRef.current = payload.callId;
        }
        const pc = pcRef.current;
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        for (const cand of queuedCandidates.current) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.warn);
        }
        queuedCandidates.current = [];

        setCallState('CONNECTED');
        callStateRef.current = 'CONNECTED';
        if (activeCallIdRef.current) {
          socket.emit((SOCKET_EVENTS as any).CALL_CONNECTED, {
            callId: activeCallIdRef.current,
          });
        }
      } catch (err) {
        console.error('[WebRTC] Remote description error:', err);
      }
    };

    // Trickle ICE candidate handler
    const handleCallIceCandidate = async (payload: {
      senderId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(console.warn);
      } else {
        queuedCandidates.current.push(payload.candidate);
      }
    };

    // Call Rejected
    const handleCallReject = (payload: { peerId?: string; reason?: string }) => {
      alert(`Call was ${payload.reason || 'declined'}.`);
      teardownCall();
    };

    // Call Ended
    const handleCallEnd = () => {
      teardownCall();
    };

    socket.on(SOCKET_EVENTS.CALL_INCOMING, handleCallIncoming);
    socket.on(SOCKET_EVENTS.CALL_ACCEPT, handleCallAccept);
    socket.on(SOCKET_EVENTS.CALL_OFFER, handleCallOffer);
    socket.on(SOCKET_EVENTS.CALL_ANSWER, handleCallAnswer);
    socket.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, handleCallIceCandidate);
    socket.on(SOCKET_EVENTS.CALL_REJECT, handleCallReject);
    socket.on(SOCKET_EVENTS.CALL_END, handleCallEnd);

    return () => {
      socket.off(SOCKET_EVENTS.CALL_INCOMING, handleCallIncoming);
      socket.off(SOCKET_EVENTS.CALL_ACCEPT, handleCallAccept);
      socket.off(SOCKET_EVENTS.CALL_OFFER, handleCallOffer);
      socket.off(SOCKET_EVENTS.CALL_ANSWER, handleCallAnswer);
      socket.off(SOCKET_EVENTS.CALL_ICE_CANDIDATE, handleCallIceCandidate);
      socket.off(SOCKET_EVENTS.CALL_REJECT, handleCallReject);
      socket.off(SOCKET_EVENTS.CALL_END, handleCallEnd);
    };
  }, [socket, teardownCall]);

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
