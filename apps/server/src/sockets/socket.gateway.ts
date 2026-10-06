import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import {
  SOCKET_EVENTS,
  SendMessageSchema,
  TypingPayloadSchema,
  ReadReceiptPayloadSchema,
  CallInitiatePayloadSchema,
  CallAcceptPayloadSchema,
  CallRejectPayloadSchema,
  CallEndPayloadSchema,
  CallOfferPayloadSchema,
  CallAnswerPayloadSchema,
  CallIceCandidatePayloadSchema,
  CallState,
} from '@chatso/shared';
import { AuthUser } from '../middleware/auth.js';

let ioInstance: Server | null = null;

export const getSocketIoInstance = (): Server | null => ioInstance;

// In-memory presence and calling state maps
const activeUserSockets = new Map<string, Set<string>>();
const activeUserCallState = new Map<string, { state: CallState; activePeerId?: string }>();

export const initSocketGateway = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  ioInstance = io;

  // Authentication Middleware
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as AuthUser;
    const userId = user.userId;

    // Track active socket
    if (!activeUserSockets.has(userId)) {
      activeUserSockets.set(userId, new Set());
    }
    activeUserSockets.get(userId)!.add(socket.id);

    // Join personal room for 1-on-1 messaging
    socket.join(`user:${userId}`);

    // Update database status to ONLINE in background
    prisma.user
      .update({
        where: { id: userId },
        data: { status: 'ONLINE', lastSeenAt: new Date() },
      })
      .then(() => {
        io.emit(SOCKET_EVENTS.PRESENCE_CHANGED, {
          userId,
          status: 'ONLINE',
          lastSeenAt: new Date(),
        });
      })
      .catch((err) => {
        console.error('[Socket.connection] Error updating status:', err);
      });

    // Initialize calling state
    if (!activeUserCallState.has(userId)) {
      activeUserCallState.set(userId, { state: 'IDLE' });
    }

    // ----------------------------------------------------
    // CHAT EVENTS
    // ----------------------------------------------------

    // Send Message
    socket.on(SOCKET_EVENTS.CHAT_SEND, async (payload, callback) => {
      try {
        console.log('[Socket] chat:send received from', userId, 'payload:', payload);
        const validated = SendMessageSchema.parse(payload);
        const { clientMessageId, recipientId, content, attachmentUrl, attachmentName, attachmentSize, attachmentMime } = validated;

        // Find or create 1-on-1 conversation
        let conversation = await prisma.conversation.findFirst({
          where: {
            AND: [
              { participants: { some: { userId } } },
              { participants: { some: { userId: recipientId } } },
            ],
          },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              participants: {
                create: [{ userId }, { userId: recipientId }],
              },
            },
          });
        }

        const isRecipientOnline = (activeUserSockets.get(recipientId)?.size || 0) > 0;
        const initialStatus = isRecipientOnline ? 'DELIVERED' : 'SENT';

        // Persist message
        const message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderId: userId,
            clientMessageId,
            content,
            attachmentUrl: attachmentUrl || null,
            attachmentName: attachmentName || null,
            attachmentSize: attachmentSize || null,
            attachmentMime: attachmentMime || null,
            status: initialStatus,
          },
        });

        // Acknowledge sender
        if (typeof callback === 'function') {
          callback({ success: true, message });
        }

        // Dispatch to recipient's room
        io.to(`user:${recipientId}`).emit(SOCKET_EVENTS.CHAT_RECEIVE, message);

        // Notify sender if delivered immediately
        if (isRecipientOnline) {
          socket.emit(SOCKET_EVENTS.CHAT_DELIVERED, {
            clientMessageId,
            messageId: message.id,
            deliveredAt: new Date(),
          });
        }
      } catch (err: any) {
        console.error('[Socket.chat:send] Error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message || 'Failed to send message' });
        }
      }
    });

    // Typing Indicators
    socket.on(SOCKET_EVENTS.CHAT_TYPING, (payload) => {
      try {
        const validated = TypingPayloadSchema.parse(payload);
        io.to(`user:${validated.recipientId}`).emit(SOCKET_EVENTS.CHAT_TYPING, {
          senderId: userId,
          isTyping: validated.isTyping,
        });
      } catch (err) {
        console.error('[Socket.chat:typing] Error:', err);
      }
    });

    // Read Receipts
    socket.on(SOCKET_EVENTS.CHAT_READ, async (payload) => {
      try {
        const validated = ReadReceiptPayloadSchema.parse(payload);
        const { peerId, lastReadMessageId } = validated;

        // Update messages sent by peer to READ
        await prisma.message.updateMany({
          where: {
            senderId: peerId,
            conversation: {
              participants: { some: { userId } },
            },
            status: { in: ['SENT', 'DELIVERED'] },
          },
          data: { status: 'READ' },
        });

        // Notify peer
        io.to(`user:${peerId}`).emit(SOCKET_EVENTS.CHAT_READ, {
          readerId: userId,
          lastReadMessageId,
          readAt: new Date(),
        });
      } catch (err) {
        console.error('[Socket.chat:read] Error:', err);
      }
    });

    // ----------------------------------------------------
    // WEBRTC CALLING EVENTS (State Machine & Glare Management)
    // ----------------------------------------------------

    // Call Initiate
    socket.on(SOCKET_EVENTS.CALL_INITIATE, async (payload, callback) => {
      try {
        const validated = CallInitiatePayloadSchema.parse(payload);
        const { recipientId, isVideo } = validated;

        const recipientCall = activeUserCallState.get(recipientId);
        if (recipientCall && recipientCall.state !== 'IDLE') {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'User is currently busy on another call' });
          }
          socket.emit(SOCKET_EVENTS.CALL_REJECT, { callerId: userId, reason: 'busy' });
          return;
        }

        // Set states
        activeUserCallState.set(userId, { state: 'CALLING', activePeerId: recipientId });
        activeUserCallState.set(recipientId, { state: 'RINGING', activePeerId: userId });

        const caller = await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true, avatarUrl: true },
        });

        io.to(`user:${recipientId}`).emit(SOCKET_EVENTS.CALL_INCOMING, {
          callerId: userId,
          callerName: caller?.displayName || user.username,
          callerAvatar: caller?.avatarUrl || null,
          isVideo,
        });

        if (typeof callback === 'function') {
          callback({ success: true });
        }
      } catch (err: any) {
        console.error('[Socket.call:initiate] Error:', err);
        if (typeof callback === 'function') {
          callback({ success: false, error: err.message || 'Call initiation failed' });
        }
      }
    });

    // Call Accept
    socket.on(SOCKET_EVENTS.CALL_ACCEPT, (payload) => {
      try {
        const validated = CallAcceptPayloadSchema.parse(payload);
        const { callerId } = validated;

        activeUserCallState.set(userId, { state: 'NEGOTIATING', activePeerId: callerId });
        activeUserCallState.set(callerId, { state: 'NEGOTIATING', activePeerId: userId });

        io.to(`user:${callerId}`).emit(SOCKET_EVENTS.CALL_ACCEPT, { peerId: userId });
      } catch (err) {
        console.error('[Socket.call:accept] Error:', err);
      }
    });

    // Call Reject
    socket.on(SOCKET_EVENTS.CALL_REJECT, (payload) => {
      try {
        const validated = CallRejectPayloadSchema.parse(payload);
        const { callerId, reason } = validated;

        activeUserCallState.set(userId, { state: 'IDLE' });
        activeUserCallState.set(callerId, { state: 'IDLE' });

        io.to(`user:${callerId}`).emit(SOCKET_EVENTS.CALL_REJECT, { peerId: userId, reason: reason || 'declined' });
      } catch (err) {
        console.error('[Socket.call:reject] Error:', err);
      }
    });

    // Call Offer (SDP)
    socket.on(SOCKET_EVENTS.CALL_OFFER, (payload) => {
      try {
        const validated = CallOfferPayloadSchema.parse(payload);
        io.to(`user:${validated.recipientId}`).emit(SOCKET_EVENTS.CALL_OFFER, {
          callerId: userId,
          sdp: validated.sdp,
        });
      } catch (err) {
        console.error('[Socket.call:offer] Error:', err);
      }
    });

    // Call Answer (SDP)
    socket.on(SOCKET_EVENTS.CALL_ANSWER, (payload) => {
      try {
        const validated = CallAnswerPayloadSchema.parse(payload);
        activeUserCallState.set(userId, { state: 'CONNECTED', activePeerId: validated.callerId });
        activeUserCallState.set(validated.callerId, { state: 'CONNECTED', activePeerId: userId });

        io.to(`user:${validated.callerId}`).emit(SOCKET_EVENTS.CALL_ANSWER, {
          peerId: userId,
          sdp: validated.sdp,
        });
      } catch (err) {
        console.error('[Socket.call:answer] Error:', err);
      }
    });

    // ICE Candidate
    socket.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, (payload) => {
      try {
        const validated = CallIceCandidatePayloadSchema.parse(payload);
        io.to(`user:${validated.targetId}`).emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, {
          senderId: userId,
          candidate: validated.candidate,
        });
      } catch (err) {
        console.error('[Socket.call:ice_candidate] Error:', err);
      }
    });

    // Call End
    socket.on(SOCKET_EVENTS.CALL_END, (payload) => {
      try {
        const validated = CallEndPayloadSchema.parse(payload);
        const { peerId } = validated;

        activeUserCallState.set(userId, { state: 'IDLE' });
        activeUserCallState.set(peerId, { state: 'IDLE' });

        io.to(`user:${peerId}`).emit(SOCKET_EVENTS.CALL_END, { peerId: userId });
      } catch (err) {
        console.error('[Socket.call:end] Error:', err);
      }
    });

    // ----------------------------------------------------
    // DISCONNECTION CLEANUP
    // ----------------------------------------------------
    socket.on('disconnect', async () => {
      const userSockets = activeUserSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          activeUserSockets.delete(userId);

          // Terminate any active calls
          const currentCall = activeUserCallState.get(userId);
          if (currentCall && currentCall.activePeerId) {
            io.to(`user:${currentCall.activePeerId}`).emit(SOCKET_EVENTS.CALL_END, { peerId: userId });
            activeUserCallState.set(currentCall.activePeerId, { state: 'IDLE' });
          }
          activeUserCallState.set(userId, { state: 'IDLE' });

          // Update DB status to OFFLINE in background
          prisma.user
            .update({
              where: { id: userId },
              data: { status: 'OFFLINE', lastSeenAt: new Date() },
            })
            .then(() => {
              io.emit(SOCKET_EVENTS.PRESENCE_CHANGED, {
                userId,
                status: 'OFFLINE',
                lastSeenAt: new Date(),
              });
            })
            .catch((err) => {
              console.error('[Socket.disconnect] Error updating status:', err);
            });
        }
      }
    });
  });

  return io;
};
