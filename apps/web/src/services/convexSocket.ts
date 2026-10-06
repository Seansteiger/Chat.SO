import { SOCKET_EVENTS, MessageDto } from '@chatso/shared';
import { convex, api as convexApi } from '../convex.js';

type Listener = (...args: any[]) => void;

export class ConvexSocketBridge {
  private listeners: Map<string, Set<Listener>> = new Map();
  private currentUserId: string | null = null;
  private currentUserName: string = 'User';
  private unsubs: Array<() => void> = [];
  private activeCallId: string | null = null;
  private seenSignalIds: Set<string> = new Set();
  public connected: boolean = true;

  constructor(userId: string, userName: string) {
    this.currentUserId = userId;
    this.currentUserName = userName;
    this.initSubscriptions();
  }

  private trigger(event: string, ...args: any[]) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(...args);
        } catch (err) {
          console.error(`[ConvexSocket] Listener error on event ${event}:`, err);
        }
      });
    }
  }

  public on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return this;
  }

  public off(event: string, callback: Listener) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
    return this;
  }

  public emit(event: string, payload?: any, ack?: (res: any) => void) {
    this.handleEmit(event, payload, ack).catch((err) => {
      console.warn(`[ConvexSocket] Failed to emit event ${event}:`, err);
      if (ack) ack({ success: false, error: err.message });
    });
    return this;
  }

  private async handleEmit(event: string, payload?: any, ack?: (res: any) => void) {
    if (!this.currentUserId) return;

    switch (event) {
      case SOCKET_EVENTS.CHAT_SEND: {
        const { peerId, content, clientMessageId, attachmentUrl, attachmentName, attachmentSize, attachmentMime } = payload;
        const conv = await convex.mutation(convexApi.messages.getOrCreateConversation, {
          userId1: this.currentUserId as any,
          userId2: peerId as any,
        });

        if (!conv) {
          if (ack) ack({ success: false, error: 'Failed to create conversation' });
          return;
        }

        const msg: any = await convex.mutation(convexApi.messages.sendMessage, {
          conversationId: conv._id,
          senderId: this.currentUserId as any,
          clientMessageId: clientMessageId || crypto.randomUUID(),
          content: content || '',
          attachmentUrl,
          attachmentName,
          attachmentSize,
          attachmentMime,
        });

        const dto: MessageDto = {
          id: msg._id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          clientMessageId: msg.clientMessageId,
          content: msg.content,
          attachmentUrl: msg.attachmentUrl,
          attachmentName: msg.attachmentName,
          attachmentSize: msg.attachmentSize,
          attachmentMime: msg.attachmentMime,
          status: msg.status,
          createdAt: new Date(msg.createdAt).toISOString(),
        };

        if (ack) ack({ success: true, message: dto });
        break;
      }

      case SOCKET_EVENTS.CHAT_TYPING: {
        if (payload.conversationId) {
          await convex.mutation(convexApi.messages.setTyping, {
            conversationId: payload.conversationId as any,
            userId: this.currentUserId as any,
            isTyping: !!payload.isTyping,
          });
        }
        break;
      }

      case SOCKET_EVENTS.CHAT_READ: {
        if (payload.conversationId) {
          await convex.mutation(convexApi.messages.markAsRead, {
            conversationId: payload.conversationId as any,
            currentUserId: this.currentUserId as any,
          });
        }
        break;
      }

      case SOCKET_EVENTS.CALL_INITIATE: {
        const call = await convex.mutation(convexApi.webrtc.initiateCall, {
          callerId: this.currentUserId as any,
          receiverId: payload.targetUserId as any,
          callerName: this.currentUserName,
          isVideo: !!payload.isVideo,
        });
        if (call) {
          this.activeCallId = call._id;
        }
        break;
      }

      case SOCKET_EVENTS.CALL_ACCEPT: {
        if (this.activeCallId) {
          await convex.mutation(convexApi.webrtc.acceptCall, {
            callId: this.activeCallId as any,
          });
        }
        break;
      }

      case SOCKET_EVENTS.CALL_REJECT: {
        if (this.activeCallId) {
          await convex.mutation(convexApi.webrtc.rejectCall, {
            callId: this.activeCallId as any,
          });
          this.activeCallId = null;
        }
        break;
      }

      case SOCKET_EVENTS.CALL_END: {
        if (this.activeCallId) {
          await convex.mutation(convexApi.webrtc.endCall, {
            callId: this.activeCallId as any,
          });
          this.activeCallId = null;
        }
        break;
      }

      case SOCKET_EVENTS.CALL_OFFER: {
        if (this.activeCallId && payload.sdp) {
          await convex.mutation(convexApi.webrtc.sendSignal, {
            callId: this.activeCallId as any,
            senderId: this.currentUserId as any,
            receiverId: payload.targetUserId as any,
            type: 'offer',
            data: JSON.stringify(payload.sdp),
          });
        }
        break;
      }

      case SOCKET_EVENTS.CALL_ANSWER: {
        if (this.activeCallId && payload.sdp) {
          await convex.mutation(convexApi.webrtc.sendSignal, {
            callId: this.activeCallId as any,
            senderId: this.currentUserId as any,
            receiverId: payload.targetUserId as any,
            type: 'answer',
            data: JSON.stringify(payload.sdp),
          });
        }
        break;
      }

      case SOCKET_EVENTS.CALL_ICE_CANDIDATE: {
        if (this.activeCallId && payload.candidate) {
          await convex.mutation(convexApi.webrtc.sendSignal, {
            callId: this.activeCallId as any,
            senderId: this.currentUserId as any,
            receiverId: payload.targetUserId as any,
            type: 'ice_candidate',
            data: JSON.stringify(payload.candidate),
          });
        }
        break;
      }

      default:
        break;
    }
  }

  private initSubscriptions() {
    if (!this.currentUserId) return;

    // 1. Subscribe to active calls via watchQuery
    const callWatch = (convex as any).watchQuery(convexApi.webrtc.getActiveCall, {
      userId: this.currentUserId as any,
    });
    const unsubCall = callWatch.onUpdate(() => {
      const activeCall = callWatch.localQueryResult();
      if (!activeCall) {
        if (this.activeCallId) {
          this.activeCallId = null;
          this.trigger(SOCKET_EVENTS.CALL_END, { reason: 'terminated' });
        }
        return;
      }

      this.activeCallId = activeCall._id;

      if (activeCall.receiverId === this.currentUserId && activeCall.state === 'RINGING') {
        this.trigger(SOCKET_EVENTS.CALL_INCOMING, {
          callId: activeCall._id,
          callerId: activeCall.callerId,
          callerName: activeCall.callerName,
          callerAvatar: activeCall.callerAvatar,
          isVideo: activeCall.isVideo,
        });
      } else if (activeCall.state === 'NEGOTIATING') {
        this.trigger(SOCKET_EVENTS.CALL_ACCEPT, { callId: activeCall._id });
      } else if (activeCall.state === 'CONNECTED') {
        // Connected
      } else if (activeCall.state === 'TERMINATED' || activeCall.state === 'REJECTED') {
        this.trigger(SOCKET_EVENTS.CALL_END, { reason: activeCall.state.toLowerCase() });
        this.activeCallId = null;
      }
    });
    this.unsubs.push(unsubCall);

    // 2. Poll signals for active call
    const signalInterval = window.setInterval(async () => {
      if (!this.activeCallId || !this.currentUserId) return;
      try {
        const signals = await convex.query(convexApi.webrtc.getCallSignals, {
          callId: this.activeCallId as any,
          receiverId: this.currentUserId as any,
        });

        for (const s of signals) {
          if (this.seenSignalIds.has(s._id)) continue;
          this.seenSignalIds.add(s._id);

          try {
            const parsed = JSON.parse(s.data);
            if (s.type === 'offer') {
              this.trigger(SOCKET_EVENTS.CALL_OFFER, {
                callId: s.callId,
                senderId: s.senderId,
                sdp: parsed,
              });
            } else if (s.type === 'answer') {
              this.trigger(SOCKET_EVENTS.CALL_ANSWER, {
                callId: s.callId,
                senderId: s.senderId,
                sdp: parsed,
              });
            } else if (s.type === 'ice_candidate') {
              this.trigger(SOCKET_EVENTS.CALL_ICE_CANDIDATE, {
                callId: s.callId,
                senderId: s.senderId,
                candidate: parsed,
              });
            }
          } catch (e) {
            console.warn('[ConvexSocket] Malformed signal data:', e);
          }
        }
      } catch {
        // Query error ignored
      }
    }, 400);

    this.unsubs.push(() => clearInterval(signalInterval));

    // 3. User presence subscription via watchQuery
    const usersWatch = (convex as any).watchQuery(convexApi.users.listUsers, {});
    const unsubUsers = usersWatch.onUpdate(() => {
      const users = usersWatch.localQueryResult();
      if (!Array.isArray(users)) return;
      for (const u of users) {
        this.trigger(SOCKET_EVENTS.PRESENCE_CHANGED, {
          userId: u._id,
          status: u.status,
          lastSeenAt: new Date(u.lastSeenAt || Date.now()).toISOString(),
        });
      }
    });
    this.unsubs.push(unsubUsers);
  }

  public destroy() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.listeners.clear();
  }
}
