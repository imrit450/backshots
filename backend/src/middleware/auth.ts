import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../index';

export interface HostPayload {
  hostId: string;
  email: string;
  type: 'host';
}

export interface GuestPayload {
  sessionId: string;
  eventId: string;
  type: 'guest';
}

declare global {
  namespace Express {
    interface Request {
      hostUser?: HostPayload;
      guestUser?: GuestPayload;
    }
  }
}

export function authenticateHost(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, config.jwtSecret) as HostPayload;
    if (payload.type !== 'host') {
      res.status(403).json({ error: 'Host access required' });
      return;
    }
    req.hostUser = payload;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware that authenticates a host AND verifies they have the 'admin' role.
 * Must be used after authenticateHost or inline (it does its own auth check).
 */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, config.jwtSecret) as HostPayload;
    if (payload.type !== 'host') {
      res.status(403).json({ error: 'Host access required' });
      return;
    }
    req.hostUser = payload;

    // Check admin role in database
    prisma.host
      .findUnique({ where: { id: payload.hostId }, select: { role: true } })
      .then((host) => {
        if (!host || host.role !== 'admin') {
          res.status(403).json({ error: 'Admin access required' });
          return;
        }
        next();
      })
      .catch(() => {
        res.status(500).json({ error: 'Failed to verify admin status' });
      });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authenticateGuest(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid guest token' });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, config.jwtSecret) as GuestPayload;
    if (payload.type !== 'guest') {
      res.status(403).json({ error: 'Guest access required' });
      return;
    }
    req.guestUser = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired guest token' });
  }
}

export function authenticateAny(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, config.jwtSecret) as HostPayload | GuestPayload;
    if (payload.type === 'host') {
      req.hostUser = payload as HostPayload;
    } else if (payload.type === 'guest') {
      req.guestUser = payload as GuestPayload;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function generateHostToken(hostId: string, email: string): string {
  return jwt.sign({ hostId, email, type: 'host' } as HostPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function generateGuestToken(sessionId: string, eventId: string): string {
  return jwt.sign({ sessionId, eventId, type: 'guest' } as GuestPayload, config.jwtSecret, {
    expiresIn: config.guestTokenExpiresIn,
  } as jwt.SignOptions);
}
