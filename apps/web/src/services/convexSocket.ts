import { SOCKET_EVENTS, MessageDto } from '@chatso/shared';
import { convex, api as convexApi } from '../convex.js';

type Listener = (...args: any[]) => void;

export class ConvexSocketBridge {
  private listeners: Map<string, Set<Listener>> = new Map();
  private currentUserId: string | null = null;
  private currentUserName: string = 'User';
  private unsubs: Array<() => void> = [];
  private activeCallId: string | null = null;
  private activePeerId: string | null = null;
  private negotiationTriggered: boolean = false;
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
        const targetUserId = payload.recipientId || payload.peerId;
        const { content, clientMessageId, attachmentUrl, attachmentName, attachmentSize, attachmentMime } = payload;

        if (!targetUserId) {
          console.error('[ConvexSocket] CHAT_SEND missing target user id in payload:', payload);
          if (ack) ack({ success: false, error: 'Recipient ID is required' });
          return;
        }

        const conv: any = await convex.mutation(convexApi.messages.getOrCreateConversation, {
          userId1: this.currentUserId as any,
          userId2: targetUserId as any,
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
        const targetId = payload.recipientId || payload.peerId;
        let convId = payload.conversationId;
        if (!convId && targetId) {
          const conv: any = await convex.mutation(convexApi.messages.getOrCreateConversation, {
            userId1: this.currentUserId as any,
            userId2: targetId as any,
          });
          if (conv) convId = conv._id;
        }
        if (convId) {
          await convex.mutation(convexApi.messages.setTyping, {
            conversationId: convId as any,
            userId: this.currentUserId as any,
            isTyping: !!payload.isTyping,
          });
        }
        break;
      }

      case SOCKET_EVENTS.CHAT_READ: {
        const targetId = payload.recipientId || payload.peerId;
        let convId = payload.conversationId;
        if (!convId && targetId) {
          const conv: any = await convex.mutation(convexApi.messages.getOrCreateConversation, {
            userId1: this.currentUserId as any,
            userId2: targetId as any,
          });
          if (conv) convId = conv._id;
        }
        if (convId) {
          await convex.mutation(convexApi.messages.markAsRead, {
            conversationId: convId as any,
            currentUserId: this.currentUserId as any,
          });
        }
        break;
      }

      case SOCKET_EVENTS.CALL_INITIATE: {
        const targetUserId = payload.recipientId || payload.targetUserId || payload.peerId;
        if (!targetUserId) {
          console.error('[ConvexSocket] CALL_INITIATE missing target user ID in payload:', payload);
          if (ack) ack({ success: false, error: 'Recipient ID is required' });
          return;
        }

        if (targetUserId === this.currentUserId) {
          if (ack) ack({ success: false, error: 'You cannot call yourself' });
          return;
        }

        const call: any = await convex.mutation(convexApi.webrtc.initiateCall, {
          callerId: this.currentUserId as any,
          receiverId: targetUserId as any,
          callerName: this.currentUserName || 'User',
          isVideo: !!payload.isVideo,
        });

        if (call) {
          this.activeCallId = call._id;
          this.activePeerId = targetUserId;
          this.negotiationTriggered = false;
        }
        if (ack) ack({ success: true, callId: call?._id });
        break;
      }

      case SOCKET_EVENTS.CALL_ACCEPT: {
        const callId = payload.callId || this.activeCallId;
        if (callId) {
          await convex.mutation(convexApi.webrtc.acceptCall, {
            callId: callId as any,
          });
        }
        if (ack) ack({ success: true });
        break;
      }

      case SOCKET_EVENTS.CALL_REJECT: {
        const callId = payload.callId || this.activeCallId;
        if (callId) {
          await convex.mutation(convexApi.webrtc.rejectCall, {
            callId: callId as any,
          });
          this.activeCallId = null;
          this.activePeerId = null;
          this.negotiationTriggered = false;
        }
        if (ack) ack({ success: true });
        break;
      }

      case SOCKET_EVENTS.CALL_END: {
        const callId = payload.callId || this.activeCallId;
        if (callId) {
          await convex.mutation(convexApi.webrtc.endCall, {
            callId: callId as any,
          });
          this.activeCallId = null;
          this.activePeerId = null;
          this.negotiationTriggered = false;
        }
        if (ack) ack({ success: true });
        break;
      }

      case SOCKET_EVENTS.CALL_OFFER: {
        const targetId = payload.recipientId || payload.targetUserId || payload.peerId || this.activePeerId;
        const callId = payload.callId || this.activeCallId;
        if (callId && payload.sdp && targetId) {
          await convex.mutation(convexApi.webrtc.sendSignal, {
            callId: callId as any,
            senderId: this.currentUserId as any,
            receiverId: targetId as any,
            type: 'offer',
            data: JSON.stringify(payload.sdp),
          });
        }
        if (ack) ack({ success: true });
        break;
      }

      case SOCKET_EVENTS.CALL_ANSWER: {
        const targetId = payload.callerId || payload.recipientId || payload.targetUserId || payload.peerId || this.activePeerId;
        const callId = payload.callId || this.activeCallId;
        if (callId && payload.sdp && targetId) {
          await convex.mutation(convexApi.webrtc.sendSignal, {
            callId: callId as any,
            senderId: this.currentUserId as any,
            receiverId: targetId as any,
            type: 'answer',
            data: JSON.stringify(payload.sdp),
          });
        }
        if (ack) ack({ success: true });
        break;
      }

      case SOCKET_EVENTS.CALL_ICE_CANDIDATE: {
        const targetId = payload.targetId || payload.targetUserId || payload.recipientId || payload.peerId || this.activePeerId;
        const callId = payload.callId || this.activeCallId;
        if (callId && payload.candidate && targetId) {
          await convex.mutation(convexApi.webrtc.sendSignal, {
            callId: callId as any,
            senderId: this.currentUserId as any,
            receiverId: targetId as any,
            type: 'ice_candidate',
            data: JSON.stringify(payload.candidate),
          });
        }
        if (ack) ack({ success: true });
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
          this.activePeerId = null;
          this.negotiationTriggered = false;
          this.trigger(SOCKET_EVENTS.CALL_END, { reason: 'terminated' });
        }
        return;
      }

