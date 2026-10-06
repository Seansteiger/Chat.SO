import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AuthUser {
  userId: string;
  username: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export const authenticateJwt = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    return;
  }
};
