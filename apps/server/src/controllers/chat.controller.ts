import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export class ChatController {
  static async getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.userId;
      const peerIdParam = req.params.peerId;
      const peerId = Array.isArray(peerIdParam) ? peerIdParam[0] : peerIdParam;
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(parseInt((req.query.limit as string) || '30', 10), 100);

      if (!currentUserId || !peerId) {
        res.status(400).json({ error: 'Missing user parameters' });
        return;
      }

      // Find conversation between current user and peer
      const conversation = await prisma.conversation.findFirst({
        where: {
          AND: [
            { participants: { some: { userId: currentUserId } } },
            { participants: { some: { userId: peerId } } },
          ],
        },
      });

      if (!conversation) {
        res.json({ messages: [], nextCursor: null });
        return;
      }

      const messages = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        skip: cursor ? 1 : 0,
        orderBy: { createdAt: 'desc' },
      });

      let nextCursor: string | null = null;
      if (messages.length > limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem ? nextItem.id : null;
      }

      // Return messages in chronological order
      res.json({
        conversationId: conversation.id,
        messages: messages.reverse(),
        nextCursor,
      });
    } catch (err) {
      console.error('[Chat.getMessages] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