      this.activeCallId = activeCall._id;
      this.activePeerId =
        activeCall.callerId === this.currentUserId ? activeCall.receiverId : activeCall.callerId;

      if (activeCall.receiverId === this.currentUserId && activeCall.state === 'RINGING') {
        this.trigger(SOCKET_EVENTS.CALL_INCOMING, {
          callId: activeCall._id,
          callerId: activeCall.callerId,
          callerName: activeCall.callerName,
          callerAvatar: activeCall.callerAvatar,
          isVideo: activeCall.isVideo,
        });
      } else if (activeCall.state === 'NEGOTIATING') {
        // Trigger CALL_ACCEPT on caller so caller generates SDP offer
        if (activeCall.callerId === this.currentUserId && !this.negotiationTriggered) {
          this.negotiationTriggered = true;
          this.trigger(SOCKET_EVENTS.CALL_ACCEPT, {
            callId: activeCall._id,
            peerId: activeCall.receiverId,
          });
        }
      } else if (activeCall.state === 'CONNECTED') {
        // Connected
      } else if (activeCall.state === 'TERMINATED' || activeCall.state === 'REJECTED') {
        this.trigger(SOCKET_EVENTS.CALL_REJECT, {
          peerId: this.activePeerId,
          reason: activeCall.state.toLowerCase(),
        });
        this.activeCallId = null;
        this.activePeerId = null;
        this.negotiationTriggered = false;
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
                callerId: s.senderId,
                senderId: s.senderId,
                peerId: s.senderId,
                sdp: parsed,
              });
            } else if (s.type === 'answer') {
              this.trigger(SOCKET_EVENTS.CALL_ANSWER, {
                callId: s.callId,
                peerId: s.senderId,
                callerId: s.senderId,
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
    }, 200);

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

    // 4. Real-time message subscription for incoming messages
    const msgsWatch = (convex as any).watchQuery(convexApi.messages.getMessagesForUserConversations, {
      userId: this.currentUserId as any,
    });
    const seenMsgIds = new Set<string>();
    let isInitialLoad = true;

    const unsubMsgs = msgsWatch.onUpdate(() => {
      const msgs = msgsWatch.localQueryResult();
      if (!Array.isArray(msgs)) return;

      if (isInitialLoad) {
        msgs.forEach((m: any) => seenMsgIds.add(m._id));
        isInitialLoad = false;
        return;
      }

      for (const m of msgs) {
        if (!seenMsgIds.has(m._id)) {
          seenMsgIds.add(m._id);
          if (m.senderId !== this.currentUserId) {
            const dto: MessageDto = {
              id: m._id,
              conversationId: m.conversationId,
              senderId: m.senderId,
              clientMessageId: m.clientMessageId,
              content: m.content,
              attachmentUrl: m.attachmentUrl,
              attachmentName: m.attachmentName,
              attachmentSize: m.attachmentSize,
              attachmentMime: m.attachmentMime,
              status: m.status,
              createdAt: new Date(m.createdAt).toISOString(),
            };
            this.trigger(SOCKET_EVENTS.CHAT_RECEIVE, dto);
          }
        }
      }
    });
    this.unsubs.push(unsubMsgs);
  }

  public destroy() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.listeners.clear();
  }
}
