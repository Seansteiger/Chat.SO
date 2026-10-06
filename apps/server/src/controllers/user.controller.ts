import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { UpdateProfileInput, SOCKET_EVENTS } from '@chatso/shared';
import { getSocketIoInstance } from '../sockets/socket.gateway.js';

export class UserController {
  static async getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const currentUserId = req.user?.userId;

      const users = await prisma.user.findMany({
        where: currentUserId ? { id: { not: currentUserId } } : undefined,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          lastSeenAt: true,
          createdAt: true,
        },
        orderBy: { displayName: 'asc' },
      });

      res.json({ users });
    } catch (err) {
      console.error('[User.getUsers] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { displayName, avatarUrl, status } = req.body as UpdateProfileInput;

      const updatedUser = await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          ...(displayName ? { displayName } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(status ? { status } : {}),
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });

      // Broadcast presence update if status changed
      if (status) {
        const io = getSocketIoInstance();
        if (io) {
          io.emit(SOCKET_EVENTS.PRESENCE_CHANGED, {
            userId: updatedUser.id,
            status: updatedUser.status,
            lastSeenAt: updatedUser.lastSeenAt,
          });
        }
      }

      res.json({ user: updatedUser });
    } catch (err) {
      console.error('[User.updateProfile] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
