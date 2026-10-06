import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { RegisterInput, LoginInput } from '@chatso/shared';

export class AuthController {
  static async register(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { username, email, password, displayName } = req.body as RegisterInput;

      // Check if user or email already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
        },
      });

      if (existingUser) {
        if (existingUser.email === email.toLowerCase()) {
          res.status(409).json({ error: 'Email already registered' });
          return;
        }
        res.status(409).json({ error: 'Username already taken' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          displayName,
          passwordHash,
          status: 'ONLINE',
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          createdAt: true,
          lastSeenAt: true,
        },
      });

      const token = jwt.sign(
        { userId: user.id, username: user.username, email: user.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.status(201).json({ token, user });
    } catch (err) {
      console.error('[Auth.register] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async login(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { usernameOrEmail, password } = req.body as LoginInput;
      const normalizedQuery = usernameOrEmail.toLowerCase();

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: normalizedQuery }, { username: normalizedQuery }],
        },
      });

      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Update status to ONLINE
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'ONLINE', lastSeenAt: new Date() },
      });

      const token = jwt.sign(
        { userId: user.id, username: user.username, email: user.email },
        config.jwtSecret,
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          status: 'ONLINE',
          createdAt: user.createdAt,
          lastSeenAt: user.lastSeenAt,
        },
      });
    } catch (err) {
      console.error('[Auth.login] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          status: true,
          createdAt: true,
          lastSeenAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user });
    } catch (err) {
      console.error('[Auth.me] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
